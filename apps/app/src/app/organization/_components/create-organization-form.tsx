"use client";

import { useState } from "react";
import InputGroup from "@/components/FormElements/InputGroup";
import { TextAreaGroup } from "@/components/FormElements/InputGroup/text-area";
import Button from "@/components/Common/Button";
import { BuildingOffice2Icon } from "@heroicons/react/24/outline";
import { useCreateOrganization } from "@/hooks/use-api";
import { useOrganizationContext } from "@/contexts/organization-context";
import { useNotification } from "@/hooks/use-notification";
import { extractErrorMessage, extractFieldErrors } from "@/lib/api-error-utils";

/**
 * Form tạo trung tâm — dành cho giáo viên có gói mở khoá tính năng nhưng chưa
 * thuộc trung tâm nào (đường đi của chủ trung tâm).
 */
export function CreateOrganizationForm() {
  const { mutate: createOrg, loading } = useCreateOrganization();
  const { refetch } = useOrganizationContext();
  const { success, error: showError } = useNotification();

  const [form, setForm] = useState({ name: "", description: "" });
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!form.name.trim()) {
      setFieldErrors({ name: "Vui lòng nhập tên trung tâm" });
      return;
    }
    setFieldErrors({});

    const res = await createOrg({
      name: form.name.trim(),
      description: form.description.trim() || undefined,
    });

    if (res.success) {
      success("Đã tạo trung tâm thành công!");
      refetch();
    } else {
      if (res.code === "ALREADY_IN_ORGANIZATION") {
        showError("Bạn đã thuộc một trung tâm khác. Vui lòng tải lại trang.");
        refetch();
        return;
      }
      setFieldErrors(extractFieldErrors(res));
      showError(extractErrorMessage(res, "Không thể tạo trung tâm. Vui lòng thử lại."));
    }
  };

  return (
    <div className="rounded-lg bg-white p-6 dark:bg-gray-800">
      <div className="mb-6 flex items-start gap-4">
        <div className="rounded-lg bg-primary-pastel/40 p-3">
          <BuildingOffice2Icon className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-dark dark:text-white">
            Tạo trung tâm của bạn
          </h2>
          <p className="mt-1 text-sm text-dark-4 dark:text-dark-6">
            Thiết lập trung tâm để thêm gia sư, phân công lớp học và theo dõi
            hoạt động của cả đội ngũ.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <InputGroup
          label="Tên trung tâm"
          name="name"
          type="text"
          required
          placeholder="VD: Trung tâm Anh ngữ Bright"
          value={form.name}
          handleChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
          error={fieldErrors.name}
        />

        <div>
          <TextAreaGroup
            label="Mô tả (không bắt buộc)"
            name="description"
            rows={4}
            placeholder="Giới thiệu ngắn về trung tâm của bạn"
            value={form.description}
            onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
          />
          {fieldErrors.description && (
            <p className="mt-1 text-sm text-red-500">{fieldErrors.description}</p>
          )}
        </div>

        <div className="flex justify-end">
          <Button type="submit" loading={loading} disabled={loading}>
            Tạo trung tâm
          </Button>
        </div>
      </form>
    </div>
  );
}
