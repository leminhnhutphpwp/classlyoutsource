"use client";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { usePaymentRequests, useDeletePaymentRequest, useUpdatePaymentRequest } from "@/hooks/use-api";
import { formatCurrency } from "@/lib/format-currency";
import { useAuthContext } from "@/contexts/auth-context";
import { hasPermission } from "@/lib/permissions-utils";
import { getObjId } from "@/lib/id-utils";
import {
  PlusIcon,
  CurrencyDollarIcon
} from "@heroicons/react/24/outline";
import ButtonLink from "@/components/Common/ButtonLink";
import { useNotification } from "@/hooks/use-notification";
import { PaymentRequestCard } from "./PaymentRequestCard";

interface PaymentRequestsListProps {
  classId: string;
  onViewClick: (id: string | number) => void;
}

export default function PaymentRequestsList({
  classId,
  onViewClick
}: PaymentRequestsListProps) {
  const { data: paymentRequests, loading, error, refetch, permissions } = usePaymentRequests(classId);
  useDeletePaymentRequest();
  const { mutate: updatePaymentRequest, loading: updating } = useUpdatePaymentRequest();
  const { success, error: showError } = useNotification();
  const { user } = useAuthContext();

  // Check permissions: can_manage from API response OR payment request CRUD permissions
  const canManageFromApi = permissions?.can_manage ?? false;
  const canCreate = hasPermission(user, 'create_payment::request');
  const canUpdate = hasPermission(user, 'update_payment::request');
  const canDelete = hasPermission(user, 'delete_payment::request');

  // User can manage if they have API permission OR any of the CRUD permissions
  const canManage = canManageFromApi || canCreate || canUpdate || canDelete;
  const [confirmDelete, setConfirmDelete] = useState<{ open: boolean; id: string | null; request: any | null }>({
    open: false,
    id: null,
    request: null
  });
  const [confirmActivate, setConfirmActivate] = useState<{ open: boolean; id: string | null; request: any | null }>({
    open: false,
    id: null,
    request: null
  });
  const [confirmDeactivate, setConfirmDeactivate] = useState<{ open: boolean; id: string | null; request: any | null }>({
    open: false,
    id: null,
    request: null
  });

  const anyDialogOpen =
    confirmDelete.open || confirmActivate.open || confirmDeactivate.open;

  useEffect(() => {
    if (!anyDialogOpen) return;

    const previousBodyOverflow = document.body.style.overflow;
    const previousHtmlOverflow = document.documentElement.style.overflow;

    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousBodyOverflow || "";
      document.documentElement.style.overflow = previousHtmlOverflow || "";
    };
  }, [anyDialogOpen]);

  const handleDelete = async (id: string) => {
    // Chuyển trạng thái sang "cancelled" thay vì xóa thật
    const result = await updatePaymentRequest({ id, data: { status: 'cancelled' } });
    if (result.success) {
      success("Đã hủy yêu cầu đóng học phí thành công. Học viên sẽ không thấy yêu cầu này nữa.");
      setConfirmDelete({ open: false, id: null, request: null });
      refetch();
    } else {
      showError(result.message || "Không thể hủy yêu cầu đóng học phí");
    }
  };

  const handleActivate = async (id: string) => {
    const result = await updatePaymentRequest({ id, data: { status: 'active' } });
    if (result.success) {
      success("Kích hoạt yêu cầu đóng học phí thành công");
      setConfirmActivate({ open: false, id: null, request: null });
      refetch();
    } else {
      showError(result.message || "Không thể kích hoạt yêu cầu đóng học phí");
    }
  };

  const handleDeactivate = async (id: string) => {
    const result = await updatePaymentRequest({ id, data: { status: 'pending' } });
    if (result.success) {
      success("Đã hủy kích hoạt yêu cầu đóng học phí. Yêu cầu sẽ chuyển về trạng thái 'Chưa bắt đầu'.");
      setConfirmDeactivate({ open: false, id: null, request: null });
      refetch();
    } else {
      showError(result.message || "Không thể hủy kích hoạt yêu cầu đóng học phí");
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="rounded-lg bg-white p-6 dark:bg-gray-800 animate-pulse">
            <div className="h-6 w-48 rounded bg-gray-200 dark:bg-gray-700 mb-4" />
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[...Array(4)].map((_, j) => (
                <div key={j} className="space-y-2">
                  <div className="h-4 w-24 rounded bg-gray-200 dark:bg-gray-700" />
                  <div className="h-6 w-32 rounded bg-gray-200 dark:bg-gray-700" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg bg-primary-pastel border border-primary/30 p-6 text-primary dark:bg-primary/20 dark:border-primary/40 dark:text-primary-light">
        <h3 className="font-medium mb-2">Lỗi tải dữ liệu</h3>
        <p>{error}</p>
      </div>
    );
  }

  if (!paymentRequests || paymentRequests.length === 0) {
    return (
      <div className="rounded-lg bg-white p-8 text-center dark:bg-gray-800">
        <div className="mx-auto w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mb-4">
          <CurrencyDollarIcon className="h-8 w-8 text-gray-400" />
        </div>
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
          Chưa có yêu cầu đóng học phí nào
        </h3>
        <p className="text-gray-500 dark:text-gray-400 mb-6">
          Bắt đầu bằng cách tạo yêu cầu đóng học phí đầu tiên
        </p>
        {canManage && (
          <ButtonLink
            href={`/classes/${classId}/payment-requests/create`}
            variant="primary"
            size="sm"
            icon={<PlusIcon />}
          >
            Tạo yêu cầu đóng học phí
          </ButtonLink>
        )}
      </div>
    );
  }

  const activateDialog =
    confirmActivate.open && confirmActivate.request
      ? (
        <div
          className="fixed inset-0 flex items-center justify-center z-[1000] bg-black/50 backdrop-blur-[1px] p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-activate-title"
        >
          <div className="bg-white dark:bg-gray-800 rounded-xl max-w-md w-full p-6 shadow-lg border border-gray-200 dark:border-gray-700">
            <h3
              id="confirm-activate-title"
              className="text-lg font-semibold text-gray-900 dark:text-white mb-4"
            >
              Xác nhận kích hoạt
            </h3>
            <div className="mb-4 space-y-2">
              {confirmActivate.request.class?.name && (
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  <span className="font-medium">Lớp học:</span> {confirmActivate.request.class.name}
                </p>
              )}
              <p className="text-sm text-gray-600 dark:text-gray-400">
                <span className="font-medium">Tên đợt:</span> {confirmActivate.request.period_name}
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                <span className="font-medium">Số tiền/học viên:</span> {confirmActivate.request.amount_per_student_formatted || formatCurrency(confirmActivate.request.amount_per_student || 0)}
              </p>
              {confirmActivate.request.due_date && (
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  <span className="font-medium">Hạn đóng:</span> {new Date(confirmActivate.request.due_date).toLocaleDateString('vi-VN')}
                </p>
              )}
            </div>
            <p className="text-gray-700 dark:text-gray-300 mb-6">
              Sau khi kích hoạt, học viên sẽ có thể thấy và đóng học phí.
            </p>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setConfirmActivate({ open: false, id: null, request: null })}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:bg-gray-800 dark:hover:bg-gray-700"
                disabled={updating}
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={() => {
                  if (confirmActivate.id) {
                    handleActivate(confirmActivate.id);
                  }
                }}
                disabled={updating}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-60 dark:bg-red-500 dark:hover:bg-red-600"
              >
                {updating ? "Đang xử lý..." : "Xác nhận"}
              </button>
            </div>
          </div>
        </div>
      )
      : null;

  const deactivateDialog =
    confirmDeactivate.open && confirmDeactivate.request
      ? (
        <div
          className="fixed inset-0 flex items-center justify-center z-[1000] bg-black/50 backdrop-blur-[1px] p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-deactivate-title"
        >
          <div className="bg-white dark:bg-gray-800 rounded-xl max-w-md w-full p-6 shadow-lg border border-gray-200 dark:border-gray-700">
            <h3
              id="confirm-deactivate-title"
              className="text-lg font-semibold text-gray-900 dark:text-white mb-4"
            >
              Xác nhận hủy kích hoạt
            </h3>
            <div className="mb-4 space-y-2">
              {confirmDeactivate.request.class?.name && (
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  <span className="font-medium">Lớp học:</span> {confirmDeactivate.request.class.name}
                </p>
              )}
              <p className="text-sm text-gray-600 dark:text-gray-400">
                <span className="font-medium">Tên đợt:</span> {confirmDeactivate.request.period_name}
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                <span className="font-medium">Số tiền/học viên:</span> {confirmDeactivate.request.amount_per_student_formatted || formatCurrency(confirmDeactivate.request.amount_per_student || 0)}
              </p>
              {confirmDeactivate.request.due_date && (
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  <span className="font-medium">Hạn đóng:</span> {new Date(confirmDeactivate.request.due_date).toLocaleDateString('vi-VN')}
                </p>
              )}
            </div>
            <p className="text-gray-700 dark:text-gray-300 mb-6">
              Yêu cầu sẽ chuyển về trạng thái &quot;Chưa bắt đầu&quot; và học viên sẽ không thể thấy yêu cầu này nữa.
            </p>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setConfirmDeactivate({ open: false, id: null, request: null })}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:bg-gray-800 dark:hover:bg-gray-700"
                disabled={updating}
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={() => {
                  if (confirmDeactivate.id) {
                    handleDeactivate(confirmDeactivate.id);
                  }
                }}
                disabled={updating}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-60 dark:bg-red-500 dark:hover:bg-red-600"
              >
                {updating ? "Đang xử lý..." : "Xác nhận"}
              </button>
            </div>
          </div>
        </div>
      )
      : null;

  const deleteDialog =
    confirmDelete.open && confirmDelete.request
      ? (
        <div
          className="fixed inset-0 flex items-center justify-center z-[1000] bg-black/50 backdrop-blur-[1px] p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-delete-request-title"
        >
          <div className="bg-white dark:bg-gray-800 rounded-xl max-w-md w-full p-6 shadow-lg border border-gray-200 dark:border-gray-700">
            <h3
              id="confirm-delete-request-title"
              className="text-lg font-semibold text-gray-900 dark:text-white mb-4"
            >
              Xác nhận hủy
            </h3>
            <div className="mb-4 space-y-2">
              {confirmDelete.request.class?.name && (
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  <span className="font-medium">Lớp học:</span> {confirmDelete.request.class.name}
                </p>
              )}
              <p className="text-sm text-gray-600 dark:text-gray-400">
                <span className="font-medium">Tên đợt:</span> {confirmDelete.request.period_name}
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                <span className="font-medium">Số tiền/học viên:</span> {confirmDelete.request.amount_per_student_formatted || formatCurrency(confirmDelete.request.amount_per_student || 0)}
              </p>
              {confirmDelete.request.due_date && (
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  <span className="font-medium">Hạn đóng:</span> {new Date(confirmDelete.request.due_date).toLocaleDateString('vi-VN')}
                </p>
              )}
            </div>
            <p className="text-gray-700 dark:text-gray-300 mb-6">
              Yêu cầu sẽ chuyển sang trạng thái &quot;Đã hủy&quot; và học viên sẽ không thấy yêu cầu này nữa.
            </p>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setConfirmDelete({ open: false, id: null, request: null })}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:bg-gray-800 dark:hover:bg-gray-700"
                disabled={updating}
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={() => {
                  if (confirmDelete.id && confirmDelete.request) {
                    handleDelete(confirmDelete.id);
                  }
                }}
                disabled={updating}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-dark disabled:opacity-60"
              >
                {updating ? "Đang xử lý..." : "Xác nhận hủy"}
              </button>
            </div>
          </div>
        </div>
      )
      : null;

  return (
    <>
      {activateDialog && createPortal(activateDialog, document.body)}
      {deactivateDialog && createPortal(deactivateDialog, document.body)}
      {deleteDialog && createPortal(deleteDialog, document.body)}

      <div className="space-y-4">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">
              Yêu cầu đóng học phí
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Quản lý các đợt đóng học phí của lớp học
            </p>
          </div>
          {canManage && (
            <ButtonLink
              href={`/classes/${classId}/payment-requests/create`}
              variant="primary"
              size="sm"
              icon={<PlusIcon />}
            >
              Tạo yêu cầu đóng học phí
            </ButtonLink>
          )}
        </div>

        {/* Payment Requests List */}
        <div className="space-y-4">
          {paymentRequests.map((request: any) => (
            <PaymentRequestCard
              key={getObjId(request)}
              request={request}
              canManage={canManage}
              onViewClick={onViewClick}
              onActivate={(id: string | number) =>
                setConfirmActivate({ open: true, id: String(id), request })
              }
              onDeactivate={(id: string | number) =>
                setConfirmDeactivate({ open: true, id: String(id), request })
              }
              onDelete={(id: string | number) =>
                setConfirmDelete({ open: true, id: String(id), request })
              }
            />
          ))}
        </div>
      </div>
    </>
  );
}

