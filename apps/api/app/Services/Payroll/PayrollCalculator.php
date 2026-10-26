<?php

namespace App\Services\Payroll;

use App\Enums\PayModel;
use App\Models\Attendance;
use App\Models\ClassRoom;
use App\Models\Payment;
use App\Models\PayrollItem;
use App\Models\PayrollPeriod;
use App\Models\ScheduleSession;
use App\Models\TutorCompensationProfile;
use Illuminate\Support\Facades\DB;

/**
 * Turns a payroll period + each member's compensation profile into payroll_items — the ONE money-math
 * for salary (design §2.6). Called by the queued ComputePayrollPeriod job.
 *
 * SQLite-safe by construction: every date filter is a plain BETWEEN on a date column (Carbon range),
 * NEVER MySQL DATE_FORMAT (design §6 risk 8, §8). Grouping/aggregation that would need DATE_FORMAT is
 * done in PHP on fetched rows instead.
 *
 * Idempotency (design §6 risk 4): each member's item is UPSERTED on (payroll_period_id, user_id), so a
 * compute that runs twice for the same period rewrites the SAME row to identical totals — never a
 * duplicate. Adjustments (separate rows) survive an upsert and are re-folded into the total each run.
 * Compute is REFUSED unless the period is a draft (a chosen snapshot is immutable).
 *
 * v1 implements fixed_monthly / per_session / revenue_share; per_student + hybrid are carried in the
 * schema but return 0 here (design §5 QĐ 1) — see the match() default.
 */
class PayrollCalculator
{
    /**
     * (Re)compute every payslip for $period for a SPECIFIC calculation run ($token).
     *
     * Concurrency-safe (the CRITICAL fix): the period row is reloaded under a row lock INSIDE the
     * transaction and the run is aborted unless it is still a draft whose CURRENT calculation_token
     * matches $token. A stale/replayed job (token no longer current, or the period was approved in the
     * meantime) therefore never rewrites the chosen snapshot. The run also RECONCILES stale draft items
     * (members/profiles no longer eligible) before denormalizing the total, so a recompute can never
     * leave a skipped member's old payslip inside the payable total.
     *
     * @return int number of payroll_items written
     */
    public function computePeriod(PayrollPeriod $period, ?string $token = null): int
    {
        $written = 0;

        DB::transaction(function () use ($period, $token, &$written) {
            /** @var PayrollPeriod $locked */
            $locked = PayrollPeriod::whereKey($period->id)->lockForUpdate()->first();

            // Abort a stale/replayed run: not a draft, or the token is no longer the current claim.
            if (! $locked || ! $locked->isComputable()
                || ($token !== null && $locked->calculation_token !== $token)) {
                return;
            }

            $locked->forceFill([
                'calculation_status' => PayrollPeriod::CALC_COMPUTING,
                'calculation_started_at' => now(),
                'calculation_error' => null,
            ])->save();

            $org = $locked->organization;
            if (! $org) {
                $locked->forceFill(['calculation_status' => PayrollPeriod::CALC_FAILED, 'calculation_error' => 'organization missing'])->save();
                return;
            }

            $from = $locked->period_start->toDateString();
            $to = $locked->period_end->toDateString();

            // Active member user-ids of the org (owner + managers + tutors). Every member who also holds an
            // ACTIVE comp profile gets a payslip; members without a profile are skipped (no rule → no pay).
            $memberIds = array_map('intval', $org->activeMemberUserIds());
            $eligibleUserIds = [];

            foreach ($memberIds as $userId) {
                $profile = TutorCompensationProfile::query()
                    ->where('organization_id', $org->id)
                    ->where('user_id', $userId)
                    ->activeOn($to) // the rule in force at period end
                    ->orderByDesc('effective_from')
                    ->first();

                if (! $profile) {
                    continue; // no active rule → no payslip this run
                }

                $this->writeItem($locked, $org->id, $userId, $profile, $from, $to);
                $eligibleUserIds[] = $userId;
                $written++;
            }

            // Reconcile: drop draft payslips for members no longer eligible (removed member / expired or
            // replaced profile). Only DRAFT items are removed — a draft period has only draft items, and
            // approved/paid history is never touched here.
            PayrollItem::where('payroll_period_id', $locked->id)
                ->where('status', PayrollItem::STATUS_DRAFT)
                ->when($eligibleUserIds !== [], fn ($q) => $q->whereNotIn('user_id', $eligibleUserIds))
                ->delete();

            // Denormalize the run total (sum of gross) for dashboards, AFTER reconciliation.
            $locked->total_amount = (int) PayrollItem::where('payroll_period_id', $locked->id)->sum('gross_amount');
            $locked->computed_at = now();
            $locked->calculation_status = PayrollPeriod::CALC_COMPLETED;
            $locked->save();
        });

        return $written;
    }

