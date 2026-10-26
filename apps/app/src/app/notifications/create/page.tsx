"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import InputGroup from "@/components/FormElements/InputGroup";
import DateInput from "@/components/FormElements/DateInput";
import { useCreateNotification, useClasses, useStudents } from "@/hooks/use-api";
import { useGoBack } from "@/hooks/use-go-back";
import { useAuthContext } from "@/contexts/auth-context";
import { useResourceGuard } from "@/lib/permission-guards";
import { ArrowLeftIcon, BellIcon, CalendarIcon, AcademicCapIcon, CheckIcon, CheckCircleIcon } from "@heroicons/react/24/outline";
import SelectInput from "@/components/FormElements/SelectInput";
import Button from "@/components/Common/Button";
import ButtonLink from "@/components/Common/ButtonLink";
import UserInfoBox from "@/components/User/UserInfoBox";
import RichTextEditor from "@/components/FormElements/RichTextEditorDynamic";

import { getObjId } from "@/lib/id-utils";

export default function CreateNotificationPage() {
  const router = useRouter();
  const { user } = useAuthContext();
  const handleGoBack = useGoBack('/notifications');

  // Use resource guard to protect this route
  useResourceGuard(
    user,
    'create',
    'notification',
    '/403'
  );

  // All hooks must be called before any early returns
  const { mutate: createNotification, loading, error } = useCreateNotification();
  const { data: classes, loading: classesLoading } = useClasses();
  const { data: students, loading: studentsLoading } = useStudents();



  const [formData, setFormData] = useState({
    title: "",
    content: "",
    type: "announcement" as "announcement" | "reminder" | "payment" | "attendance" | "grade" | "other",
    target: "all" as "student" | "parent" | "tutor" | "all",
    recipient_type: "all" as "all" | "classes" | "students",
    channel: "in_app" as "email" | "in_app",
    scheduled_at: "",
    recipient_classes: [] as string[],
    recipient_students: [] as string[],
  });

  // Auto-select all when "all" is chosen
  useEffect(() => {
    if (formData.recipient_type === "all") {
      const allClassIds = (classes || []).map(getObjId).filter(Boolean);
      const allStudentIds = (students || []).map(getObjId).filter(Boolean);

      // Only update if the arrays are actually different to prevent infinite loop
      const classesChanged = JSON.stringify(formData.recipient_classes.sort()) !== JSON.stringify(allClassIds.sort());
      const studentsChanged = JSON.stringify(formData.recipient_students.sort()) !== JSON.stringify(allStudentIds.sort());

      if (classesChanged || studentsChanged) {
        setFormData(prev => ({
          ...prev,
          recipient_classes: allClassIds,
          recipient_students: allStudentIds
        }));
      }
    }
  }, [formData.recipient_type, formData.recipient_classes, formData.recipient_students, classes, students]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleRichTextChange = (value: string) => {
    setFormData(prev => ({ ...prev, content: value }));
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

    const result = await createNotification({
      title: formData.title,
      content: formData.content,
      type: formData.type,
      target: formData.target,
      recipient_type: formData.recipient_type,
      channel: formData.channel,
      scheduled_at: formData.scheduled_at || undefined,
      recipient_classes: formData.recipient_classes.filter(id => id && id !== "undefined").length > 0
        ? formData.recipient_classes.filter(id => id && id !== "undefined")
        : undefined,
      recipient_students: formData.recipient_students.filter(id => id && id !== "undefined").length > 0
        ? formData.recipient_students.filter(id => id && id !== "undefined")
        : undefined,
    });
    if (result.success) router.push("/notifications");
  };

  const toggleClassSelection = (classId: string) => {
    if (!classId || classId === "undefined") return;

    setFormData(prev => {
      // Always switch to 'classes' mode if interacting with class selections
      // This allows seamless switching between modes without hiding lists

      const isSelected = prev.recipient_classes.includes(classId);
      const newClasses = isSelected
        ? prev.recipient_classes.filter(id => id !== classId && id !== "undefined")
        : [...prev.recipient_classes.filter(id => id !== "undefined"), classId];

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
        ? prev.recipient_students.filter(id => id !== studentId && id !== "undefined")
        : [...prev.recipient_students.filter(id => id !== "undefined"), studentId];

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
        <div className="flex-1 min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold text-dark dark:text-white truncate">Tạo thông báo</h1>
          <p className="text-dark-4 dark:text-dark-6 mt-1 break-words">Gửi thông báo đến học viên/phụ huynh</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="max-w-2xl rounded-lg bg-white p-6 dark:bg-gray-800 space-y-6">
        {error && (
          <div className="rounded-lg bg-red-50 border border-red-200 p-4 text-red-600 dark:bg-red-900/20 dark:border-red-800 dark:text-red-400">
            {error}
          </div>
        )}

        <InputGroup
          type="text"
          label="Tiêu đề"
          placeholder="Nhập tiêu đề thông báo"
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
          required
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
          required
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
          required
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
          <div className={`transition-opacity duration-200 ${formData.recipient_type === 'students' ? 'opacity-50 grayscale pointer-events-none select-none' : ''}`}>
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
          <div className={`transition-opacity duration-200 ${formData.recipient_type === 'classes' ? 'opacity-50 grayscale pointer-events-none select-none' : ''}`}>
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
            <div className="rounded-lg border border-gray-300 bg-gray-50 dark:border-gray-600 dark:bg-gray-700">
              {studentsLoading ? (
                <div className="p-4 text-center text-sm text-gray-500 dark:text-gray-400">Đang tải...</div>
              ) : (students || []).length === 0 ? (
                <div className="p-4 text-center text-sm text-gray-500 dark:text-gray-400">Không có học viên nào</div>
              ) : (
                <div className="max-h-48 overflow-y-auto p-2 space-y-1">
                  {(students || []).map((student: any) => {
                    const studentId = getObjId(student);
                    if (!studentId) return null;
                    const isSelected = formData.recipient_students.includes(studentId);
                    return (
                      <label
                        key={studentId}
                        className={`flex items-center gap-3 rounded-lg p-2 cursor-pointer transition-colors ${isSelected
                          ? "bg-primary/10 text-primary dark:bg-primary/20"
                          : "hover:bg-gray-100 dark:hover:bg-gray-600"
                          }`}
                      >
                        <div className={`flex h-5 w-5 items-center justify-center rounded border-2 flex-shrink-0 ${isSelected
                          ? "border-primary bg-primary"
                          : "border-gray-300 dark:border-gray-500"
                          }`}>
                          {isSelected && (
                            <CheckIcon className="h-3 w-3 text-white" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <UserInfoBox
                            name={student.name}
                            email={student.email || "Chưa có email"}
                            emailVerified={student.email_verified || false}
                            phone={student.phone}
                            role={student.role}
                            showRole={false}
                            size="sm"
                            layout="horizontal"
                          />
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

        <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-3 sm:gap-4">
          <ButtonLink
            href="/notifications"
            variant="outline"
            size="sm"
            className="w-full sm:w-auto justify-center"
          >
            Hủy
          </ButtonLink>
          <Button
            type="submit"
            disabled={loading}
            loading={loading}
            size="sm"
            variant="primary"
            icon={<CheckCircleIcon />}
            className="w-full sm:w-auto justify-center"
          >
            Tạo thông báo
          </Button>
        </div>
      </form>
    </div>
  );
}


