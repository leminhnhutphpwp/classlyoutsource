"use client";
import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import InputGroup from "@/components/FormElements/InputGroup";
import DateInput from "@/components/FormElements/DateInput";
import SelectInput from "@/components/FormElements/SelectInput";
import { useCreatePayment, useClasses, useClassStudents } from "@/hooks/use-api";
import { apiClient } from "@/lib/api-client";
import { useAuthContext } from "@/contexts/auth-context";
import { useResourceGuard } from "@/lib/permission-guards";
import { ArrowLeftIcon, CalendarIcon, CheckCircleIcon } from "@heroicons/react/24/outline";
import Button from "@/components/Common/Button";
import ButtonLink from "@/components/Common/ButtonLink";
import { useNotification } from "@/hooks/use-notification";
import PausedStudentBanner from "@/components/Students/PausedStudentBanner";
import { useGoBack } from "@/hooks/use-go-back";
import { getObjId, idsEqual } from "@/lib/id-utils";

export default function CreatePaymentPage() {
  const router = useRouter();
  const { user } = useAuthContext();
  const handleGoBack = useGoBack('/payments');

  // Use resource guard to protect this route
  const { hasAccess, isChecking } = useResourceGuard(
    user,
    'create',
    'payment',
    '/403'
  );

  // All hooks must be called before any early returns
  const { success: notifySuccess, error: notifyError } = useNotification();
  const { mutate: createPayment, loading, error } = useCreatePayment();
  const { data: classes, loading: classesLoading } = useClasses();

  // Get current month in format YYYY-MM
  const currentMonth = new Date().toISOString().slice(0, 7);

  const [formData, setFormData] = useState({
    class_id: "",
    student_id: "",
    month: currentMonth,
    amount: "",
    payment_date: new Date().toISOString().split("T")[0],
    due_date: "",
    payment_method: "cash" as "cash" | "bank" | "other",
    status: "pending" as "paid" | "pending" | "failed" | "refunded",
    note: "",
    payment_request_id: "",
  });
  const [serverPausedBanner, setServerPausedBanner] = useState<{ enrollment?: any; studentName?: string } | null>(null);
  const [paymentRequests, setPaymentRequests] = useState<any[]>([]);
  const [loadingRequests, setLoadingRequests] = useState(false);

  // Fetch payment requests when class_id changes
  useEffect(() => {
    if (!formData.class_id) {
      setPaymentRequests([]);
      return;
    }

    const fetchRequests = async () => {
      setLoadingRequests(true);
      try {
        const response = await apiClient.getPaymentRequests(formData.class_id, {
          status: 'active',
          per_page: 100
        });
        if (response.success) {
          const data = Array.isArray(response.data) ? response.data : response.data?.data || [];
          setPaymentRequests(Array.isArray(data) ? data : []);
        }
      } catch (error) {
        console.error("Error fetching payment requests:", error);
      } finally {
        setLoadingRequests(false);
      }
    };

    fetchRequests();
  }, [formData.class_id]);

  const selectedClass = useMemo(() => {
    if (!formData.class_id) return null;
    return classes?.find((classItem: any) => idsEqual(classItem, formData.class_id)) || null;
  }, [classes, formData.class_id]);

  // Get students for selected class - only fetch when class_id is provided.
  // Memoize so the [] fallback identity is stable across renders (deps of the
  // useMemo below stay reliable).
  const { data: classStudentsData, loading: studentsLoading } = useClassStudents(formData.class_id);
  const classStudents = useMemo(
    () => (formData.class_id ? (classStudentsData?.students || classStudentsData || []) : []),
    [formData.class_id, classStudentsData]
  );
  const { pausedClassStudents } = useMemo(() => {
    if (!formData.class_id) {
      return { activeClassStudents: [], pausedClassStudents: [] };
    }
    const paused = classStudents.filter((student: any) => student?.enrollment?.is_paused);
    const active = classStudents.filter((student: any) => !student?.enrollment?.is_paused);
    return { activeClassStudents: active, pausedClassStudents: paused };
  }, [classStudents, formData.class_id]);

  // Reset student_id when class_id changes
  useEffect(() => {
    if (formData.class_id) {
      setFormData(prev => ({ ...prev, student_id: "" }));
      setServerPausedBanner(null);
    }
  }, [formData.class_id]);

  // Show nothing while checking or redirecting (after all hooks)
  if (isChecking || !hasAccess) {
    return null;
  }

  // Format số tiền với dấu chấm phân cách hàng nghìn
  const formatAmount = (value: string): string => {
    // Loại bỏ tất cả ký tự không phải số
    const numericValue = value.replace(/[^\d]/g, '');
    if (!numericValue) return '';
    // Format với dấu chấm phân cách hàng nghìn
    return numericValue.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  };

  // Parse số tiền từ format có dấu chấm về số thuần
  const parseAmount = (value: string): string => {
    return value.replace(/\./g, '');
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;

    // Format số tiền khi nhập vào field amount
    if (name === 'amount') {
      const formatted = formatAmount(value);
      setFormData(prev => ({ ...prev, [name]: formatted }));
    } else if (name === 'payment_request_id') {
      if (value && value !== 'manual') {
        const request = paymentRequests.find(r => idsEqual(r, value));
        if (request) {
          setFormData(prev => ({
            ...prev,
            [name]: value,
            month: request.period_month || request.month || prev.month,
            amount: formatAmount(request.amount_per_student?.toString() || ""),
            due_date: request.due_date ? request.due_date.split('T')[0] : prev.due_date,
            note: request.description || `Đóng học phí ${request.period_name}`,
          }));
        } else {
          setFormData(prev => ({ ...prev, [name]: value }));
        }
      } else {
        // Manual selected or empty
        setFormData(prev => ({ ...prev, [name]: value }));
      }
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.class_id || !formData.student_id || !formData.month) return;
    setServerPausedBanner(null);

    const result = await createPayment({
      class_id: formData.class_id,
      student_id: formData.student_id,
      month: formData.month,
      amount: formData.amount ? parseFloat(parseAmount(formData.amount)) : undefined,
      payment_date: formData.payment_date || undefined,
      due_date: formData.due_date || undefined,
      payment_method: formData.payment_method,
      status: formData.status,
      note: formData.note || undefined,
      payment_request_id: formData.payment_request_id && formData.payment_request_id !== 'manual' ? formData.payment_request_id : undefined,
    });
    if (result.success) {
      notifySuccess("Tạo thanh toán thành công", "Giao dịch đã được ghi nhận.");
      router.push("/payments");
    } else if (result.code === "STUDENT_PAUSED") {
      setServerPausedBanner({
        enrollment: result.data?.enrollment,
        studentName: result.data?.student?.name,
      });
      notifyError("Không thể tạo thanh toán", result.message || "Học viên đang tạm dừng nên không thể tạo thanh toán.");
    } else {
      notifyError("Không thể tạo thanh toán", result.message || "Đã xảy ra lỗi không mong muốn.");
    }
  };

  const isLoading = classesLoading;

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
          <h1 className="text-xl sm:text-2xl font-bold text-dark dark:text-white truncate">Tạo thanh toán</h1>
          <p className="text-dark-4 dark:text-dark-6 mt-1 break-words">Tạo giao dịch thanh toán mới</p>
        </div>
      </div>

      {/* Form */}
      {isLoading ? (
        <div className="max-w-2xl rounded-lg bg-white p-6 dark:bg-gray-800">
          <div className="space-y-6">
            <div className="space-y-2">
              <div className="h-4 w-24 rounded bg-gray-200 dark:bg-gray-700 animate-pulse" />
              <div className="h-12 w-full rounded-lg bg-gray-200 dark:bg-gray-700 animate-pulse" />
            </div>
            <div className="space-y-2">
              <div className="h-4 w-24 rounded bg-gray-200 dark:bg-gray-700 animate-pulse" />
              <div className="h-12 w-full rounded-lg bg-gray-200 dark:bg-gray-700 animate-pulse" />
            </div>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="max-w-2xl rounded-lg bg-white p-6 dark:bg-gray-800 space-y-6">
          {error && (
            <div className="rounded-lg bg-red-50 border border-red-200 p-4 text-red-600 dark:bg-red-900/20 dark:border-red-800 dark:text-red-400">
              {error}
            </div>
          )}

          {serverPausedBanner?.enrollment && (
            <PausedStudentBanner
              enrollment={serverPausedBanner.enrollment}
              studentName={serverPausedBanner.studentName}
              className={selectedClass?.name}
              description="Học viên đang tạm dừng nên hệ thống không thể tạo thanh toán."
            />
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <SelectInput
              label="Lớp học"
              name="class_id"
              value={formData.class_id}
              handleChange={handleChange}
              required
              placeholder={classesLoading ? "Đang tải lớp học..." : "-- Chọn lớp học --"}
              options={
                classesLoading
                  ? []
                  : (classes || []).map((classItem: any) => {
                    return {
                      value: getObjId(classItem),
                      label: classItem.name,
                    };
                  })
              }
              helperText={
                classesLoading
                  ? "Đang tải danh sách lớp..."
                  : (classes || []).length === 0
                    ? "Chưa có lớp nào, hãy tạo lớp trước khi tạo thanh toán."
                    : undefined
              }
            />

            <SelectInput
              label="Học viên"
              name="student_id"
              value={formData.student_id}
              handleChange={handleChange}
              required
              disabled={!formData.class_id || studentsLoading}
              placeholder={
                !formData.class_id
                  ? "-- Chọn lớp học trước --"
                  : studentsLoading
                    ? "Đang tải học viên..."
                    : "-- Chọn học viên --"
              }
              options={
                !formData.class_id || studentsLoading
                  ? []
                  : classStudents.map((student: any) => {
                    const isPaused = student.enrollment?.is_paused;
                    return {
                      value: getObjId(student),
                      label: isPaused ? `${student.name} (Tạm dừng học)` : student.name,
                      disabled: isPaused,
                    };
                  })
              }
              helperText={
                !formData.class_id
                  ? "Chọn lớp để hiển thị học viên tương ứng."
                  : studentsLoading
                    ? undefined
                    : classStudents.length === 0
                      ? "Lớp này chưa có học viên."
                      : undefined
              }
            />
          </div>

          {formData.class_id && pausedClassStudents.length > 0 && (
            <div className="space-y-3">
              {pausedClassStudents.map((student: any) => (
                <PausedStudentBanner
                  key={getObjId(student)}
                  enrollment={student.enrollment}
                  studentName={student.name}
                  className={selectedClass?.name}
                  description="Học viên này sẽ không thể tạo thanh toán cho đến khi kích hoạt lại."
                />
              ))}
            </div>
          )}

          <SelectInput
            label="Đợt đóng học phí"
            name="payment_request_id"
            value={formData.payment_request_id}
            handleChange={handleChange}
            placeholder={loadingRequests ? "Đang tải..." : "-- Chọn đợt đóng học phí --"}
            options={[
              ...paymentRequests.map((req: any) => {
                return {
                  value: getObjId(req),
                  label: `${req.period_name} (${formatAmount(req.amount_per_student.toString())}₫)`
                };
              }),
              { value: "manual", label: "Khác (Nhập thủ công)" }
            ]}
            disabled={!formData.class_id || loadingRequests}
            helperText={!formData.class_id ? "Chọn lớp để xem các đợt đóng học phí" : undefined}
          />

          {(formData.payment_request_id === 'manual' || !formData.payment_request_id) && (
            <InputGroup
              type="month"
              label="Tháng"
              placeholder=""
              name="month"
              value={formData.month}
              handleChange={handleChange}
              icon={<CalendarIcon />}
              required
            />
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <InputGroup
              type="text"
              label="Số tiền (₫)"
              placeholder="Nhập số tiền"
              name="amount"
              value={formData.amount}
              handleChange={handleChange}
            />

            <DateInput
              label="Ngày thanh toán"
              placeholder="Chọn ngày"
              name="payment_date"
              value={formData.payment_date}
              onChange={handleChange}
              icon={<CalendarIcon />}
            />
          </div>

          <DateInput
            label="Hạn thanh toán"
            placeholder="Chọn ngày"
            name="due_date"
            value={formData.due_date}
            onChange={handleChange}
            icon={<CalendarIcon />}
          />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <SelectInput
              label="Phương thức thanh toán"
              name="payment_method"
              value={formData.payment_method}
              handleChange={handleChange}
              options={[
                { value: "cash", label: "Tiền mặt" },
                { value: "bank", label: "Chuyển khoản" },
                { value: "other", label: "Khác" },
              ]}
            />

            <SelectInput
              label="Trạng thái"
              name="status"
              value={formData.status}
              handleChange={handleChange}
              options={[
                { value: "pending", label: "Chờ thanh toán" },
                { value: "paid", label: "Đã thanh toán" },
                { value: "failed", label: "Thất bại" },
                { value: "refunded", label: "Đã hoàn tiền" },
              ]}
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-gray-900 dark:text-white">Ghi chú</label>
            <textarea
              name="note"
              value={formData.note}
              onChange={handleChange}
              rows={4}
              placeholder="Nhập ghi chú (tùy chọn)"
              className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-gray-900 placeholder-gray-500 focus:border-primary focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder-gray-400 dark:focus:border-primary"
            />
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4 sm:justify-end">
            <Button
              type="submit"
              disabled={loading}
              loading={loading}
              size="sm"
              variant="primary"
              icon={<CheckCircleIcon />}
              className="w-full sm:w-auto"
            >
              Tạo thanh toán
            </Button>
            <ButtonLink
              href="/payments"
              variant="outline"
              size="sm"
              className="w-full sm:w-auto justify-center"
            >
              Hủy
            </ButtonLink>
          </div>
        </form>
      )}
    </div>
  );
}
