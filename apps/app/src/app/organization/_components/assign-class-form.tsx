"use client";

import { useMemo, useState } from "react";
import SelectInput from "@/components/FormElements/SelectInput";
import Button from "@/components/Common/Button";
import { ArrowsRightLeftIcon } from "@heroicons/react/24/outline";
import { useClasses, useAssignClassTutor } from "@/hooks/use-api";
import { useOrganizationContext } from "@/contexts/organization-context";
import { useNotification } from "@/hooks/use-notification";
import { extractErrorMessage } from "@/lib/api-error-utils";
import { getObjId } from "@/lib/id-utils";

/**
 * Phân công lại giáo viên phụ trách một lớp cho một thành viên của trung tâm.
 * POST /organizations/{orgHash}/classes/{classHash}/assign { tutor_id }.
 */
export function AssignClassForm({ orgHash }: { orgHash: string }) {
  const { members } = useOrganizationContext();
  const { data: classes, loading: classesLoading } = useClasses({ per_page: 100 });
  const { mutate: assign, loading: assigning } = useAssignClassTutor();
  const { success, error: showError } = useNotification();

  const [classId, setClassId] = useState("");
  const [tutorId, setTutorId] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  // Chỉ giao lớp cho thành viên đang hoạt động.
  const assignableMembers = useMemo(
    () => members.filter((m) => m.status === "active"),
    [members]
  );

  const classList: Array<Record<string, unknown>> = Array.isArray(classes) ? classes : [];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!classId || !tutorId) {
      setFormError("Vui lòng chọn lớp học và giáo viên phụ trách.");
      return;
    }
    setFormError(null);

    const res = await assign(orgHash, classId, tutorId);
    if (res.success) {
      success("Đã phân công lớp học cho giáo viên.");
      setClassId("");
      setTutorId("");
    } else {
      showError(extractErrorMessage(res, "Không thể phân công lớp. Vui lòng thử lại."));
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-lg bg-white p-4 dark:bg-gray-800 sm:p-6"
    >
      <div className="mb-4 flex items-center gap-2">
        <ArrowsRightLeftIcon className="h-5 w-5 text-primary" />
        <h3 className="text-base font-semibold text-dark dark:text-white sm:text-lg">
          Phân công lớp học
        </h3>
      </div>
      <p className="mb-4 text-sm text-dark-4 dark:text-dark-6">
        Chuyển giáo viên phụ trách chính của một lớp sang một thành viên trong trung tâm.
      </p>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <SelectInput
          label="Lớp học"
          name="class_id"
          value={classId}
          onChange={(e) => setClassId(e.target.value)}
          disabled={classesLoading}
          placeholder={classesLoading ? "Đang tải..." : "Chọn lớp học"}
          options={classList.map((c) => ({
            value: getObjId(c),
            label: String((c as { name?: string }).name ?? ""),
          }))}
        />
        <SelectInput
          label="Giáo viên phụ trách"
          name="tutor_id"
          value={tutorId}
          onChange={(e) => setTutorId(e.target.value)}
          placeholder="Chọn giáo viên"
          options={assignableMembers.map((m) => ({
            value: m.id,
            label: `${m.name} (${m.email})`,
          }))}
        />
      </div>

      {formError && <p className="mt-2 text-sm text-red-500">{formError}</p>}

      <div className="mt-4 flex justify-end">
        <Button type="submit" loading={assigning} disabled={assigning}>
          Phân công
        </Button>
      </div>
    </form>
  );
}
