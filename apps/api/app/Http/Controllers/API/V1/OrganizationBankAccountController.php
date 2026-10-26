<?php

namespace App\Http\Controllers\API\V1;

use App\Models\Organization;
use App\Models\OrganizationBankAccount;
use App\Support\VietQrBank;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;

class OrganizationBankAccountController extends BaseController
{
    /**
     * Lấy danh sách tài khoản ngân hàng của tổ chức hiện tại.
     */
    public function index(Request $request): JsonResponse
    {
        $user = $this->getAuthUser();
        if (! $user) {
            return $this->errorResponse('Chưa xác thực', null, 'UNAUTHENTICATED', 401);
        }

        $organization = $user->currentOrganization();
        if (! $organization) {
            return $this->errorResponse('Không tìm thấy tổ chức', null, 'ORG_NOT_FOUND', 404);
        }

        // Chỉ owner/manager mới được quản lý tài khoản ngân hàng
        if (! $user->isOrgOwner() && ! $user->isOrgManager()) {
            return $this->errorResponse('Bạn không có quyền quản lý tài khoản ngân hàng của tổ chức', null, 'FORBIDDEN', 403);
        }

        $accounts = $organization->bankAccounts()->orderBy('id')->get();

        return $this->successResponse($accounts, 'Lấy danh sách tài khoản thành công');
    }

    /**
     * Tạo tài khoản ngân hàng mới cho tổ chức.
     */
    public function store(Request $request): JsonResponse
    {
        $user = $this->getAuthUser();
        if (! $user) {
            return $this->errorResponse('Chưa xác thực', null, 'UNAUTHENTICATED', 401);
        }

        $organization = $user->currentOrganization();
        if (! $organization) {
            return $this->errorResponse('Không tìm thấy tổ chức', null, 'ORG_NOT_FOUND', 404);
        }

        if (! $user->isOrgOwner() && ! $user->isOrgManager()) {
            return $this->errorResponse('Bạn không có quyền quản lý tài khoản ngân hàng của tổ chức', null, 'FORBIDDEN', 403);
        }

        $validator = Validator::make($request->all(), [
            'bank_name' => ['required', 'string', 'max:255', function ($attribute, $value, $fail) {
                if (VietQrBank::codeFor((string) $value) === null) {
                    $fail('Ngân hàng không hợp lệ. Vui lòng chọn ngân hàng trong danh sách.');
                }
            }],
            'account_number' => 'required|string|max:50',
            'account_name' => 'required|string|max:255',
            'branch' => 'nullable|string|max:255',
            'memo' => 'nullable|string|max:255',
            'is_default' => 'nullable|boolean',
        ]);

        if ($validator->fails()) {
            return $this->errorResponse('Lỗi xác thực dữ liệu', $validator, 'VALIDATION_ERROR', 422);
        }

        // Normalize
        $bankName = VietQrBank::canonicalName($request->bank_name) ?? $request->bank_name;
        $accountNumber = preg_replace('/\s+/', '', (string) $request->account_number);
        $accountName = trim((string) $request->account_name);
        $branch = $request->branch ? trim((string) $request->branch) : null;
        $memo = $request->memo ? trim((string) $request->memo) : null;
        $isDefault = (bool) $request->input('is_default', false);

        // Nếu đặt là default, xóa default cũ
        if ($isDefault) {
            OrganizationBankAccount::where('organization_id', $organization->id)
                ->where('is_default', true)
                ->update(['is_default' => false]);
        } else {
            // Nếu chưa có tài khoản nào, tự động đặt làm default
            $count = OrganizationBankAccount::where('organization_id', $organization->id)->count();
            if ($count === 0) {
                $isDefault = true;
            }
        }

        $account = OrganizationBankAccount::create([
            'organization_id' => $organization->id,
            'bank_name' => $bankName,
            'account_number' => $accountNumber,
            'account_name' => $accountName,
            'branch' => $branch,
            'memo' => $memo,
            'is_default' => $isDefault,
        ]);

        return $this->successResponse($account, 'Tạo tài khoản ngân hàng thành công', 201);
    }

