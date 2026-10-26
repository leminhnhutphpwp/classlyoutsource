"use client";
import { useState } from "react";
import { useChangePassword, useChangeEmail, useLoginHistory } from "@/hooks/use-api";
import InputGroup from "@/components/FormElements/InputGroup";
import DateInput from "@/components/FormElements/DateInput";
import SelectInput from "@/components/FormElements/SelectInput";
import {
  LockClosedIcon,
  EnvelopeIcon,
  CheckCircleIcon,
  ClockIcon,
} from "@heroicons/react/24/outline";
import { useNotification } from "@/hooks/use-notification";
import { useAuthContext } from "@/contexts/auth-context";
import { DEFAULT_LOGIN_HISTORY_FILTERS, LOGIN_STATUS_OPTIONS } from "@/constants/login-history";
import type { LoginHistoryFilters } from "@/types/login-history";
import { LoginHistoryList } from "@/components/LoginHistory/LoginHistoryList";
import Button from "@/components/Common/Button";
import { useLockContext } from "@/contexts/lock-context";
import { useErrorDisplay } from "@/components/Common/ErrorDisplay";
import Pagination from "@/components/Common/Pagination";
import { EmailVerification } from "@/components/Auth/EmailVerification";
import TwoFactorSettings from "@/components/Auth/TwoFactorSettings";
import { Tabs, TabPanel } from "@/components/Common/Tabs";
import { ShieldCheckIcon } from "@heroicons/react/24/outline";

