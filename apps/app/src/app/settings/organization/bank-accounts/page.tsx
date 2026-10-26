"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useAuthContext } from "@/contexts/auth-context";
import { useOrganizationContext } from "@/contexts/organization-context";
import { useNotification } from "@/hooks/use-notification";
import Button from "@/components/Common/Button";
import InputGroup from "@/components/FormElements/InputGroup";
import SelectInput from "@/components/FormElements/SelectInput";
import { Switch } from "@/components/FormElements/switch";
import ProtectedRoute from "@/components/Auth/ProtectedRoute";
import FormModal from "@/components/Common/FormModal";
import ConfirmDeleteDialog from "@/components/Common/ConfirmDeleteDialog";
import { CardSkeleton } from "@/components/ui/loading";
import { Skeleton } from "@/components/ui/skeleton";
import { StatCard } from "@/app/organization/_components/finance-ui";
import { apiClient } from "@/lib/api-client";
import type { ApiResponse } from "@/lib/api-config";
import { VIETQR_BANKS, codeForBank } from "@/lib/vietqr-banks";
import PaymentQRCode from "@/components/Common/PaymentQRCode";
import {
  PlusIcon,
  PencilSquareIcon,
  TrashIcon,
  CheckCircleIcon,
  DocumentDuplicateIcon,
  BanknotesIcon,
  CreditCardIcon,
  UserIcon,
  MapPinIcon,
  HashtagIcon,
  QrCodeIcon,
} from "@heroicons/react/24/outline";

type BankAccount = {
  id: number;
  bank_name: string;
  account_number: string;
  account_name: string;
  branch: string | null;
  memo: string | null;
  is_default: boolean;
  created_at: string;
  updated_at: string;
};

const EMPTY_FORM = {
  bank_name: "",
  account_number: "",
  account_name: "",
  branch: "",
  memo: "",
  is_default: false,
};

/* ------------------------------------------------------------------ */
/* Tiện ích hiển thị ngân hàng                                         */
/* ------------------------------------------------------------------ */

/** Màu thương hiệu gần đúng của các ngân hàng phổ biến; chưa có thì suy ra từ tên. */
const BANK_BRAND_COLORS: Record<string, string> = {
  Vietcombank: "#005BA9",
  Techcombank: "#00447C",
  MBBank: "#E30613",
  ACB: "#1F3864",
  VPBank: "#F15A29",
  TPBank: "#F58220",
  BIDV: "#00535C",
  VietinBank: "#E30613",
  Agribank: "#007A33",
  Sacombank: "#E30613",
  HDBank: "#ED1B2F",
  VIB: "#008C8C",
  MSB: "#F39200",
  SHB: "#009FE3",
  SeABank: "#E4002B",
  OCB: "#F7941D",
  Eximbank: "#005BA9",
  LienVietPostBank: "#005BAC",
  "Nam A Bank": "#004C97",
  VietBank: "#E4002B",
  BaoVietBank: "#0072BC",
  SaigonBank: "#E30613",
  "PG Bank": "#F58220",
  KienLongBank: "#00A650",
  VietABank: "#00A2E8",
  OceanBank: "#004A99",
  DongABank: "#E60012",
  "Woori Bank": "#003DA5",
  CBBank: "#F58220",
  PublicBank: "#C8102E",
};

function bankBrandColor(name: string): string {
  const known = BANK_BRAND_COLORS[name];
  if (known) return known;
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  }
  return `hsl(${hash % 360} 65% 42%)`;
}

function bankInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

/** Gom số tài khoản thành cụm 4 chữ số để dễ đọc. */
function formatAccountNumber(value: string): string {
  return value
    .replace(/\D/g, "")
    .replace(/(.{4})/g, "$1 ")
    .trim()
    .slice(0, 23);
}

