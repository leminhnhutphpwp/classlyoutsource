"use client";

import { useMemo, useState } from "react";
import { PencilSquareIcon, PlusIcon } from "@heroicons/react/24/outline";
import Button from "@/components/Common/Button";
import FormModal from "@/components/Common/FormModal";
import InputGroup from "@/components/FormElements/InputGroup";
import SelectInput from "@/components/FormElements/SelectInput";
import { TableSkeleton } from "@/components/ui/loading";
import ErrorDisplay from "@/components/Common/ErrorDisplay";
import { formatAmount, parseAmount } from "@/lib/format-currency";
import { useOrganizationContext } from "@/contexts/organization-context";
import { useNotification } from "@/hooks/use-notification";
import { extractErrorMessage } from "@/lib/api-error-utils";
import {
  useCompensationProfiles,
  useUpsertCompensationProfile,
} from "@/hooks/use-api";
import { Panel, EmptyRow, TableHead } from "./finance-ui";
import { PAY_MODEL_LABELS } from "./payroll-ui";
import { money, percent } from "./finance-format";
import type {
  CompensationProfile,
  PayModel,
  UpsertCompensationProfilePayload,
} from "@/types/org-payroll";

const PAY_MODEL_OPTIONS = [
  { value: "fixed_monthly", label: PAY_MODEL_LABELS.fixed_monthly },
  { value: "per_session", label: PAY_MODEL_LABELS.per_session },
  { value: "revenue_share", label: PAY_MODEL_LABELS.revenue_share },
];

function rateSummary(p: CompensationProfile): string {
  switch (p.pay_model) {
    case "fixed_monthly":
      return money(p.fixed_monthly_amount);
    case "per_session":
      return `${money(p.per_session_rate)}/buổi`;
    case "revenue_share":
      return percent(p.revenue_share_pct);
    default:
      return "—";
  }
}