export default function SecuritySettingsPage() {
  const { refetchUser } = useAuthContext();
  const { mutate: changePassword, loading: changingPassword } = useChangePassword();
  const { mutate: changeEmail, loading: changingEmail } = useChangeEmail();
  const { success, error: showError } = useNotification();
  const { actionsLocked, planFeatureMessage } = useLockContext();
  const { renderError } = useErrorDisplay("Nhật ký truy cập");

  const [passwordData, setPasswordData] = useState({
    current_password: "",
    new_password: "",
    new_password_confirmation: "",
  });

  const [emailData, setEmailData] = useState({
    new_email: "",
    password: "",
  });
  const [showEmailVerification, setShowEmailVerification] = useState(false);
  // State lưu email đang chờ xác thực để truyền xuống component
  const [pendingVerificationEmail, setPendingVerificationEmail] = useState("");
  const [activeTab, setActiveTab] = useState("login-history");
  const [historyFilters, setHistoryFilters] = useState<LoginHistoryFilters>(() => ({
    ...DEFAULT_LOGIN_HISTORY_FILTERS,
  }));

  // - Học viên: luôn có quyền xem lịch sử của chính mình (không cần capability)
  // - Giáo viên: cần capability login_activity.view, nếu không có sẽ trả về FEATURE_NOT_AVAILABLE
  // Luôn gọi API để useApi có thể xử lý trạng thái lỗi tương ứng
  const {
    entries: loginHistoryEntries,
    loading: loginHistoryLoading,
    meta: loginHistoryMeta,
  } = useLoginHistory(historyFilters, { enabled: !actionsLocked });

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setPasswordData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setEmailData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleHistoryStatusChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const { value } = e.target;
    setHistoryFilters(prev => ({
      ...prev,
      status: value,
      page: 1,
    }));
  };

  const handleHistoryDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setHistoryFilters(prev => ({
      ...prev,
      [name]: value,
      page: 1,
    }));
  };

  const handleHistoryPageChange = (page: number) => {
    setHistoryFilters(prev => ({
      ...prev,
      page,
    }));
  };

  const handleResetFilters = () => {
    setHistoryFilters({
      ...DEFAULT_LOGIN_HISTORY_FILTERS,
    });
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordData.new_password !== passwordData.new_password_confirmation) {
      showError("Mật khẩu mới không khớp");
      return;
    }

    const result = await changePassword(passwordData);
    if (result.success) {
      success("Đổi mật khẩu thành công!");
      setPasswordData({
        current_password: "",
        new_password: "",
        new_password_confirmation: "",
      });
    } else {
      showError(result.message || "Không thể đổi mật khẩu");
    }
  };

  /**
   * Xử lý đổi email
   * 
   * Flow theo tài liệu:
   * 1. Đổi email → email mới
   * 2. Hủy xác thực (email_verified_at = null)
   * 3. Tự động tạo mã xác thực cho email MỚI
   * 4. Tự động gửi mã đến email MỚI
   * 5. Response có:
   *    - email_verified: false (email mới chưa xác thực)
   *    - verification_code_sent: true (mã đã được gửi tự động)
   *    - next_step: "verify_email" (cần gọi verify-email API)
   * 
   * User chỉ cần: Nhập mã từ email mới và gọi verify-email
   */
  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const result = await changeEmail(emailData);
    if (result.success) {
      // Kiểm tra response fields từ backend
      const responseData = result.data || {};
      const verificationCodeSent = responseData.verification_code_sent === true;
      const nextStep = responseData.next_step;

      // Thông báo dựa trên response
      if (verificationCodeSent && nextStep === "verify_email") {
        success("Email đã được đổi thành công. Mã xác thực đã được gửi đến email mới. Vui lòng kiểm tra email để xác thực.");
      } else {
        success("Email đã được đổi thành công. Vui lòng kiểm tra email để xác thực.");
      }

      // Cập nhật thông tin user (để lấy pending_email)
      await refetchUser();

      // Lưu email mới vào state để hiển thị ngay lập tức
      setPendingVerificationEmail(emailData.new_email);

      setEmailData({
        new_email: "",
        password: "",
      });

      // Chuyển sang tab email và trigger hiển thị form xác thực
      // (vì change-email đã tự động gửi mã, user chỉ cần nhập mã)
      setActiveTab("email");
      // Set showEmailVerification = true để trigger hiển thị form nhập mã
      // EmailVerification component sẽ tự động hiển thị form khi nhận được prop này
      setShowEmailVerification(true);
    } else {
      if (result.errors && typeof result.errors === 'object') {
        const errorMessages = Object.values(result.errors as Record<string, string[]>).flat().join('\n');
        showError(errorMessages || "Không thể đổi email");
      } else {
        showError(result.message || "Không thể đổi email");
      }
    }
  };

  const currentHistoryPage = historyFilters.page || 1;
  const hasActiveFilters = historyFilters.status !== 'all' || historyFilters.from_date || historyFilters.to_date;

  if (actionsLocked || planFeatureMessage) {
    return renderError();
  }

  const tabs = [
    {
      id: "password",
      label: "Mật khẩu",
      icon: <LockClosedIcon />,
    },
    {
      id: "email",
      label: "Email",
      icon: <EnvelopeIcon />,
    },
    {
      id: "two-factor",
      label: "Xác thực 2 lớp",
      icon: <ShieldCheckIcon />,
    },
    {
      id: "login-history",
      label: "Nhật ký truy cập",
      icon: <ClockIcon />,
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Nhật ký truy cập</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Quản lý bảo mật và quyền riêng tư tài khoản
        </p>
      </div>

      {/* Tabs */}
      <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />

      {/* Tab Panels */}
      {/* Password Tab */}
      <TabPanel activeTab={activeTab} tabId="password">
        <div className="rounded-lg bg-white p-6 dark:bg-gray-800">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Đổi mật khẩu
          </h3>
          <form onSubmit={handlePasswordSubmit} className="space-y-4">
            <InputGroup
              type="password"
              label="Mật khẩu hiện tại"
              placeholder="Nhập mật khẩu hiện tại"
              name="current_password"
              value={passwordData.current_password}
              handleChange={handlePasswordChange}
              required
            />
            <InputGroup
              type="password"
              label="Mật khẩu mới"
              placeholder="Nhập mật khẩu mới"
              name="new_password"
              value={passwordData.new_password}
              handleChange={handlePasswordChange}
              required
            />
            <InputGroup
              type="password"
              label="Xác nhận mật khẩu mới"
              placeholder="Nhập lại mật khẩu mới"
              name="new_password_confirmation"
              value={passwordData.new_password_confirmation}
              handleChange={handlePasswordChange}
              required
            />
            <Button
              type="submit"
              disabled={changingPassword}
              loading={changingPassword}
              size="sm"
              variant="primary"
              icon={<CheckCircleIcon />}
            >
              Đổi mật khẩu
            </Button>
          </form>
        </div>
      </TabPanel>

      {/* Email Tab */}
      <TabPanel activeTab={activeTab} tabId="email">
        <div className="space-y-6">
          {/* Email Verification */}
          <EmailVerification
            showVerificationForm={showEmailVerification}
            onShowForm={() => {
              setShowEmailVerification(false);
            }}
            email={pendingVerificationEmail}
          />

          {/* Change Email */}
          <div className="rounded-lg bg-white p-6 dark:bg-gray-800">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Đổi email
            </h3>
            <form onSubmit={handleEmailSubmit} className="space-y-4">
              <InputGroup
                type="email"
                label="Email mới"
                placeholder="Nhập email mới"
                name="new_email"
                value={emailData.new_email}
                handleChange={handleEmailChange}
                icon={<EnvelopeIcon className="h-5 w-5" />}
                required
              />
              <InputGroup
                type="password"
                label="Mật khẩu hiện tại"
                placeholder="Nhập mật khẩu để xác thực"
                name="password"
                value={emailData.password}
                handleChange={handleEmailChange}
                required
              />
              <Button
                type="submit"
                disabled={changingEmail}
                loading={changingEmail}
                size="sm"
                variant="primary"
                icon={<CheckCircleIcon />}
              >
                Đổi email
              </Button>
            </form>
          </div>
        </div>
      </TabPanel>

      {/* Two-Factor Tab */}
      <TabPanel activeTab={activeTab} tabId="two-factor">
        <TwoFactorSettings />
      </TabPanel>

      {/* Login History Tab */}
      <TabPanel activeTab={activeTab} tabId="login-history">
        <div className="rounded-lg bg-white p-6 dark:bg-gray-800 space-y-6">
          {planFeatureMessage ? (
            renderError(undefined, undefined, false)
          ) : (
            <>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Nhật ký truy cập</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Theo dõi các phiên truy cập gần đây và phát hiện các hoạt động bất thường.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-3 relative">
                {hasActiveFilters && (
                  <button
                    type="button"
                    onClick={handleResetFilters}
                    className="absolute -top-3 right-0 text-xs font-medium text-red-500 hover:text-red-700 bg-white dark:bg-gray-800 px-2 py-0.5 rounded-full border border-gray-100 dark:border-gray-700 transition-colors"
                  >
                    Xóa bộ lọc
                  </button>
                )}
                <SelectInput
                  label="Trạng thái"
                  name="status"
                  value={historyFilters.status || "all"}
                  handleChange={handleHistoryStatusChange}
                  options={LOGIN_STATUS_OPTIONS}
                />
                <DateInput
                  label="Từ ngày"
                  name="from_date"
                  value={historyFilters.from_date || ""}
                  handleChange={handleHistoryDateChange}
                  placeholder="Chọn ngày bắt đầu"
                />
                <DateInput
                  label="Đến ngày"
                  name="to_date"
                  value={historyFilters.to_date || ""}
                  handleChange={handleHistoryDateChange}
                  placeholder="Chọn ngày kết thúc"
                />
              </div>

              <LoginHistoryList
                entries={loginHistoryEntries}
                loading={loginHistoryLoading}
                emptyText="Không tìm thấy phiên đăng nhập nào khớp với bộ lọc hiện tại."
                hideLocation={true}
              />

              <Pagination
                meta={loginHistoryMeta}
                currentPage={currentHistoryPage}
                onPageChange={handleHistoryPageChange}
                itemLabel="phiên đăng nhập"
                className="mt-4"
              />
            </>
          )}
        </div>
      </TabPanel>
    </div>
  );
}

