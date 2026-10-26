<?php

namespace App\Http\Controllers\API\V1;

use App\Http\Requests\StoreCenterExpenseRequest;
use App\Http\Requests\UpdateCenterExpenseRequest;
use App\Http\Resources\CenterExpenseResource;
use App\Models\CenterExpense;
use App\Models\ClassRoom;
use App\Models\Organization;
use App\Models\User;
use App\Traits\InteractsWithOrganizationRoutes;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Center (organization) expenses CRUD — Wave 2 finance. Money is HIGH-sensitivity: EVERY action is
 * gated by the triple (design G3) capability `reports.finance` → org-role (owner/manager/accountant)
 * → org-context, and every row is org-anchored (organization_id). Accountants MAY write expenses
 * (finance write is allowed by design §5 QĐ3 — only refunds stay owner/manager-only).
 *
 * Cross-org is fail-closed: guardOrgContext derives the org from the caller's membership (never the
 * URL), and a bound {expense} of another org 404s via expenseInOrg(). class_id / tutor_id are rejected
 * unless they belong to THIS org (no cross-org attribution injection).
 */
class CenterExpenseController extends BaseController
{
    use InteractsWithOrganizationRoutes;

    private const CAPABILITY = 'reports.finance';

    private const ROLES = ['owner', 'manager', 'accountant'];

    /**
     * GET /organizations/{organization}/expenses — list org expenses, filter by category / date range
     * / class. Org-scoped (where organization_id = $org->id); fail-closed for any other org.
     */
    public function index(Request $request, Organization $organization): JsonResponse
    {
        if ($denied = $this->gate($organization)) {
            return $denied;
        }

        $validator = validator($request->all(), [
            'category' => ['nullable', 'string', 'max:50'],
            'date_from' => ['nullable', 'date_format:Y-m-d'],
            'date_to' => ['nullable', 'date_format:Y-m-d'],
            'class_id' => ['nullable', 'string'],
        ]);
        if ($validator->fails()) {
            return $this->errorResponse('Định dạng dữ liệu không hợp lệ', $validator, 'VALIDATION_ERROR', 422);
        }

        $query = CenterExpense::query()
            ->where('organization_id', $organization->id)
            ->with('class')
            ->orderByDesc('expense_date')
            ->orderByDesc('id');

        if ($request->filled('category')) {
            $query->where('category', $request->category);
        }
        if ($request->filled('date_from')) {
            $query->whereDate('expense_date', '>=', $request->date_from);
        }
        if ($request->filled('date_to')) {
            $query->whereDate('expense_date', '<=', $request->date_to);
        }
        if ($request->filled('class_id')) {
            // A class filter is only meaningful for a class of THIS org (else empty, never cross-org).
            $classId = ClassRoom::decodeId($request->class_id);
            $query->where('class_id', $classId ?? 0);
        }

        return $this->successResponse(CenterExpenseResource::collection($query->get()));
    }

    /**
     * POST /organizations/{organization}/expenses — create an expense (owner/manager/accountant).
     */
    public function store(StoreCenterExpenseRequest $request, Organization $organization): JsonResponse
    {
        if ($denied = $this->gate($organization)) {
            return $denied;
        }

        $data = $request->validated();

        // Resolve + org-validate the optional attribution ids (reject cross-org injection → 422).
        [$classId, $classError] = $this->resolveOrgClassId($data['class_id'] ?? null, $organization);
        if ($classError) {
            return $classError;
        }
        [$tutorId, $tutorError] = $this->resolveOrgTutorId($data['tutor_id'] ?? null, $organization);
        if ($tutorError) {
            return $tutorError;
        }

        // Settlement state: a bill is "settled" the moment a payment method / paid_at is recorded;
        // otherwise it stays unpaid (a payable). Default paid_at = expense_date for legacy compat.
        $paymentMethod = $data['payment_method'] ?? null;
        $settlementStatus = $data['settlement_status']
            ?? ($paymentMethod ? CenterExpense::SETTLEMENT_SETTLED : CenterExpense::SETTLEMENT_UNPAID);
        $paidAt = $data['paid_at'] ?? ($settlementStatus === CenterExpense::SETTLEMENT_SETTLED ? $data['expense_date'] : null);

        $expense = CenterExpense::create([
            'organization_id' => $organization->id, // anchor — from context, never the body
            'category' => $data['category'],
            'amount' => $data['amount'],
            'expense_date' => $data['expense_date'],
            'description' => $data['description'] ?? null,
            'class_id' => $classId,
            'tutor_id' => $tutorId,
            'payment_method' => $paymentMethod,
            'settlement_status' => $settlementStatus,
            'paid_at' => $paidAt,
            'payment_reference' => $data['payment_reference'] ?? null,
            'created_by' => $this->getAuthUser()->id,
        ]);

        return $this->successResponse(
            new CenterExpenseResource($expense->load('class')),
            'Tạo khoản chi thành công',
            201
        );
    }

