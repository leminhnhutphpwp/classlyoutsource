"use client";

import { useState } from "react";
import InputGroup from "@/components/FormElements/InputGroup";
import SelectInput from "@/components/FormElements/SelectInput";
import Button from "@/components/Common/Button";
import { UserPlusIcon } from "@heroicons/react/24/outline";
import { useCreateOrgMember } from "@/hooks/use-api";
import type { CreateOrgMemberPayload } from "@/hooks/use-api";
import { useOrganizationContext } from "@/contexts/organization-context";
import { useNotification } from "@/hooks/use-notification";
import { extractErrorMessage } from "@/lib/api-error-utils";

type TutorRole = NonNullable<CreateOrgMemberPayload["org_role"]>;

/**
 * Tạo trực tiếp tài khoản gia sư cho trung tâm (không còn mời qua email).
 * - Chỉ CHỦ trung tâm (owner) mới thấy ô chọn vai trò và có thể tạo "Quản lý";
 *   quản lý chỉ tạo được gia sư.
 * - Trùng email → 422 EMAIL_ALREADY_EXISTS: nhắc dùng email mới.
 */
export function AddTutorForm({ orgHash }: { orgHash: string }) {
  const { myRole, refetch } = useOrganizationContext();
  const { mutate: createMember, loading } = useCreateOrgMember();
  const { success } = useNotification();

  const isOwner = myRole === "owner";

  const [form, setForm] = useState<{
    name: string;
    email: string;
    phone: string;
    org_role: TutorRole;
  }>({ name: "", email: "", phone: "", org_role: "tutor" });
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const setField = (key: keyof typeof form, value: string) => {
    setForm((p) => ({ ...p, [key]: value }));
    if (fieldErrors[key]) setFieldErrors((p) => ({ ...p, [key]: "" }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const name = form.name.trim();
    const email = form.email.trim();
    const phone = form.phone.trim();
    const errs: Record<string, string> = {};
    if (!name) errs.name = "Vui lòng nhập họ tên gia sư";
    if (!email) errs.email = "Vui lòng nhập email gia sư";
    if (Object.keys(errs).length > 0) {
      setFieldErrors(errs);
      return;
    }
    setFieldErrors({});

    const res = await createMember(orgHash, {
      name,
      email,
      phone: phone || undefined,
      // Manager không được tạo manager → chỉ owner mới gửi org_role tuỳ chọn.
      org_role: isOwner ? form.org_role : "tutor",
    });

    if (res.success) {
      const roleLabel =
        form.org_role === "manager"
          ? "Quản lý"
          : form.org_role === "accountant"
            ? "Kế toán"
            : "Gia sư";
      success(
        "Đã thêm gia sư!",
        `${name} đã được thêm vào trung tâm (${isOwner ? roleLabel : "Gia sư"}). Gia sư cần đặt mật khẩu để kích hoạt.`
      );
      setForm({ name: "", email: "", phone: "", org_role: "tutor" });
      refetch();
      return;
    }

    if (res.code === "EMAIL_ALREADY_EXISTS") {
      setFieldErrors({
        email:
          "Email này đã có tài khoản — gia sư của trung tâm phải dùng email mới.",
      });
      return;
    }

    setFieldErrors((p) => ({
      ...p,
      form: extractErrorMessage(res, "Không thể thêm gia sư. Vui lòng thử lại."),
    }));
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-lg bg-white p-4 dark:bg-gray-800 sm:p-6"
    >
      <div className="mb-4 flex items-center gap-2">
        <UserPlusIcon className="h-5 w-5 text-primary" />
        <h3 className="text-base font-semibold text-dark dark:text-white sm:text-lg">
          Thêm gia sư
        </h3>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <InputGroup
          label="Họ tên gia sư"
          name="name"
          type="text"
          required
          placeholder="VD: Nguyễn Văn A"
          value={form.name}
          handleChange={(e) => setField("name", e.target.value)}
          error={fieldErrors.name || undefined}
        />
        <InputGroup
          label="Email"
          name="email"
          type="email"
          required
          placeholder="email@vidu.com"
          value={form.email}
          handleChange={(e) => setField("email", e.target.value)}
          error={fieldErrors.email || undefined}
        />
        <InputGroup
          label="Số điện thoại (không bắt buộc)"
          name="phone"
          type="tel"
          placeholder="VD: 0901234567"
          value={form.phone}
          handleChange={(e) => setField("phone", e.target.value)}
          error={fieldErrors.phone || undefined}
        />
        {isOwner && (
          <SelectInput
            label="Vai trò"
            name="org_role"
            value={form.org_role}
            onChange={(e) => setField("org_role", e.target.value)}
            searchable={false}
            options={[
              { value: "tutor", label: "Gia sư" },
              { value: "manager", label: "Quản lý" },
              { value: "accountant", label: "Kế toán" },
            ]}
          />
        )}
      </div>

      {fieldErrors.form && (
        <p className="mt-3 text-sm text-red-500">{fieldErrors.form}</p>
      )}

      <div className="mt-4 flex items-center justify-between gap-3">
        <p className="text-xs text-dark-4 dark:text-dark-6">
          Trung tâm tạo tài khoản cho gia sư bằng một email mới; gia sư đặt mật
          khẩu để kích hoạt.
        </p>
        <Button type="submit" loading={loading} disabled={loading} className="shrink-0">
          Thêm gia sư
        </Button>
      </div>
    </form>
  );
}
