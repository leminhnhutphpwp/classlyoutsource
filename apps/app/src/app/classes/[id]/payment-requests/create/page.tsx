"use client";
import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { useCreatePaymentRequest, useClassDetails } from "@/hooks/use-api";
import { useGoBack } from "@/hooks/use-go-back";
import { useAuthContext } from "@/contexts/auth-context";
import { usePermissionGuard } from "@/lib/permission-guards";
import { formatCurrency, formatAmount, parseAmount } from "@/lib/format-currency";
import InputGroup from "@/components/FormElements/InputGroup";
import DateInput from "@/components/FormElements/DateInput";
import { Switch } from "@/components/FormElements/switch";

// Lazy load heavy components
const MonthInput = dynamic(() => import("@/components/FormElements/MonthInput"), {
  loading: () => <div className="h-10 bg-gray-100 dark:bg-gray-800 animate-pulse rounded" />,
});
const TextAreaGroup = dynamic(() => import("@/components/FormElements/InputGroup/text-area").then(mod => ({ default: mod.TextAreaGroup })), {
  loading: () => <div className="h-24 bg-gray-100 dark:bg-gray-800 animate-pulse rounded" />,
});
import Button from "@/components/Common/Button";
import ButtonLink from "@/components/Common/ButtonLink";
import {
  ArrowLeftIcon,
  CheckCircleIcon,
  CurrencyDollarIcon,
  CalendarIcon,
  DocumentTextIcon,
  AcademicCapIcon,
  UserGroupIcon,
  PlusIcon,
  TrashIcon
} from "@heroicons/react/24/outline";
import { useNotification } from "@/hooks/use-notification";

// Helper function to convert date string to YYYY-MM format for MonthInput
const getMonthFromDate = (dateString: string | undefined): string | undefined => {
  if (!dateString) return undefined;
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return undefined;
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
};

// Helper function to generate period name with consistent format
const generatePeriodName = (periodNumber: number, classStartDate?: string): string => {
  let month = 1;
  let year = new Date().getFullYear();

  if (classStartDate) {
    const date = new Date(classStartDate);
    if (!isNaN(date.getTime())) {
      // Calculate month based on start date + (periodNumber - 1) months
      const calculatedDate = new Date(date);
      calculatedDate.setMonth(calculatedDate.getMonth() + (periodNumber - 1));
      month = calculatedDate.getMonth() + 1;
      year = calculatedDate.getFullYear();
    }
  } else {
    // Use current month + (periodNumber - 1)
    const now = new Date();
    const calculatedDate = new Date(now.getFullYear(), now.getMonth() + (periodNumber - 1), 1);
    month = calculatedDate.getMonth() + 1;
    year = calculatedDate.getFullYear();
  }

  return `Học phí đợt ${periodNumber} - Tháng ${month}/${year}`;
};

