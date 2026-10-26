<?php

namespace App\Jobs;

use App\Models\PayrollPeriod;
use App\Services\Payroll\PayrollCalculator;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\DB;
use Throwable;

/**
 * Queued recompute of a payroll period's items — Wave 3. Long/idempotent money work belongs off the
 * request thread (design §3.4, laravel-api rule). The run is bound to a per-claim calculation TOKEN: the
 * calculator aborts a stale/replayed job whose token is no longer current, so a re-dispatch (retry) can
 * never overwrite a snapshot that has since been approved. Needs `php artisan queue:work` in prod; tests
 * run QUEUE_CONNECTION=sync so it executes inline.
 */
class ComputePayrollPeriod implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public function __construct(public int $periodId, public ?string $token = null) {}

    public function handle(PayrollCalculator $calculator): void
    {
        try {
            $period = PayrollPeriod::find($this->periodId);
            if (! $period) {
                return; // period deleted before the job ran — nothing to do
            }

            $calculator->computePeriod($period, $this->token);
        } catch (Throwable $e) {
            // Surface a safe failure state so the UI can offer a retry instead of hanging on "queued".
            DB::transaction(function () {
                $locked = PayrollPeriod::whereKey($this->periodId)->lockForUpdate()->first();
                if ($locked && $locked->calculation_token === $this->token && $locked->isComputable()) {
                    $locked->forceFill([
                        'calculation_status' => PayrollPeriod::CALC_FAILED,
                        'calculation_error' => 'Tính lương thất bại, vui lòng thử lại',
                    ])->save();
                }
            });

            report($e);
        }
    }
}