    /**
     * Cập nhật tài khoản ngân hàng.
     */
    public function update(Request $request, $id): JsonResponse
    {
        $user = $this->getAuthUser();
        if (! $user) {
            return $this->errorResponse('Chưa xác thực', null, 'UNAUTHENTICATED', 401);
        }

        $organization = $user->currentOrganization();
        if (! $organization) {
            return $this->errorResponse('Không tìm thấy tổ chức', null, 'ORG_NOT_FOUND', 404);
        }

        if (! $user->isOrgOwner() && ! $user->isOrgManager()) {
            return $this->errorResponse('Bạn không có quyền quản lý tài khoản ngân hàng của tổ chức', null, 'FORBIDDEN', 403);
        }

        $account = OrganizationBankAccount::where('organization_id', $organization->id)
            ->where('id', $id)
            ->first();

        if (! $account) {
            return $this->errorResponse('Không tìm thấy tài khoản ngân hàng', null, 'NOT_FOUND', 404);
        }

        $validator = Validator::make($request->all(), [
            'bank_name' => ['sometimes', 'string', 'max:255', function ($attribute, $value, $fail) {
                if (VietQrBank::codeFor((string) $value) === null) {
                    $fail('Ngân hàng không hợp lệ. Vui lòng chọn ngân hàng trong danh sách.');
                }
            }],
            'account_number' => 'sometimes|string|max:50',
            'account_name' => 'sometimes|string|max:255',
            'branch' => 'nullable|string|max:255',
            'memo' => 'nullable|string|max:255',
            'is_default' => 'nullable|boolean',
        ]);

        if ($validator->fails()) {
            return $this->errorResponse('Lỗi xác thực dữ liệu', $validator, 'VALIDATION_ERROR', 422);
        }

        $data = [];
        if ($request->has('bank_name')) {
            $data['bank_name'] = VietQrBank::canonicalName($request->bank_name) ?? $request->bank_name;
        }
        if ($request->has('account_number')) {
            $data['account_number'] = preg_replace('/\s+/', '', (string) $request->account_number);
        }
        if ($request->has('account_name')) {
            $data['account_name'] = trim((string) $request->account_name);
        }
        if ($request->has('branch')) {
            $data['branch'] = $request->branch ? trim((string) $request->branch) : null;
        }
        if ($request->has('memo')) {
            $data['memo'] = $request->memo ? trim((string) $request->memo) : null;
        }

        if ($request->has('is_default')) {
            $isDefault = (bool) $request->is_default;
            if ($isDefault && ! $account->is_default) {
                // Xóa default cũ
                OrganizationBankAccount::where('organization_id', $organization->id)
                    ->where('is_default', true)
                    ->update(['is_default' => false]);
            }
            $data['is_default'] = $isDefault;
        }

        $account->update($data);

        return $this->successResponse($account, 'Cập nhật tài khoản ngân hàng thành công');
    }

    /**
     * Xóa tài khoản ngân hàng.
     */
    public function destroy(Request $request, $id): JsonResponse
    {
        $user = $this->getAuthUser();
        if (! $user) {
            return $this->errorResponse('Chưa xác thực', null, 'UNAUTHENTICATED', 401);
        }

        $organization = $user->currentOrganization();
        if (! $organization) {
            return $this->errorResponse('Không tìm thấy tổ chức', null, 'ORG_NOT_FOUND', 404);
        }

        if (! $user->isOrgOwner() && ! $user->isOrgManager()) {
            return $this->errorResponse('Bạn không có quyền quản lý tài khoản ngân hàng của tổ chức', null, 'FORBIDDEN', 403);
        }

        $account = OrganizationBankAccount::where('organization_id', $organization->id)
            ->where('id', $id)
            ->first();

        if (! $account) {
            return $this->errorResponse('Không tìm thấy tài khoản ngân hàng', null, 'NOT_FOUND', 404);
        }

        // Nếu xóa tài khoản default, chọn một tài khoản khác làm default
        $wasDefault = $account->is_default;

        $account->delete();

        if ($wasDefault) {
            $nextDefault = OrganizationBankAccount::where('organization_id', $organization->id)
                ->orderBy('id')
                ->first();
            if ($nextDefault) {
                $nextDefault->update(['is_default' => true]);
            }
        }

        return $this->successResponse(null, 'Xóa tài khoản ngân hàng thành công');
    }

    /**
     * Đặt một tài khoản làm mặc định.
     */
    public function setDefault(Request $request, $id): JsonResponse
    {
        $user = $this->getAuthUser();
        if (! $user) {
            return $this->errorResponse('Chưa xác thực', null, 'UNAUTHENTICATED', 401);
        }

        $organization = $user->currentOrganization();
        if (! $organization) {
            return $this->errorResponse('Không tìm thấy tổ chức', null, 'ORG_NOT_FOUND', 404);
        }

        if (! $user->isOrgOwner() && ! $user->isOrgManager()) {
            return $this->errorResponse('Bạn không có quyền quản lý tài khoản ngân hàng của tổ chức', null, 'FORBIDDEN', 403);
        }

        $account = OrganizationBankAccount::where('organization_id', $organization->id)
            ->where('id', $id)
            ->first();

        if (! $account) {
            return $this->errorResponse('Không tìm thấy tài khoản ngân hàng', null, 'NOT_FOUND', 404);
        }

        DB::transaction(function () use ($organization, $account) {
            OrganizationBankAccount::where('organization_id', $organization->id)
                ->where('is_default', true)
                ->update(['is_default' => false]);

            $account->update(['is_default' => true]);
        });

        return $this->successResponse($account, 'Đặt tài khoản mặc định thành công');
    }
}