    /**
     * PATCH /organizations/{organization}/expenses/{expense} — edit an expense.
     */
    public function update(UpdateCenterExpenseRequest $request, Organization $organization, CenterExpense $expense): JsonResponse
    {
        if ($denied = $this->gate($organization)) {
            return $denied;
        }
        if ($denied = $this->expenseInOrg($expense, $organization)) {
            return $denied;
        }

        $data = $request->validated();

        // A settled expense is a disbursed cash fact (already inside P&L/cashflow) — its money fields
        // are immutable. Only the payment_reference may be corrected; a wrong entry must be reversed via
        // a new adjusting entry, never rewritten (design §cash).
        $moneyFields = ['category', 'amount', 'expense_date', 'payment_method', 'class_id', 'tutor_id', 'paid_at'];
        if ($expense->isSettled() && array_intersect(array_keys($data), $moneyFields) !== []) {
            return $this->errorResponse(
                'Khoản chi đã thanh toán không thể sửa. Hãy tạo khoản bù trừ mới nếu nhập sai.',
                null,
                'EXPENSE_SETTLED',
                409
            );
        }

        // Only forward settlement is allowed: unpaid → settled. Reverting a settled bill would
        // retroactively remove disbursed cash from the reports.
        if (($data['settlement_status'] ?? null) === CenterExpense::SETTLEMENT_UNPAID && $expense->isSettled()) {
            return $this->errorResponse('Không thể chuyển khoản chi đã thanh toán về chưa thanh toán', null, 'EXPENSE_SETTLED', 409);
        }

        if (array_key_exists('class_id', $data)) {
            [$classId, $classError] = $this->resolveOrgClassId($data['class_id'], $organization);
            if ($classError) {
                return $classError;
            }
            $expense->class_id = $classId;
        }
        if (array_key_exists('tutor_id', $data)) {
            [$tutorId, $tutorError] = $this->resolveOrgTutorId($data['tutor_id'], $organization);
            if ($tutorError) {
                return $tutorError;
            }
            $expense->tutor_id = $tutorId;
        }

        foreach (['category', 'amount', 'expense_date', 'description', 'payment_method', 'settlement_status', 'paid_at', 'payment_reference'] as $field) {
            if (array_key_exists($field, $data)) {
                $expense->{$field} = $data[$field];
            }
        }

        // Keep the settlement state self-consistent: recording a payment method settles the bill.
        if ($expense->payment_method && $expense->settlement_status !== CenterExpense::SETTLEMENT_SETTLED) {
            $expense->settlement_status = CenterExpense::SETTLEMENT_SETTLED;
            $expense->paid_at = $expense->paid_at ?? $expense->expense_date;
        }

        $expense->save();

        return $this->successResponse(
            new CenterExpenseResource($expense->load('class')),
            'Cập nhật khoản chi thành công'
        );
    }

    /**
     * DELETE /organizations/{organization}/expenses/{expense} — soft-delete an expense.
     * Only an UNSETTLED (payable) expense may be deleted: a settled one has already moved cash in the
     * reports and must be handled with an adjusting entry instead (design §cash).
     */
    public function destroy(Organization $organization, CenterExpense $expense): JsonResponse
    {
        if ($denied = $this->gate($organization)) {
            return $denied;
        }
        if ($denied = $this->expenseInOrg($expense, $organization)) {
            return $denied;
        }

        if ($expense->isSettled()) {
            return $this->errorResponse(
                'Khoản chi đã thanh toán không thể xóa. Hãy tạo khoản bù trừ mới nếu nhập sai.',
                null,
                'EXPENSE_SETTLED',
                409
            );
        }

        $expense->delete();

        return $this->successResponse(null, 'Xóa khoản chi thành công');
    }

    /**
     * The gate triple (G3): capability → org-role → org-context. Returns the first denial, or null.
     */
    private function gate(Organization $organization): ?JsonResponse
    {
        if ($denied = $this->requirePlanCapability(self::CAPABILITY)) {
            return $denied;
        }
        if ($denied = $this->requireOrgRole(self::ROLES)) {
            return $denied;
        }
        if ($denied = $this->guardOrgContext($organization)) {
            return $denied;
        }

        return null;
    }

    /**
     * A bound {expense} must belong to $organization — otherwise fail CLOSED (404, no existence leak).
     * Keeps accountant-write org-bounded (owner/manager go through orgCanManageResource too).
     */
    private function expenseInOrg(CenterExpense $expense, Organization $organization): ?JsonResponse
    {
        if ((int) $expense->organization_id !== (int) $organization->id) {
            return $this->errorResponse('Không tìm thấy khoản chi', null, 'NOT_FOUND', 404);
        }

        return null;
    }

    /**
     * Decode + org-validate a class hashid. Returns [int|null id, ?JsonResponse error].
     * A class of another org (or a solo class) is rejected as invalid input (422), never accepted.
     */
    private function resolveOrgClassId($hashId, Organization $organization): array
    {
        if ($hashId === null || $hashId === '') {
            return [null, null];
        }

        $classId = ClassRoom::decodeId($hashId);
        $belongs = $classId && ClassRoom::where('id', $classId)
            ->where('organization_id', $organization->id)
            ->exists();

        if (! $belongs) {
            return [null, $this->errorResponse('Lớp học không thuộc tổ chức này', null, 'VALIDATION_ERROR', 422)];
        }

        return [$classId, null];
    }

    /**
     * Decode + org-validate a tutor (member) hashid: must be an ACTIVE member of $organization.
     * Returns [int|null id, ?JsonResponse error].
     */
    private function resolveOrgTutorId($hashId, Organization $organization): array
    {
        if ($hashId === null || $hashId === '') {
            return [null, null];
        }

        $tutorId = User::decodeId($hashId);
        $belongs = $tutorId && in_array((int) $tutorId, array_map('intval', $organization->activeMemberUserIds()), true);

        if (! $belongs) {
            return [null, $this->errorResponse('Gia sư không thuộc tổ chức này', null, 'VALIDATION_ERROR', 422)];
        }

        return [$tutorId, null];
    }
}