export default function CreatePaymentRequestPage() {
  const params = useParams();
  const router = useRouter();
  const classId = params.id as string;
  const handleGoBack = useGoBack(`/classes/${classId}?tab=payments`);
  const { success, error: showError } = useNotification();
  const { mutate: createPaymentRequest, loading: creating } = useCreatePaymentRequest();
  const { data: classDetails, loading: classLoading } = useClassDetails(classId);
  const { user } = useAuthContext();

  // Use permission guard to protect this route
  const { hasAccess, isChecking } = usePermissionGuard(
    user,
    'create_payment::request',
    `/classes/${classId}`,
    {
      checkAfterLoad: true,
      loaded: !classLoading && !!classDetails,
    }
  );

  // All hooks must be called before any early returns
  const [mode, setMode] = useState<"single" | "bulk">("single");

  // Single mode form
  const [singleForm, setSingleForm] = useState({
    period_name: "",
    period_month: "",
    amount_per_student: "",
    due_date: "",
    description: "",
    auto_create_payments: true,
  });

  // Bulk mode form - using repeater
  type PeriodForm = {
    period_name: string;
    period_month: string;
    amount_per_student: string;
    due_date: string;
    description: string;
  };

  const [periods, setPeriods] = useState<PeriodForm[]>([
    {
      period_name: "",
      period_month: "",
      amount_per_student: "",
      due_date: "",
      description: "",
    }
  ]);
  const [autoCreatePayments, setAutoCreatePayments] = useState(true);

  // Auto-fill amount_per_student from class tuition_fee when class data is loaded
  useEffect(() => {
    if (classDetails?.tuition_fee) {
      // Only auto-fill if field is empty
      if (!singleForm.amount_per_student) {
        setSingleForm(prev => ({
          ...prev,
          amount_per_student: formatAmount(classDetails.tuition_fee)
        }));
      }
      // Auto-fill for first period if empty
      if (periods.length > 0 && !periods[0].amount_per_student) {
        setPeriods(prev => {
          const updated = [...prev];
          updated[0] = {
            ...updated[0],
            amount_per_student: formatAmount(classDetails.tuition_fee)
          };
          return updated;
        });
      }
    }
  }, [classDetails?.tuition_fee, singleForm.amount_per_student, periods]);

  // Initialize first period name when class details are loaded or when switching to bulk mode
  useEffect(() => {
    if (mode === "bulk" && periods.length > 0) {
      const expectedName = generatePeriodName(1, classDetails?.start_date);
      if (!periods[0].period_name || periods[0].period_name !== expectedName) {
        setPeriods(prev => {
          const updated = [...prev];
          updated[0] = {
            ...updated[0],
            period_name: expectedName
          };
          return updated;
        });
      }
    }
  }, [mode, classDetails?.start_date, periods]);

  // Show nothing while checking or redirecting (after ALL hooks to maintain hook order)
  if (isChecking || !hasAccess) {
    return null;
  }

  // Helper function to add a new period with smart defaults
  const addPeriod = () => {
    const lastPeriod = periods[periods.length - 1];
    const lastDueDate = lastPeriod.due_date;

    // Calculate next due date (1 month after last due date, or 1 month after class start date)
    let nextDueDate = "";
    if (lastDueDate) {
      const date = new Date(lastDueDate);
      date.setMonth(date.getMonth() + 1);
      nextDueDate = date.toISOString().split('T')[0];
    } else if (classDetails?.start_date) {
      const date = new Date(classDetails.start_date);
      date.setMonth(date.getMonth() + periods.length);
      nextDueDate = date.toISOString().split('T')[0];
    }

    // Calculate next period month
    let nextPeriodMonth = "";
    if (lastPeriod.period_month) {
      const [year, month] = lastPeriod.period_month.split("-");
      const date = new Date(parseInt(year), parseInt(month) - 1, 1);
      date.setMonth(date.getMonth() + 1);
      nextPeriodMonth = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    }

    // Auto-generate period name with consistent format
    const periodNumber = periods.length + 1;
    const autoPeriodName = generatePeriodName(periodNumber, classDetails?.start_date);

    setPeriods(prev => [...prev, {
      period_name: autoPeriodName,
      period_month: nextPeriodMonth,
      amount_per_student: lastPeriod.amount_per_student || formatAmount(classDetails?.tuition_fee || 0),
      due_date: nextDueDate,
      description: lastPeriod.description || "",
    }]);
  };

  // Helper function to remove a period
  const removePeriod = (index: number) => {
    if (periods.length > 1) {
      setPeriods(prev => prev.filter((_, i) => i !== index));
    }
  };

  // Handler for period field changes
  const handlePeriodChange = (index: number, field: keyof PeriodForm, value: string) => {
    setPeriods(prev => {
      const updated = [...prev];
      if (field === "amount_per_student") {
        updated[index] = {
          ...updated[index],
          [field]: formatAmount(value)
        };
      } else {
        updated[index] = {
          ...updated[index],
          [field]: value
        };
      }
      return updated;
    });
  };

  const handleSingleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    if (type === "checkbox") {
      const checked = (e.target as HTMLInputElement).checked;
      setSingleForm(prev => ({ ...prev, [name]: checked }));
    } else if (name === "amount_per_student") {
      // Format amount as user types
      const formatted = formatAmount(value);
      setSingleForm(prev => ({ ...prev, [name]: formatted }));
    } else {
      setSingleForm(prev => ({ ...prev, [name]: value }));
    }
  };


  const handleSingleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!singleForm.period_name.trim()) {
      showError("Vui lòng nhập tên đợt");
      return;
    }
    const amount = parseAmount(singleForm.amount_per_student) || 0;
    if (!amount || amount <= 0) {
      showError("Vui lòng nhập số tiền hợp lệ");
      return;
    }
    if (!singleForm.due_date) {
      showError("Vui lòng chọn hạn đóng");
      return;
    }

    const result = await createPaymentRequest({
      classId,
      data: {
        period_name: singleForm.period_name.trim(),
        period_month: singleForm.period_month || undefined,
        amount_per_student: amount,
        due_date: singleForm.due_date,
        description: singleForm.description.trim() || undefined,
        auto_create_payments: singleForm.auto_create_payments,
      }
    });

    if (result.success) {
      success("Tạo yêu cầu đóng học phí thành công");
      router.push(`/classes/${classId}?tab=payments`);
    } else {
      showError(result.message || "Không thể tạo yêu cầu đóng học phí");
    }
  };

  const handleBulkSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate all periods
    for (let i = 0; i < periods.length; i++) {
      const period = periods[i];
      if (!period.period_name.trim()) {
        showError(`Vui lòng nhập tên đợt cho đợt ${i + 1}`);
        return;
      }
      const amount = parseAmount(period.amount_per_student) || 0;
      if (!amount || amount <= 0) {
        showError(`Vui lòng nhập số tiền hợp lệ cho đợt ${i + 1}`);
        return;
      }
      if (!period.due_date) {
        showError(`Vui lòng chọn hạn đóng cho đợt ${i + 1}`);
        return;
      }
    }

    // Create all periods sequentially
    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < periods.length; i++) {
      const period = periods[i];
      const amount = parseAmount(period.amount_per_student);

      const result = await createPaymentRequest({
        classId,
        data: {
          period_name: period.period_name.trim(),
          period_month: period.period_month || undefined,
          amount_per_student: amount,
          due_date: period.due_date,
          description: period.description.trim() || undefined,
          auto_create_payments: autoCreatePayments,
        }
      });

      if (result.success) {
        successCount++;
      } else {
        errorCount++;
        showError(`Lỗi khi tạo đợt ${i + 1}: ${result.message || "Không thể tạo yêu cầu đóng học phí"}`);
      }
    }

    if (successCount > 0) {
      if (errorCount === 0) {
        success(`Đã tạo ${successCount} yêu cầu đóng học phí thành công`);
      } else {
        success(`Đã tạo ${successCount}/${periods.length} yêu cầu đóng học phí`);
      }
      router.push(`/classes/${classId}?tab=payments`);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
        <Button
          onClick={handleGoBack}
          variant="outline"
          size="sm"
          icon={<ArrowLeftIcon />}
          className="w-full sm:w-auto justify-center"
        >
          Quay lại
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white truncate">
            Tạo yêu cầu đóng học phí
          </h1>
          <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-1 break-words">
            Tạo đợt đóng học phí cho lớp học
          </p>
        </div>
      </div>

      {/* Class Information Box */}
      {classDetails && (
        <div className="max-w-2xl rounded-lg bg-white p-4 dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <AcademicCapIcon className="h-5 w-5 text-primary" />
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white">{classDetails.name}</h3>
            </div>
            <div className="grid grid-cols-2 gap-3 text-xs">
              {classDetails.start_date && (
                <div className="flex items-center gap-2">
                  <CalendarIcon className="h-4 w-4 text-gray-400" />
                  <div>
                    <span className="text-gray-500 dark:text-gray-400">Bắt đầu: </span>
                    <span className="text-gray-900 dark:text-white font-medium">
                      {new Date(classDetails.start_date).toLocaleDateString('vi-VN')}
                    </span>
                  </div>
                </div>
              )}
              {classDetails.end_date && (
                <div className="flex items-center gap-2">
                  <CalendarIcon className="h-4 w-4 text-gray-400" />
                  <div>
                    <span className="text-gray-500 dark:text-gray-400">Kết thúc: </span>
                    <span className="text-gray-900 dark:text-white font-medium">
                      {new Date(classDetails.end_date).toLocaleDateString('vi-VN')}
                    </span>
                  </div>
                </div>
              )}
              {classDetails.tuition_fee && (
                <div className="flex items-center gap-2">
                  <CurrencyDollarIcon className="h-4 w-4 text-gray-400" />
                  <div>
                    <span className="text-gray-500 dark:text-gray-400">Học phí: </span>
                    <span className="text-gray-900 dark:text-white font-medium">
                      {classDetails.tuition_fee_formatted || formatCurrency(classDetails.tuition_fee)}
                    </span>
                  </div>
                </div>
              )}
              {(classDetails.students_count !== undefined || classDetails.student_count !== undefined) && (
                <div className="flex items-center gap-2">
                  <UserGroupIcon className="h-4 w-4 text-gray-400" />
                  <div>
                    <span className="text-gray-500 dark:text-gray-400">Học viên: </span>
                    <span className="text-gray-900 dark:text-white font-medium">
                      {classDetails.students_count || classDetails.student_count || 0} người
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Mode Tabs */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="-mb-px flex gap-4">
          <button
            onClick={() => setMode("single")}
            className={`px-4 py-2 font-medium text-sm transition-colors border-b-2 ${mode === "single"
                ? "text-primary border-primary"
                : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 border-transparent"
              }`}
          >
            Tạo đơn lẻ
          </button>
          <button
            onClick={() => setMode("bulk")}
            className={`px-4 py-2 font-medium text-sm transition-colors border-b-2 ${mode === "bulk"
                ? "text-primary border-primary"
                : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 border-transparent"
              }`}
          >
            Tạo nhiều đợt
          </button>
        </nav>
      </div>

      {/* Single Mode Form */}
      {mode === "single" && (
        <form onSubmit={handleSingleSubmit} className="max-w-2xl rounded-lg bg-white p-6 dark:bg-gray-800 space-y-6">
          <InputGroup
            type="text"
            label="Tên đợt"
            name="period_name"
            value={singleForm.period_name}
            handleChange={handleSingleChange}
            placeholder="Ví dụ: Đợt 1 - Tháng 1/2025"
            required
            icon={<DocumentTextIcon />}
          />

          <MonthInput
            label="Tháng/Kỳ (tùy chọn)"
            name="period_month"
            value={singleForm.period_month}
            onChange={handleSingleChange}
            min={getMonthFromDate(classDetails?.start_date)}
            icon={<CalendarIcon />}
          />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <InputGroup
              type="text"
              label="Số tiền mỗi học viên (₫)"
              name="amount_per_student"
              value={singleForm.amount_per_student}
              handleChange={handleSingleChange}
              placeholder="500.000"
              required
              icon={<CurrencyDollarIcon />}
            />

            <DateInput
              label="Hạn đóng"
              name="due_date"
              value={singleForm.due_date}
              onChange={handleSingleChange}
              required
              min={classDetails?.start_date || undefined}
              icon={<CalendarIcon />}
            />
          </div>

          <TextAreaGroup
            label="Mô tả (tùy chọn)"
            name="description"
            value={singleForm.description}
            onChange={handleSingleChange}
            placeholder="Nhập mô tả..."
            rows={3}
          />

          <Switch
            label="Tự động tạo pending payments cho tất cả học viên"
            checked={singleForm.auto_create_payments}
            onChange={(e) => setSingleForm(prev => ({ ...prev, auto_create_payments: e.target.checked }))}
          />

          <div className="flex items-center gap-4 pt-4 justify-end">
            <ButtonLink
              href={`/classes/${classId}?tab=payments`}
              variant="outline"
              size="sm"
            >
              Hủy
            </ButtonLink>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              loading={creating}
              icon={<CheckCircleIcon />}
            >
              Tạo yêu cầu
            </Button>
          </div>
        </form>
      )}

      {/* Bulk Mode Form - Repeater */}
      {mode === "bulk" && (
        <form onSubmit={handleBulkSubmit} className="max-w-2xl rounded-lg bg-white p-6 dark:bg-gray-800 space-y-6">
          <div className="space-y-4">
            {periods.map((period, index) => (
              <div key={index} className="border-[1px] border-gray-200 dark:border-gray-700 rounded-lg p-4 space-y-4">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-sm font-semibold text-gray-900 dark:text-white">
                    Đợt {index + 1}
                  </h4>
                  {periods.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removePeriod(index)}
                      icon={<TrashIcon />}
                      className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                    >
                      Xóa
                    </Button>
                  )}
                </div>

                <InputGroup
                  type="text"
                  label="Tên đợt"
                  name="period_name"
                  value={period.period_name}
                  handleChange={(e) => handlePeriodChange(index, "period_name", e.target.value)}
                  placeholder="Ví dụ: Học phí đợt 1 - Tháng 1/2025"
                  required
                  icon={<DocumentTextIcon />}
                />

                <MonthInput
                  label="Tháng/Kỳ (tùy chọn)"
                  name="period_month"
                  value={period.period_month}
                  onChange={(e) => handlePeriodChange(index, "period_month", e.target.value)}
                  min={getMonthFromDate(classDetails?.start_date)}
                  icon={<CalendarIcon />}
                />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <InputGroup
                    type="text"
                    label="Số tiền mỗi học viên (₫)"
                    name="amount_per_student"
                    value={period.amount_per_student}
                    handleChange={(e) => handlePeriodChange(index, "amount_per_student", e.target.value)}
                    placeholder="500.000"
                    required
                    icon={<CurrencyDollarIcon />}
                  />

                  <DateInput
                    label="Hạn đóng"
                    name="due_date"
                    value={period.due_date}
                    onChange={(e) => handlePeriodChange(index, "due_date", e.target.value)}
                    required
                    min={classDetails?.start_date || undefined}
                    icon={<CalendarIcon />}
                  />
                </div>

                <TextAreaGroup
                  label="Mô tả (tùy chọn)"
                  name="description"
                  value={period.description}
                  onChange={(e) => handlePeriodChange(index, "description", e.target.value)}
                  placeholder="Nhập mô tả..."
                  rows={2}
                />
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={addPeriod}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-red-600 bg-white border border-dashed border-red-300 rounded-lg hover:bg-red-50 hover:border-red-400 transition-colors dark:bg-gray-800 dark:border-red-600 dark:text-red-400 dark:hover:bg-red-900/20"
          >
            <PlusIcon className="h-5 w-5" />
            Thêm đợt
          </button>

          <Switch
            label="Tự động tạo pending payments cho tất cả học viên"
            checked={autoCreatePayments}
            onChange={(e) => setAutoCreatePayments(e.target.checked)}
          />

          <div className="flex items-center gap-4 pt-4 justify-end">
            <ButtonLink
              href={`/classes/${classId}?tab=payments`}
              variant="outline"
              size="sm"
            >
              Hủy
            </ButtonLink>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              loading={creating}
              icon={<CheckCircleIcon />}
            >
              Tạo {periods.length} đợt
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}