export default function OrganizationBankAccountsPage() {
  const { isAuthenticated, loading: authLoading } = useAuthContext();
  const { canManageOrg, loading: orgLoading } = useOrganizationContext();
  const router = useRouter();
  const { success, error: showError } = useNotification();

  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<BankAccount | null>(null);
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<BankAccount | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [settingDefaultId, setSettingDefaultId] = useState<number | null>(null);
  const [qrModalOpen, setQrModalOpen] = useState(false);
  const [qrAccount, setQrAccount] = useState<BankAccount | null>(null);
  const [qrAmount, setQrAmount] = useState<string>("");
  const [qrContent, setQrContent] = useState<string>("");

  const fetchAccounts = useCallback(async () => {
    setLoading(true);
    try {
      const response = await apiClient.makeRequest<BankAccount[]>(
        "/api/organizations/current/bank-accounts"
      );
      if (response.success) {
        setAccounts(Array.isArray(response.data) ? response.data : []);
      } else {
        showError("Không thể tải danh sách tài khoản", response.message);
      }
    } catch (err: any) {
      showError("Có lỗi xảy ra", err?.message);
    } finally {
      setLoading(false);
    }
  }, [showError]);

  // Chỉ owner/manager mới được vào; chưa xác định quyền thì chờ.
  useEffect(() => {
    if (authLoading || orgLoading) return;
    if (!isAuthenticated) {
      router.replace("/auth/sign-in");
      return;
    }
    if (!canManageOrg) {
      router.replace("/dashboard");
      return;
    }
    fetchAccounts();
  }, [authLoading, orgLoading, isAuthenticated, canManageOrg, router, fetchAccounts]);

  const defaultAccount = accounts.find((a) => a.is_default) || null;
  const uniqueBanks = useMemo(
    () => new Set(accounts.map((a) => a.bank_name)).size,
    [accounts]
  );

  /** Tên ngân hàng trong danh sách chuẩn; nếu tài khoản cũ lưu tên lạ thì vẫn hiển thị được. */
  const bankOptions = useMemo(() => {
    const opts = VIETQR_BANKS.map((b) => ({ label: b.name, value: b.name }));
    if (formData.bank_name && !VIETQR_BANKS.some((b) => b.name === formData.bank_name)) {
      opts.unshift({ label: formData.bank_name, value: formData.bank_name });
    }
    return opts;
  }, [formData.bank_name]);

  const handleCopy = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      success(`Đã sao chép ${label}`);
    } catch {
      showError("Không thể sao chép", "Trình duyệt không cho phép sao chép.");
    }
  };

  const openCreateModal = () => {
    setEditingAccount(null);
    setFormData(EMPTY_FORM);
    setIsModalOpen(true);
  };

  const openEditModal = (account: BankAccount) => {
    setEditingAccount(account);
    setFormData({
      bank_name: account.bank_name,
      account_number: formatAccountNumber(account.account_number),
      account_name: account.account_name,
      branch: account.branch || "",
      memo: account.memo || "",
      is_default: account.is_default,
    });
    setIsModalOpen(true);
  };

  const closeModal = () => {
    if (submitting) return;
    setIsModalOpen(false);
    setEditingAccount(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate bank name
    if (!codeForBank(formData.bank_name)) {
      showError("Ngân hàng không hợp lệ", "Vui lòng chọn ngân hàng trong danh sách gợi ý.");
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        bank_name: formData.bank_name,
        account_number: formData.account_number.replace(/\s/g, ""),
        account_name: formData.account_name,
        branch: formData.branch || null,
        memo: formData.memo.trim() || null,
        is_default: formData.is_default,
      };

      let response: ApiResponse<BankAccount>;
      if (editingAccount) {
        response = await apiClient.makeRequest<BankAccount>(
          `/api/organizations/current/bank-accounts/${editingAccount.id}`,
          { method: "PUT", body: JSON.stringify(payload) }
        );
      } else {
        response = await apiClient.makeRequest<BankAccount>(
          "/api/organizations/current/bank-accounts",
          { method: "POST", body: JSON.stringify(payload) }
        );
      }

      if (response.success) {
        success(editingAccount ? "Cập nhật tài khoản thành công!" : "Thêm tài khoản thành công!");
        closeModal();
        fetchAccounts();
      } else {
        showError("Không thể lưu tài khoản", response.message);
      }
    } catch (err: any) {
      showError("Có lỗi xảy ra", err?.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;

    setDeleting(true);
    try {
      const response = await apiClient.makeRequest<null>(
        `/api/organizations/current/bank-accounts/${deleteTarget.id}`,
        { method: "DELETE" }
      );
      if (response.success) {
        success("Xóa tài khoản thành công!");
        setDeleteTarget(null);
        fetchAccounts();
      } else {
        showError("Không thể xóa tài khoản", response.message);
      }
    } catch (err: any) {
      showError("Có lỗi xảy ra", err?.message);
    } finally {
      setDeleting(false);
    }
  };

  const handleSetDefault = async (id: number) => {
    setSettingDefaultId(id);
    try {
      const response = await apiClient.makeRequest<BankAccount>(
        `/api/organizations/current/bank-accounts/${id}/set-default`,
        { method: "POST" }
      );
      if (response.success) {
        success("Đặt tài khoản mặc định thành công!");
        fetchAccounts();
      } else {
        showError("Không thể đặt tài khoản mặc định", response.message);
      }
    } catch (err: any) {
      showError("Có lỗi xảy ra", err?.message);
    } finally {
      setSettingDefaultId(null);
    }
  };

  const openQrModal = (account: BankAccount) => {
    setQrAccount(account);
    setQrAmount("");
    setQrContent(account.memo || "Chuyển khoản học phí");
    setQrModalOpen(true);
  };

  /** URL QR xem trước trên thẻ (không gộp amount/content — nhẹ, hiện nhanh). */
  const qrThumbUrl = (account: BankAccount): string | null => {
    const code = codeForBank(account.bank_name);
    if (!code) return null;
    return `https://img.vietqr.io/image/${code}-${account.account_number.replace(/\s/g, "")}-compact.jpg`;
  };

  /**
   * Tải QR: qua route proxy same-origin (/api/vietqr) — route đó trả về kèm
   * Content-Disposition: attachment nên trình duyệt TẢI XUỐNG thẳng, không mở tab mới.
   * (Không fetch thẳng img.vietqr.io từ client vì CSP `connect-src` của app chặn.)
   */
  const handleDownloadQr = () => {
    if (!qrAccount) return;
    const code = codeForBank(qrAccount.bank_name);
    if (!code) {
      showError("Không tải được mã QR", "Ngân hàng này chưa có trong danh sách VietQR.");
      return;
    }

    const account = qrAccount.account_number.replace(/\s/g, "");
    const params = new URLSearchParams({ code, account });
    if (qrAmount) params.set("amount", qrAmount);
    if (qrContent) params.set("content", qrContent);

    const a = document.createElement("a");
    a.href = `/api/vietqr?${params.toString()}`;
    a.download = `qr-${code.toLowerCase()}-${account}.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    success("Đang tải mã QR về máy...");
  };

  if (authLoading || orgLoading) {
    return (
      <ProtectedRoute>
        <div className="space-y-4 sm:space-y-6">
          <div className="flex items-center justify-between">
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-[41px] w-36 rounded-lg" />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Skeleton className="h-24 rounded-lg" />
            <Skeleton className="h-24 rounded-lg" />
            <Skeleton className="h-24 rounded-lg" />
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <CardSkeleton lines={3} />
            <CardSkeleton lines={3} />
          </div>
        </div>
      </ProtectedRoute>
    );
  }

  if (!isAuthenticated || !canManageOrg) {
    return null;
  }

  return (
    <ProtectedRoute>
      <div className="space-y-4 sm:space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
          <div className="min-w-0 flex-1">
            <h1 className="flex items-center gap-2 text-xl font-bold text-dark dark:text-white sm:text-2xl">
              <BanknotesIcon className="h-6 w-6 text-primary" />
              Tài khoản ngân hàng
            </h1>
            <p className="mt-1 text-dark-4 dark:text-dark-6">
              Tài khoản trung tâm dùng để nhận học phí chuyển khoản từ học viên
            </p>
          </div>
          <Button
            onClick={openCreateModal}
            size="sm"
            icon={<PlusIcon />}
            className="w-full justify-center sm:w-auto"
          >
            Thêm tài khoản
          </Button>
        </div>

        {/* Tóm tắt */}
        {!loading && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <StatCard label="Tổng tài khoản" value={accounts.length} />
            <StatCard
              label="Tài khoản mặc định"
              value={defaultAccount ? defaultAccount.bank_name : "Chưa đặt"}
              valueClass={
                defaultAccount ? "text-primary" : "text-gray-400 dark:text-gray-500"
              }
              hint="Học viên thấy tài khoản này đầu tiên"
            />
            <StatCard label="Ngân hàng liên kết" value={uniqueBanks} />
          </div>
        )}

        {loading ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <CardSkeleton lines={3} />
            <CardSkeleton lines={3} />
          </div>
        ) : accounts.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-300 bg-white px-6 py-14 text-center dark:border-gray-700 dark:bg-gray-800">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary-pastel/60 dark:bg-primary/20">
              <CreditCardIcon className="h-7 w-7 text-primary" />
            </div>
            <h3 className="mt-4 text-base font-semibold text-gray-900 dark:text-white">
              Chưa có tài khoản ngân hàng
            </h3>
            <p className="mt-1 max-w-sm text-sm text-gray-500 dark:text-gray-400">
              Thêm tài khoản để học viên chuyển khoản học phí về trung tâm. Tài khoản
              đầu tiên sẽ tự động được đặt làm mặc định.
            </p>
            <Button
              onClick={openCreateModal}
              size="sm"
              icon={<PlusIcon />}
              className="mt-6"
            >
              Thêm tài khoản
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {accounts.map((account) => {
              const brand = bankBrandColor(account.bank_name);
              return (
                <div
                  key={account.id}
                  className={`overflow-hidden rounded-xl border bg-white shadow-sm dark:bg-gray-800 ${
                    account.is_default
                      ? "border-primary/50 ring-1 ring-primary/20 dark:border-primary/60"
                      : "border-gray-200 dark:border-gray-700"
                  }`}
                >
                  {/* Dải màu thương hiệu ngân hàng */}
                  <div
                    className="relative px-5 pb-5 pt-5"
                    style={{ backgroundColor: brand }}
                  >
                    <div className="absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-black/25" />
                    <div className="relative flex items-center gap-3">
                      <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-white/20 text-sm font-bold text-white ring-1 ring-white/30">
                        {bankInitials(account.bank_name)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className="truncate text-base font-semibold text-white">
                          {account.bank_name}
                        </h3>
                        <p className="truncate text-xs text-white/80">
                          {account.branch || "Tài khoản nhận học phí"}
                        </p>
                      </div>
                      {account.is_default && (
                        <span className="inline-flex flex-shrink-0 items-center gap-1 rounded-full bg-white/90 px-2.5 py-1 text-xs font-semibold text-gray-900 shadow-sm">
                          <CheckCircleIcon className="h-3.5 w-3.5 text-green-600" />
                          Mặc định
                        </span>
                      )}
                    </div>
                    <div className="relative mt-4">
                      <p className="text-[10px] font-medium uppercase tracking-wider text-white/70">
                        Số tài khoản
                      </p>
                      <div className="mt-0.5 flex items-center gap-2">
                        <p className="truncate font-mono text-lg font-semibold tracking-widest text-white">
                          {formatAccountNumber(account.account_number)}
                        </p>
                        <button
                          type="button"
                          onClick={() =>
                            handleCopy(
                              account.account_number.replace(/\s/g, ""),
                              "số tài khoản"
                            )
                          }
                          className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md bg-white/15 text-white transition-colors hover:bg-white/25"
                          title="Sao chép số tài khoản"
                          aria-label="Sao chép số tài khoản"
                        >
                          <DocumentDuplicateIcon className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Chi tiết + thao tác */}
                  <div className="space-y-3 px-5 py-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          Chủ tài khoản
                        </p>
                        <p className="mt-0.5 truncate text-sm font-medium text-gray-900 dark:text-white">
                          {account.account_name}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleCopy(account.account_name, "tên chủ tài khoản")}
                        className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md text-gray-400 transition-colors hover:bg-gray-100 hover:text-primary dark:hover:bg-gray-700"
                        title="Sao chép tên chủ tài khoản"
                        aria-label="Sao chép tên chủ tài khoản"
                      >
                        <DocumentDuplicateIcon className="h-4 w-4" />
                      </button>
                    </div>

                    {account.branch && (
                      <div className="flex items-start gap-2">
                        <MapPinIcon className="mt-0.5 h-4 w-4 flex-shrink-0 text-gray-400" />
                        <div className="min-w-0">
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            Chi nhánh
                          </p>
                          <p className="mt-0.5 text-sm text-gray-700 dark:text-gray-300">
                            {account.branch}
                          </p>
                        </div>
                      </div>
                    )}

                    {account.memo && (
                      <div className="flex items-start gap-2">
                        <HashtagIcon className="mt-0.5 h-4 w-4 flex-shrink-0 text-gray-400" />
                        <div className="min-w-0">
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            Mã gợi nhớ
                          </p>
                          <p className="mt-0.5 truncate font-mono text-sm text-gray-700 dark:text-gray-300">
                            {account.memo}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleCopy(account.memo!, "mã gợi nhớ")}
                          className="ml-auto flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md text-gray-400 transition-colors hover:bg-gray-100 hover:text-primary dark:hover:bg-gray-700"
                          title="Sao chép mã gợi nhớ"
                          aria-label="Sao chép mã gợi nhớ"
                        >
                          <DocumentDuplicateIcon className="h-4 w-4" />
                        </button>
                      </div>
                    )}

                    <div className="flex flex-wrap items-center gap-2 border-t border-gray-100 pt-3 dark:border-gray-700">
                      {qrThumbUrl(account) && (
                        <button
                          type="button"
                          onClick={() => openQrModal(account)}
                          className="relative h-11 w-11 flex-shrink-0 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm transition-transform hover:scale-105 dark:border-gray-600"
                          title="Xem mã QR chuyển khoản"
                          aria-label={`Xem mã QR cho ${account.bank_name}`}
                        >
                          <img
                            src={qrThumbUrl(account)!}
                            alt={`Mã QR ${account.bank_name}`}
                            className="h-full w-full object-cover"
                          />
                        </button>
                      )}
                      {!account.is_default && (
                        <Button
                          variant="outline"
                          size="sm"
                          icon={<CheckCircleIcon />}
                          onClick={() => handleSetDefault(account.id)}
                          loading={settingDefaultId === account.id}
                          aria-label={`Đặt ${account.bank_name} làm mặc định`}
                        >
                          Đặt mặc định
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        icon={<PencilSquareIcon />}
                        onClick={() => openEditModal(account)}
                        aria-label={`Sửa tài khoản ${account.bank_name}`}
                      >
                        Sửa
                      </Button>
                      <Button
                        variant="danger"
                        size="sm"
                        icon={<TrashIcon />}
                        onClick={() => setDeleteTarget(account)}
                        aria-label={`Xóa tài khoản ${account.bank_name}`}
                      >
                        Xóa
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal thêm/sửa — FormModal chuẩn (portal + z-[1000], đè được header) */}
      {isModalOpen && (
        <FormModal
          title={editingAccount ? "Sửa tài khoản ngân hàng" : "Thêm tài khoản ngân hàng"}
          onClose={closeModal}
          closeDisabled={submitting}
          size="lg"
        >
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <SelectInput
                  label="Tên ngân hàng"
                  name="bank_name"
                  options={bankOptions}
                  value={formData.bank_name}
                  onChange={(e) =>
                    setFormData({ ...formData, bank_name: String(e.target.value) })
                  }
                  placeholder="Chọn ngân hàng..."
                  required
                  searchable
                />
              </div>

              <InputGroup
                label="Số tài khoản"
                type="text"
                value={formData.account_number}
                handleChange={(e) =>
                  setFormData({
                    ...formData,
                    account_number: formatAccountNumber(e.target.value),
                  })
                }
                placeholder="VD: 1234 5678 90"
                required
                icon={<HashtagIcon />}
                inputProps={{
                  inputMode: "numeric",
                  maxLength: 23,
                  autoComplete: "off",
                }}
              />

              <InputGroup
                label="Chủ tài khoản"
                type="text"
                value={formData.account_name}
                handleChange={(e) =>
                  setFormData({ ...formData, account_name: e.target.value })
                }
                placeholder="VD: TRUNG TAM GIA SU TRI TUE"
                required
                icon={<UserIcon />}
              />

              <div className="sm:col-span-2">
                <InputGroup
                  label="Chi nhánh"
                  type="text"
                  value={formData.branch}
                  handleChange={(e) => setFormData({ ...formData, branch: e.target.value })}
                  placeholder="VD: Chi nhánh Hà Nội"
                  icon={<MapPinIcon />}
                />
              </div>

              <div className="sm:col-span-2">
                <InputGroup
                  label="Mã gợi nhớ"
                  type="text"
                  value={formData.memo}
                  handleChange={(e) => setFormData({ ...formData, memo: e.target.value })}
                  placeholder="VD: HOCPHI-TRITUE-001"
                  icon={<HashtagIcon />}
                  helperText="Nội dung chuyển khoản mặc định khi học viên quét mã QR (không bắt buộc). Hệ thống luôn tự thêm mã tham chiếu của từng khoản học phí để đối chiếu — dùng [Mã đơn hàng] nếu muốn tự chọn vị trí."
                  inputProps={{ autoComplete: "off", maxLength: 255 }}
                />
              </div>
            </div>

            <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-800/60">
              <Switch
                checked={formData.is_default}
                onChange={(e) =>
                  setFormData({ ...formData, is_default: e.target.checked })
                }
                label="Đặt làm tài khoản mặc định"
                backgroundSize="default"
              />
              <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400">
                Học viên sẽ thấy tài khoản mặc định đầu tiên khi chuyển khoản học phí.
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={closeModal} disabled={submitting}>
                Hủy
              </Button>
              <Button type="submit" loading={submitting}>
                {editingAccount ? "Cập nhật" : "Thêm tài khoản"}
              </Button>
            </div>
          </form>
        </FormModal>
      )}

      {/* Xác nhận xóa — ConfirmDeleteDialog chuẩn */}
      <ConfirmDeleteDialog
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        loading={deleting}
        message={
          deleteTarget
            ? `Bạn có chắc muốn xóa tài khoản ${deleteTarget.bank_name} (${deleteTarget.account_number})?`
            : undefined
        }
      />

      {/* Modal hiển thị QR code */}
      {qrModalOpen && qrAccount && (
        <FormModal
          title="Mã QR chuyển khoản"
          onClose={() => setQrModalOpen(false)}
          closeDisabled={false}
          size="lg"
        >
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <InputGroup
                label="Số tiền (VNĐ)"
                type="number"
                value={qrAmount}
                handleChange={(e) => setQrAmount(e.target.value)}
                placeholder="Nhập số tiền (không bắt buộc)"
                icon={<BanknotesIcon />}
                inputProps={{ min: 0, step: 1000 }}
              />
              <InputGroup
                label="Nội dung chuyển khoản"
                type="text"
                value={qrContent}
                handleChange={(e) => setQrContent(e.target.value)}
                placeholder="Nội dung chuyển khoản"
                icon={<DocumentDuplicateIcon />}
              />
            </div>

            <PaymentQRCode
              bankInfo={{
                bank_name: qrAccount.bank_name,
                account_number: qrAccount.account_number,
                account_name: qrAccount.account_name,
                branch: qrAccount.branch || undefined,
                transfer_content: qrContent,
              }}
              amount={qrAmount ? Number(qrAmount) : undefined}
              content={qrContent}
            />

            {codeForBank(qrAccount.bank_name) && (
              <div className="flex justify-end">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  icon={<QrCodeIcon />}
                  onClick={handleDownloadQr}
                  lockAware={false}
                >
                  Tải mã QR
                </Button>
              </div>
            )}
          </div>
        </FormModal>
      )}
    </ProtectedRoute>
  );
}