    /**
     * Compute + UPSERT one member's payslip. The unique (period, user) key makes this idempotent.
     */
    private function writeItem(PayrollPeriod $period, int $orgId, int $userId, TutorCompensationProfile $profile, string $from, string $to): void
    {
        $model = PayModel::from($profile->pay_model);

        $base = 0;
        $sessionsCount = 0;
        $sessionsAmount = 0;
        $studentsCount = 0;
        $studentsAmount = 0;
        $revenueBase = 0;
        $revenueAmount = 0;
        $breakdown = ['pay_model' => $model->value, 'window' => ['from' => $from, 'to' => $to]];

        switch ($model) {
            case PayModel::FixedMonthly:
                $base = (int) ($profile->base_salary ?? 0);
                $breakdown['base_salary'] = $base;
                break;

            case PayModel::PerSession:
                $sessionsCount = $this->countSessions($orgId, $userId, $profile->session_basis, $from, $to);
                $rate = (int) ($profile->rate_per_session ?? 0);
                $sessionsAmount = $rate * $sessionsCount;
                $breakdown['session_basis'] = $profile->session_basis;
                $breakdown['rate_per_session'] = $rate;
                $breakdown['sessions_count'] = $sessionsCount;
                break;

            case PayModel::RevenueShare:
                $revenueBase = $this->tutorRevenue($orgId, $userId, $from, $to);
                $pct = (float) ($profile->revenue_share_pct ?? 0);
                // Round to whole VND (money is decimal(12,0)).
                $revenueAmount = (int) round($revenueBase * $pct / 100);
                $breakdown['revenue_share_pct'] = $pct;
                $breakdown['revenue_base'] = $revenueBase;
                break;

            default:
                // per_student / hybrid — v1 schema-only. TODO(v2): implement per-active-student and
                // hybrid component summation once the product defines unique-vs-seat + a components UI.
                $breakdown['note'] = 'pay_model not computed in v1';
                break;
        }

        // Fold any existing adjustments for this member+period into the total (they survive recompute).
        $existing = PayrollItem::where('payroll_period_id', $period->id)
            ->where('user_id', $userId)
            ->first();
        $adjustmentsTotal = $existing
            ? (int) $existing->adjustments()->sum('amount')
            : 0;

        $gross = $base + $sessionsAmount + $studentsAmount + $revenueAmount + $adjustmentsTotal;

        PayrollItem::updateOrCreate(
            [
                'payroll_period_id' => $period->id,
                'user_id' => $userId,
            ],
            [
                'organization_id' => $orgId, // hard snapshot anchor
                'compensation_profile_id' => $profile->id,
                'pay_model' => $model->value, // SNAPSHOT
                'base_amount' => $base,
                'sessions_count' => $sessionsCount,
                'sessions_amount' => $sessionsAmount,
                'students_count' => $studentsCount,
                'students_amount' => $studentsAmount,
                'revenue_base' => $revenueBase,
                'revenue_amount' => $revenueAmount,
                'adjustments_total' => $adjustmentsTotal,
                'gross_amount' => $gross,
                'computation_breakdown' => $breakdown,
                'status' => PayrollItem::STATUS_DRAFT,
            ]
        );
    }

    /**
     * Count the sessions a tutor "closed" in [from,to] for org classes. Attribution (design §5 QĐ 2):
     * completed_by = the tutor, else fall back to class.tutor_id. session_basis switches the signal:
     *  - completed_session (default): completed ScheduleSessions in the window;
     *  - attendance_taught: distinct sessions where the tutor RECORDED attendance in the window.
     * SQLite-safe: BETWEEN on the date column only.
     */
    private function countSessions(int $orgId, int $userId, string $sessionBasis, string $from, string $to): int
    {
        // Class ids of this org whose lead tutor is the member (the fallback attribution set).
        $ledClassIds = ClassRoom::where('organization_id', $orgId)
            ->where('tutor_id', $userId)
            ->pluck('id')
            ->all();

        if ($sessionBasis === 'attendance_taught') {
            // Distinct taught sessions: attendance rows the tutor recorded, for org classes, in window.
            // Group in PHP by schedule_session_id (fallback class_id+date) — no DATE_FORMAT.
            $rows = Attendance::query()
                ->where('tutor_id', $userId)
                ->whereBetween('date', [$from, $to])
                ->whereHas('class', fn ($q) => $q->where('organization_id', $orgId))
                ->get(['schedule_session_id', 'class_id', 'date']);

            return $rows
                ->map(fn ($a) => $a->schedule_session_id ?? ($a->class_id.'-'.optional($a->date)->toDateString()))
                ->unique()
                ->count();
        }

        // completed_session: completed ScheduleSessions in [from,to] for org classes, attributed to the
        // tutor by completed_by (else the class's lead tutor when the session wasn't closed by a user).
        return ScheduleSession::query()
            ->where('status', 'completed')
            ->whereBetween('session_date', [$from, $to])
            ->whereHas('class', fn ($q) => $q->where('organization_id', $orgId))
            ->where(function ($q) use ($userId, $ledClassIds) {
                $q->where('completed_by', $userId)
                    ->orWhere(function ($q2) use ($ledClassIds) {
                        $q2->whereNull('completed_by')
                            ->whereIn('class_id', $ledClassIds ?: [0]);
                    });
            })
            ->count();
    }

    /**
     * Cash-basis org revenue attributable to the tutor's classes in [from,to] (design §5 QĐ 7): sum of
     * PAID payments (payment_date in window) on classes the tutor leads within the org. SQLite-safe
     * BETWEEN on payment_date.
     */
    private function tutorRevenue(int $orgId, int $userId, string $from, string $to): int
    {
        return (int) Payment::query()
            ->where('status', 'paid')
            ->whereNotNull('payment_date')
            ->whereBetween('payment_date', [$from, $to])
            ->whereHas('class', function ($q) use ($orgId, $userId) {
                $q->where('organization_id', $orgId)->where('tutor_id', $userId);
            })
            ->sum('amount');
    }
}
