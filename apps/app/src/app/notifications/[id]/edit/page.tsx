"use client";
import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import InputGroup from "@/components/FormElements/InputGroup";
import DateInput from "@/components/FormElements/DateInput";
import { useNotification, useUpdateNotification, useClasses, useStudents } from "@/hooks/use-api";
import { useGoBack } from "@/hooks/use-go-back";
import { useAuthorization } from "@/lib/authz";
import { useAuthContext } from "@/contexts/auth-context";
import {
  ArrowLeftIcon,
  BellIcon,
  CalendarIcon,
  AcademicCapIcon,
  CheckIcon,
  CheckCircleIcon,
  MagnifyingGlassIcon,
  XMarkIcon
} from "@heroicons/react/24/outline";
import { useNotification as useNotificationToast } from "@/hooks/use-notification";
import SelectInput from "@/components/FormElements/SelectInput";
import Button from "@/components/Common/Button";
import RichTextEditor from "@/components/FormElements/RichTextEditorDynamic";
import ButtonLink from "@/components/Common/ButtonLink";

// Utility to get ID regardless of naming convention (Hashids or legacy IDs)
import { getObjId } from "@/lib/id-utils";

export default function EditNotificationPage() {
  const params = useParams();
  const router = useRouter();
  const notificationId = params.id as string;
  const { can } = useAuthorization();
  const handleGoBack = useGoBack(`/notifications/${notificationId}`);

  // Quyền cập nhật thông báo: tính 1 lần, dùng cho cả effect redirect lẫn
  // early-return bên dưới (sau tất cả hook, để thứ tự hook ổn định).
  const canUpdateNotification = can("update", "notification");

  const { data: notification, loading: loadingNotification, error: notificationError, permissions } = useNotification(notificationId);
  const { mutate: updateNotification, loading: updateLoading, error: updateError } = useUpdateNotification();
  const { success } = useNotificationToast();
  const { user } = useAuthContext();

  // Check permissions from API response
  const canManageFromApi = permissions?.can_manage ?? false;

  // Không có quyền update toàn cục → về 403 (tương đương guard cũ ở đầu render).
  useEffect(() => {
    if (!canUpdateNotification) {
      router.replace("/403");
    }
  }, [canUpdateNotification, router]);

  // Additional check: if notification loaded and user doesn't have manage permission from API, redirect
  useEffect(() => {
    if (notification && !canManageFromApi && !canUpdateNotification) {
      router.replace(`/notifications/${notificationId}`);
    }
  }, [notification, canManageFromApi, canUpdateNotification, router, notificationId]);

  const { data: classes, loading: classesLoading } = useClasses();
  const { data: students, loading: studentsLoading } = useStudents();

  const isTutor = user?.is_tutor || user?.role === 'tutor';

  const [formData, setFormData] = useState({
    title: "",
    content: "",
    type: "announcement" as "announcement" | "reminder" | "payment" | "attendance" | "grade" | "other",
    target: "all" as "student" | "parent" | "all",
    recipient_type: "all" as "all" | "classes" | "students",
    channel: "in_app" as "email" | "in_app",
    scheduled_at: "",
    status: "draft" as "draft" | "scheduled" | "processing" | "sent" | "failed",
    recipient_classes: [] as string[],
    recipient_students: [] as string[],
  });

  const [studentSearch, setStudentSearch] = useState("");
  const [filterClassId, setFilterClassId] = useState<string | null>(null);

  // Auto-select all when "all" or "students" is chosen
  useEffect(() => {
    if (formData.recipient_type === "all") {
      const allClassIds = (classes || []).map(getObjId).filter(Boolean);
      const allStudentIds = (students || []).map(getObjId).filter(Boolean);

      // Only update if the arrays are actually different to prevent infinite loop
      const classesChanged = JSON.stringify([...formData.recipient_classes].sort()) !== JSON.stringify([...allClassIds].sort());
      const studentsChanged = JSON.stringify([...formData.recipient_students].sort()) !== JSON.stringify([...allStudentIds].sort());

      if (classesChanged || studentsChanged) {
        setFormData(prev => ({
          ...prev,
          recipient_classes: allClassIds,
          recipient_students: allStudentIds
        }));
      }
    } else if (formData.recipient_type === "students") {
      const allClassIds = (classes || []).map(getObjId).filter(Boolean);
      const classesChanged = JSON.stringify([...formData.recipient_classes].sort()) !== JSON.stringify([...allClassIds].sort());

      if (classesChanged) {
        setFormData(prev => ({
          ...prev,
          recipient_classes: allClassIds
        }));
      }
    }
  }, [formData.recipient_type, formData.recipient_classes, formData.recipient_students, classes, students]);

  // Sync students when classes are selected in 'classes' mode.
  // Comparison runs inside the functional updater so the effect doesn't read
  // `recipient_students` (manual toggles by the user are not fought by re-sync).
  useEffect(() => {
    if (formData.recipient_type === "classes") {
      const selectedClassIds = formData.recipient_classes;
      const studentsInSelectedClasses = (students || []).filter((s: any) => {
        const studentClassIds = (s.classes || []).map((c: any) => getObjId(c)).filter(Boolean);
        return studentClassIds.some((id: string) => selectedClassIds.includes(id));
      }).map(getObjId).filter(Boolean);

      setFormData(prev => {
        const studentsChanged = JSON.stringify([...prev.recipient_students].sort()) !== JSON.stringify([...studentsInSelectedClasses].sort());
        if (!studentsChanged) return prev;
        return { ...prev, recipient_students: studentsInSelectedClasses };
      });
    }
  }, [formData.recipient_type, formData.recipient_classes, students]);

  useEffect(() => {
    if (notification) {
      let target = (notification.target || "all") as "student" | "parent" | "all";
      if (isTutor) {
        target = 'all';
      }
      setFormData({
        title: notification.title || "",
        content: notification.content || notification.message || "",
        type: (notification.type || "announcement") as "announcement" | "reminder" | "payment" | "attendance" | "grade" | "other",
        target,
        recipient_type: (notification.recipient_type || "all") as "all" | "classes" | "students",
        channel: (
          notification.channel ||
          (notification.channels && notification.channels[0]) ||
          "in_app"
        ) as "email" | "in_app",
        scheduled_at: notification.scheduled_at
          ? new Date(notification.scheduled_at).toISOString().split("T")[0]
          : "",
        status: notification.status || "draft",
        recipient_classes: (notification.recipient_classes || []).map((id: any) => getObjId(id)).filter(Boolean),
        recipient_students: (notification.recipient_students || []).map((id: any) => getObjId(id)).filter(Boolean),
      });
    }
  }, [notification, isTutor]);

  // Block access if not allowed — sau tất cả hook để giữ hook order ổn định.
  // Chặn khi thiếu quyền update toàn cục HOẶC (đã tải notification mà API báo
  // không có quyền quản lý). Các effect ở trên lo phần điều hướng.
  if (!canUpdateNotification) {
    return null;
  }
  if (user && notification && !canManageFromApi) {
    return null;
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleRichTextChange = (value: string) => {
    setFormData(prev => ({ ...prev, content: value }));
  };

  const toggleClassSelection = (classId: string) => {
    if (!classId || classId === "undefined") return;

    setFormData(prev => {
      // Always switch to 'classes' mode if interacting with class selections

      const isSelected = prev.recipient_classes.includes(classId);
      const newClasses = isSelected
        ? prev.recipient_classes.filter(id => id !== classId)
        : [...prev.recipient_classes, classId];

      return {
        ...prev,
        recipient_type: 'classes',
        recipient_classes: newClasses
      };
    });
  };

  const toggleStudentSelection = (studentId: string) => {
    if (!studentId || studentId === "undefined") return;

    setFormData(prev => {
      // Always switch to 'students' mode if interacting with student selections

      const isSelected = prev.recipient_students.includes(studentId);
      const newStudents = isSelected
        ? prev.recipient_students.filter(id => id !== studentId)
        : [...prev.recipient_students, studentId];

      return {
        ...prev,
        recipient_type: 'students',
        recipient_students: newStudents
      };
    });
  };

  const toggleAllClasses = () => {
    const allClassIds = (classes || []).map(getObjId).filter(Boolean);
    const allSelected = allClassIds.length > 0 && allClassIds.every((id: string) => formData.recipient_classes.includes(id));

    setFormData(prev => ({
      ...prev,
      recipient_classes: allSelected ? [] : allClassIds
    }));
  };

  const toggleAllStudents = () => {
    const allStudentIds = (students || []).map(getObjId).filter(Boolean);
    const allSelected = allStudentIds.length > 0 && allStudentIds.every((id: string) => formData.recipient_students.includes(id));

    setFormData(prev => ({
      ...prev,
      recipient_students: allSelected ? [] : allStudentIds
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim() || !formData.content.trim()) return;

    // Validation based on recipient_type
    if (formData.recipient_type === "classes") {
      const validClasses = formData.recipient_classes.filter(id => id && id !== "undefined");
      if (validClasses.length === 0) {
        alert("Vui lòng chọn ít nhất 1 lớp học khi chọn 'Theo lớp học'");
        return;
      }
    }

    if (formData.recipient_type === "students") {
      const validStudents = formData.recipient_students.filter(id => id && id !== "undefined");
      if (validStudents.length === 0) {
        alert("Vui lòng chọn ít nhất 1 học viên khi chọn 'Theo học viên cụ thể'");
        return;
      }
    }

    const result = await updateNotification(notificationId, {
      title: formData.title,
      content: formData.content,
      type: formData.type,
      target: formData.target,
      recipient_type: formData.recipient_type,
      channel: formData.channel,
      scheduled_at: formData.scheduled_at || undefined,
      status: formData.status,
      recipient_classes: formData.recipient_classes.filter(id => id && id !== "undefined").length > 0
        ? formData.recipient_classes.filter(id => id && id !== "undefined")
        : undefined,
      recipient_students: formData.recipient_students.filter(id => id && id !== "undefined").length > 0
        ? formData.recipient_students.filter(id => id && id !== "undefined")
        : undefined,
    });
    if (result.success) {
      success("Cập nhật thông báo thành công");
      setTimeout(() => {
        router.push(`/notifications/${notificationId}`);
      }, 500);
    }
  };

  if (loadingNotification) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-64 rounded bg-gray-200 dark:bg-gray-700 animate-pulse" />
        <div className="max-w-2xl rounded-lg bg-white p-6 dark:bg-gray-800">
          <div className="space-y-4">
            <div className="h-12 w-full rounded bg-gray-200 dark:bg-gray-700 animate-pulse" />
            <div className="h-24 w-full rounded bg-gray-200 dark:bg-gray-700 animate-pulse" />
            <div className="h-10 w-1/3 rounded bg-gray-200 dark:bg-gray-700 animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  if (notificationError || !notification) {
    return (
      <div className="rounded-lg bg-red-50 border border-red-200 p-6 text-red-600 dark:bg-red-900/20 dark:border-red-800 dark:text-red-400">
        <h3 className="font-medium mb-2">Lỗi tải dữ liệu</h3>
        <p>{notificationError || "Không tìm thấy thông báo"}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
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
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-dark dark:text-white">Chỉnh sửa thông báo</h1>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="max-w-2xl rounded-lg bg-white p-6 dark:bg-gray-800 space-y-6">
        {updateError && (
          <div className="rounded-lg bg-red-50 border border-red-200 p-4 text-red-600 dark:bg-red-900/20 dark:border-red-800 dark:text-red-400">
            {updateError}
          </div>
        )}

        <InputGroup
          type="text"
          label="Tiêu đề"
          placeholder="Nhập tiêu đề"
          name="title"
          value={formData.title}
          handleChange={handleChange}
          icon={<BellIcon />}
          required
        />

        <RichTextEditor
          label="Nội dung"
          value={formData.content}
          onChange={handleRichTextChange}
          placeholder="Nhập nội dung thông báo"
          required
        />

        <SelectInput
          label="Loại thông báo"
          name="type"
          value={formData.type}
          handleChange={handleChange}
          options={[
            { value: "announcement", label: "Thông báo chung" },
            { value: "reminder", label: "Nhắc nhở" },
            { value: "payment", label: "Học phí" },
            { value: "attendance", label: "Điểm danh" },
            { value: "grade", label: "Điểm số" },
          ]}
        />

        <SelectInput
          label="Đối tượng"
          name="target"
          value={formData.target}
          handleChange={handleChange}
          options={[
            { value: "all", label: "Tất cả" },
            { value: "student", label: "Học viên" },
          ]}
        />

        <SelectInput
          label="Phạm vi gửi"
          name="recipient_type"
          value={formData.recipient_type}
          handleChange={handleChange}
          required
          options={[
            { value: "all", label: "Tất cả (Broadcast)" },
            { value: "classes", label: "Theo lớp học" },
            { value: "students", label: "Theo học viên cụ thể" },
          ]}
          helperText={
            formData.recipient_type === "all"
              ? "Gửi cho tất cả. Để loại trừ: Chọn 'Theo lớp/Học viên' > 'Chọn tất cả' > Bỏ chọn đối tượng."
              : formData.recipient_type === "classes"
                ? "Bạn có thể nhấn 'Chọn tất cả' sau đó bỏ chọn những lớp không muốn gửi."
                : "Bạn có thể nhấn 'Chọn tất cả' sau đó bỏ chọn những học viên không muốn gửi."
          }
        />

        <SelectInput
          label="Kênh gửi"
          name="channel"
          value={formData.channel}
          handleChange={handleChange}
          options={[
            { value: "in_app", label: "Trong ứng dụng" },
            { value: "email", label: "Email" },
          ]}
        />

        <DateInput
          label="Ngày gửi (tùy chọn)"
          name="scheduled_at"
          value={formData.scheduled_at}
          handleChange={handleChange}
          icon={<CalendarIcon />}
          placeholder="Chọn ngày gửi"
        />

        {["classes", "all", "students"].includes(formData.recipient_type) && (
          <div className={`transition-opacity duration-200 ${formData.recipient_type !== 'classes' ? 'opacity-50 grayscale pointer-events-none select-none' : ''}`}>
            <div className="mb-2 flex items-center justify-between">
              <label className="block text-sm font-medium text-gray-900 dark:text-white">
                Chọn lớp học <span className="text-red-500">*</span>
              </label>
              {(classes || []).length > 0 && (
                <button
                  type="button"
                  onClick={toggleAllClasses}
                  className="text-xs font-medium text-primary hover:text-primary/80 dark:text-primary-400 dark:hover:text-primary-300"
                >
                  {formData.recipient_classes.length === (classes || []).length
                    ? "Bỏ chọn tất cả"
                    : "Chọn tất cả"}
                </button>
              )}
            </div>
            <div className="rounded-lg border border-gray-300 bg-gray-50 dark:border-gray-600 dark:bg-gray-700">
              {classesLoading ? (
                <div className="p-4 text-center text-sm text-gray-500 dark:text-gray-400">Đang tải...</div>
              ) : (classes || []).length === 0 ? (
                <div className="p-4 text-center text-sm text-gray-500 dark:text-gray-400">Không có lớp học nào</div>
              ) : (
                <div className="max-h-48 overflow-y-auto p-2 space-y-1">
                  {(classes || []).map((cls: any) => {
                    const classId = getObjId(cls);
                    if (!classId) return null;
                    const isSelected = formData.recipient_classes.includes(classId);
                    return (
                      <label
                        key={classId}
                        className={`flex items-center gap-3 rounded-lg p-2 cursor-pointer transition-colors ${isSelected
                          ? "bg-primary/10 text-primary dark:bg-primary/20"
                          : "hover:bg-gray-100 dark:hover:bg-gray-600"
                          }`}
                      >
                        <div className={`flex h-5 w-5 items-center justify-center rounded border-2 ${isSelected
                          ? "border-primary bg-primary"
                          : "border-gray-300 dark:border-gray-500"
                          }`}>
                          {isSelected && (
                            <CheckIcon className="h-3 w-3 text-white" />
                          )}
                        </div>
                        <AcademicCapIcon className="h-4 w-4 text-gray-400" />
                        <span className="flex-1 text-sm text-gray-900 dark:text-white">{cls.name}</span>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleClassSelection(classId)}
                          className="sr-only"
                        />
                      </label>
                    );
                  })}
                </div>
              )}
            </div>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              {formData.recipient_classes.length > 0
                ? `Đã chọn ${formData.recipient_classes.length} lớp`
                : "Vui lòng chọn ít nhất 1 lớp học"}
            </p>
          </div>
        )}

        {["students", "all", "classes"].includes(formData.recipient_type) && (
          <div className={`transition-opacity duration-200 ${formData.recipient_type !== 'students' ? 'opacity-50 grayscale pointer-events-none select-none' : ''}`}>
            <div className="mb-2 flex items-center justify-between">
              <label className="block text-sm font-medium text-gray-900 dark:text-white">
                Chọn học viên <span className="text-red-500">*</span>
              </label>
              {(students || []).length > 0 && (
                <button
                  type="button"
                  onClick={toggleAllStudents}
                  className="text-xs font-medium text-primary hover:text-primary/80 dark:text-primary-400 dark:hover:text-primary-300"
                >
                  {formData.recipient_students.length === (students || []).length
                    ? "Bỏ chọn tất cả"
                    : "Chọn tất cả"}
                </button>
              )}
            </div>
            <div className="mb-4 space-y-3">
              {/* Search and Class Filter */}
              <div className="relative">
                <MagnifyingGlassIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Tìm tên học viên..."
                  value={studentSearch}
                  onChange={(e) => setStudentSearch(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 bg-white py-2 pl-9 pr-4 text-sm focus:border-primary focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                />
                {studentSearch && (
                  <button
                    type="button"
                    onClick={() => setStudentSearch("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    <XMarkIcon className="h-4 w-4" />
                  </button>
                )}
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setFilterClassId(null)}
                  className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${filterClassId === null
                    ? "bg-primary text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300"
                    }`}
                >
                  Tất cả
                </button>
                {(classes || []).map((cls: any) => {
                  const id = getObjId(cls);
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setFilterClassId(id)}
                      className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${filterClassId === id
                        ? "bg-primary text-white"
                        : "bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300"
                        }`}
                    >
                      {cls.name}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="rounded-lg border border-gray-300 bg-gray-50 dark:border-gray-600 dark:bg-gray-700">
              {studentsLoading ? (
                <div className="p-4 text-center text-sm text-gray-500 dark:text-gray-400">Đang tải...</div>
              ) : (students || []).length === 0 ? (
                <div className="p-4 text-center text-sm text-gray-500 dark:text-gray-400">Không có học viên nào</div>
              ) : (
                <div className="max-h-60 overflow-y-auto p-2 space-y-1">
                  {(students || []).filter((s: any) => {
                    // Filter by recipient_type = 'classes' logic (inherited from previous step)
                    if (formData.recipient_type === 'classes') {
                      const studentClassIds = (s.classes || []).map((c: any) => getObjId(c)).filter(Boolean);
                      return studentClassIds.some((id: string) => formData.recipient_classes.includes(id));
                    }

                    // Filter by search term
                    if (studentSearch && !s.name.toLowerCase().includes(studentSearch.toLowerCase())) {
                      return false;
                    }

                    // Filter by selected class chip
                    if (filterClassId) {
                      const studentClassIds = (s.classes || []).map((c: any) => getObjId(c)).filter(Boolean);
                      if (!studentClassIds.includes(filterClassId)) return false;
                    }

                    return true;
                  }).map((student: any) => {
                    const studentId = getObjId(student);
                    if (!studentId) return null;
                    const isSelected = formData.recipient_students.includes(studentId);
                    const studentClasses = (student.classes || []).map((c: any) => c.name).join(", ");

                    return (
                      <label
                        key={studentId}
                        className={`flex items-center gap-3 rounded-lg p-2 cursor-pointer transition-colors ${isSelected
                          ? "bg-primary/10 text-primary dark:bg-primary/20"
                          : "hover:bg-gray-100 dark:hover:bg-gray-600"
                          }`}
                      >
                        <div className={`flex h-5 w-5 items-center justify-center rounded border-2 ${isSelected
                          ? "border-primary bg-primary"
                          : "border-gray-300 dark:border-gray-500"
                          }`}>
                          {isSelected && (
                            <CheckIcon className="h-3 w-3 text-white" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-gray-900 dark:text-white truncate">{student.name}</span>
                            {student.email_verified && <CheckCircleIcon className="h-3 w-3 text-green-500" title="Email đã xác thực" />}
                          </div>
                          <div className="flex flex-col">
                            {studentClasses && (
                              <p className="text-[10px] text-gray-500 dark:text-gray-400 truncate">{studentClasses}</p>
                            )}
                            {(student.email || student.phone) && (
                              <p className="text-[10px] text-gray-400 dark:text-gray-500 truncate">
                                {student.email && <span>{student.email}</span>}
                                {student.email && student.phone && <span className="mx-1">|</span>}
                                {student.phone && <span>{student.phone}</span>}
                              </p>
                            )}
                          </div>
                        </div>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleStudentSelection(studentId)}
                          className="sr-only"
                        />
                      </label>
                    );
                  })}
                  {(students || []).filter((s: any) => {
                    if (formData.recipient_type === 'classes') {
                      const studentClassIds = (s.classes || []).map((c: any) => getObjId(c)).filter(Boolean);
                      return studentClassIds.some((id: string) => formData.recipient_classes.includes(id));
                    }
                    if (studentSearch && !s.name.toLowerCase().includes(studentSearch.toLowerCase())) return false;
                    if (filterClassId) {
                      const studentClassIds = (s.classes || []).map((c: any) => getObjId(c)).filter(Boolean);
                      if (!studentClassIds.includes(filterClassId)) return false;
                    }
                    return true;
                  }).length === 0 && (
                      <div className="p-4 text-center text-sm text-gray-500 dark:text-gray-400 italic">
                        Không tìm thấy học viên phù hợp
                      </div>
                    )}
                </div>
              )}
            </div>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              {formData.recipient_students.length > 0
                ? `Đã chọn ${formData.recipient_students.length} học viên`
                : "Vui lòng chọn ít nhất 1 học viên"}
            </p>
          </div>
        )}

        <SelectInput
          label="Trạng thái"
          name="status"
          value={formData.status}
          handleChange={handleChange}
          options={[
            { value: "draft", label: "Bản nháp" },
            { value: "scheduled", label: "Đã lên lịch" },
            { value: "processing", label: "Đang xử lý" },
            { value: "sent", label: "Đã gửi" },
            { value: "failed", label: "Thất bại" },
          ]}
        />

        <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-3 sm:gap-4">
          <ButtonLink
            href={`/notifications/${notificationId}`}
            variant="outline"
            size="sm"
            className="w-full sm:w-auto justify-center"
          >
            Hủy
          </ButtonLink>
          <Button
            type="submit"
            disabled={updateLoading}
            loading={updateLoading}
            size="sm"
            variant="primary"
            icon={<CheckCircleIcon />}
            className="w-full sm:w-auto justify-center"
          >
            Cập nhật
          </Button>
        </div>
      </form>
    </div>
  );
}


