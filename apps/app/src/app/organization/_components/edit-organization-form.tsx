"use client";

import { useState } from "react";
import InputGroup from "@/components/FormElements/InputGroup";
import { TextAreaGroup } from "@/components/FormElements/InputGroup/text-area";
import Button from "@/components/Common/Button";
import { useUpdateOrganization } from "@/hooks/use-api";
import { useOrganizationContext } from "@/contexts/organization-context";
import { useNotification } from "@/hooks/use-notification";
import { extractErrorMessage, extractFieldErrors } from "@/lib/api-error-utils";
import type { Organization } from "@/types/organization";

/**
 * Chỉnh sửa thông tin trung tâm (tên/mô tả). Chỉ owner/manager.
 */
export function EditOrganizationForm({ organization }: { organization: Organization }) {
  const { mutate: updateOrg, loading } = useUpdateOrganization();
  const { refetch } = useOrganizationContext();
  const { success, error: showError } = useNotification();

  const [form, setForm] = useState({
    name: organization.name ?? "",
    description: organization.description ?? "",
  });
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      setFieldErrors({ name: "Vui lòng nhập tên trung tâm" });
      return;
    }
    setFieldErrors({});

    const res = await updateOrg(organization.id, {
      name: form.name.trim(),
      description: form.description.trim(),
    });

    if (res.success) {
      success("Đã cập nhật thông tin trung tâm!");
      refetch();
    } else {
      setFieldErrors(extractFieldErrors(res));
      showError(extractErrorMessage(res, "Không thể cập nhật trung tâm. Vui lòng thử lại."));
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5 rounded-lg bg-white p-4 dark:bg-gray-800 sm:p-6">
      <div>
        <h3 className="text-base font-semibold text-dark dark:text-white sm:text-lg">
          Thông tin trung tâm
        </h3>
        <p className="mt-1 text-sm text-dark-4 dark:text-dark-6">
          Cập nhật tên và mô tả hiển thị của trung tâm
        </p>
      </div>

      <InputGroup
        label="Tên trung tâm"
        name="name"
        type="text"
        required
        placeholder="Tên trung tâm"
        value={form.name}
        handleChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
        error={fieldErrors.name}
      />

      <div>
        <TextAreaGroup
          label="Mô tả"
          name="description"
          rows={4}
          placeholder="Giới thiệu ngắn về trung tâm"
          value={form.description}
          onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
        />
        {fieldErrors.description && (
          <p className="mt-1 text-sm text-red-500">{fieldErrors.description}</p>
        )}
      </div>

      <div className="flex justify-end">
        <Button type="submit" loading={loading} disabled={loading}>
          Lưu thay đổi
        </Button>
      </div>
    </form>
  );
}