export function CompensationProfiles({ orgHash }: { orgHash: string }) {
  const { members, canManagePayroll } = useOrganizationContext();
  const { data, loading, error, refetch } = useCompensationProfiles(orgHash);
  const { mutate: upsert, loading: saving } = useUpsertCompensationProfile();
  const { success, error: showError } = useNotification();

  const profiles = data ?? [];
  const [editing, setEditing] = useState<CompensationProfile | null>(null);
  const [formOpen, setFormOpen] = useState(false);

  const tutorName = useMemo(() => {
    const map = new Map(members.map((m) => [m.id, m.name]));
    return (id: string) => map.get(id) ?? id;
  }, [members]);

  const handleSubmit = async (payload: UpsertCompensationProfilePayload) => {
    const res = await upsert(orgHash, payload);
    if (res.success) {
      success("Đã lưu hồ sơ lương");
      setFormOpen(false);
      setEditing(null);
      refetch();
    } else {
      showError(extractErrorMessage(res, "Không thể lưu hồ sơ lương."));
    }
  };

  if (error && !loading) {
    return (
      <ErrorDisplay
        title="Không tải được hồ sơ lương"
        error={error}
        onRetry={() => refetch()}
      />
    );
  }

  return (
    <div className="space-y-4">
      {/* `key`: các trường khởi tạo state từ prop `profile` bằng useState, mà hàm khởi tạo
          chỉ chạy lúc mount. Không có key thì mở "Sửa" hồ sơ khác trong lúc form đang mở
          sẽ giữ nguyên dữ liệu cũ trên màn hình nhưng lưu vào hồ sơ mới. */}
      {canManagePayroll && formOpen && (
        <CompProfileForm
          key={editing?.tutor_id ?? "new"}
          profile={editing}
          saving={saving}
          onCancel={() => {
            setFormOpen(false);
            setEditing(null);
          }}
          onSubmit={handleSubmit}
        />
      )}

      <Panel
        title="Hồ sơ lương giáo viên"
        subtitle="Cấu hình cách tính lương cho từng giáo viên"
        action={
          canManagePayroll ? (
            <Button
              icon={<PlusIcon />}
              size="sm"
              onClick={() => {
                setEditing(null);
                setFormOpen(true);
              }}
            >
              Thêm/sửa hồ sơ
            </Button>
          ) : undefined
        }
      >
        {loading && profiles.length === 0 ? (
          <div className="p-4 sm:p-6">
            <TableSkeleton rows={4} cols={4} />
          </div>
        ) : profiles.length === 0 ? (
          <EmptyRow message="Chưa có hồ sơ lương nào." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-left text-sm">
              <TableHead>
                <tr>
                  <th className="px-4 py-3 sm:px-6">Giáo viên</th>
                  <th className="px-4 py-3">Mô hình lương</th>
                  <th className="px-4 py-3 text-right">Mức lương</th>
                  {canManagePayroll && (
                    <th className="px-4 py-3 text-right sm:px-6">Thao tác</th>
                  )}
                </tr>
              </TableHead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {profiles.map((p) => (
                  <tr key={p.id} className="text-gray-900 dark:text-gray-200">
                    <td className="px-4 py-3 font-medium sm:px-6">
                      {p.tutor_name || tutorName(p.tutor_id)}
                    </td>
                    <td className="px-4 py-3">
                      {PAY_MODEL_LABELS[p.pay_model] ?? p.pay_model}
                    </td>
                    <td className="px-4 py-3 text-right">{rateSummary(p)}</td>
                    {canManagePayroll && (
                      <td className="px-4 py-3 text-right sm:px-6">
                        <Button
                          variant="outline"
                          size="sm"
                          icon={<PencilSquareIcon />}
                          onClick={() => {
                            setEditing(p);
                            setFormOpen(true);
                          }}
                        >
                          Sửa
                        </Button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}

function CompProfileForm({
  profile,
  saving,
  onCancel,
  onSubmit,
}: {
  profile: CompensationProfile | null;
  saving: boolean;
  onCancel: () => void;
  onSubmit: (payload: UpsertCompensationProfilePayload) => void;
}) {
  const { members } = useOrganizationContext();
  const [tutorId, setTutorId] = useState(profile?.tutor_id ?? "");
  const [payModel, setPayModel] = useState<PayModel>(
    profile?.pay_model ?? "fixed_monthly",
  );
  const [fixed, setFixed] = useState(
    profile?.fixed_monthly_amount
      ? formatAmount(profile.fixed_monthly_amount)
      : "",
  );
  const [perSession, setPerSession] = useState(
    profile?.per_session_rate ? formatAmount(profile.per_session_rate) : "",
  );
  const [sharePct, setSharePct] = useState(
    profile?.revenue_share_pct != null ? String(profile.revenue_share_pct) : "",
  );
  const [err, setErr] = useState("");

  const tutorOptions = [
    { value: "", label: "— Chọn giáo viên —" },
    ...members
      .filter((m) => m.status !== "removed" && m.org_role === "tutor")
      .map((m) => ({ value: m.id, label: m.name })),
  ];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!tutorId) {
      setErr("Vui lòng chọn giáo viên.");
      return;
    }
    const payload: UpsertCompensationProfilePayload = {
      tutor_id: tutorId,
      pay_model: payModel,
    };
    if (payModel === "fixed_monthly") {
      const v = parseAmount(fixed);
      if (!v || v <= 0) return setErr("Nhập mức lương cố định hợp lệ.");
      payload.fixed_monthly_amount = v;
    } else if (payModel === "per_session") {
      const v = parseAmount(perSession);
      if (!v || v <= 0) return setErr("Nhập mức lương theo buổi hợp lệ.");
      payload.per_session_rate = v;
    } else {
      const v = Number(sharePct);
      if (!Number.isFinite(v) || v <= 0 || v > 100)
        return setErr("Nhập % chia doanh thu (1–100).");
      payload.revenue_share_pct = v;
    }
    setErr("");
    onSubmit(payload);
  };

  return (
    <FormModal
      title={profile ? "Sửa hồ sơ lương" : "Thêm hồ sơ lương"}
      onClose={onCancel}
      closeDisabled={saving}
    >
      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <SelectInput
            label="Giáo viên"
            name="tutor_id"
            value={tutorId}
            onChange={(e) => setTutorId(e.target.value)}
            options={tutorOptions}
            disabled={!!profile}
          />
          <SelectInput
            label="Mô hình lương"
            name="pay_model"
            value={payModel}
            onChange={(e) => setPayModel(e.target.value as PayModel)}
            options={PAY_MODEL_OPTIONS}
            searchable={false}
          />
          {payModel === "fixed_monthly" && (
            <InputGroup
              label="Lương cố định/tháng (đ)"
              name="fixed"
              type="text"
              value={fixed}
              handleChange={(e) => setFixed(formatAmount(e.target.value))}
              placeholder="VD: 15.000.000"
            />
          )}
          {payModel === "per_session" && (
            <InputGroup
              label="Lương mỗi buổi (đ)"
              name="per_session"
              type="text"
              value={perSession}
              handleChange={(e) => setPerSession(formatAmount(e.target.value))}
              placeholder="VD: 300.000"
            />
          )}
          {payModel === "revenue_share" && (
            <InputGroup
              label="Tỷ lệ chia doanh thu (%)"
              name="share_pct"
              type="number"
              min={1}
              max={100}
              value={sharePct}
              handleChange={(e) => setSharePct(e.target.value)}
              placeholder="VD: 60"
            />
          )}
        </div>
        {err && <p className="mt-3 text-sm text-red-500">{err}</p>}
        <div className="mt-5 flex justify-end gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            lockAware={false}
            disabled={saving}
          >
            Hủy
          </Button>
          <Button type="submit" loading={saving} disabled={saving}>
            Lưu hồ sơ
          </Button>
        </div>
      </form>
    </FormModal>
  );
}
