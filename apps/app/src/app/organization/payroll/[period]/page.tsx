"use client";

import { useParams } from "next/navigation";
import { useOrganizationContext } from "@/contexts/organization-context";
import { OrgFeatureGuard } from "../../_components/org-guard";
import { PayrollPeriodDetail } from "../../_components/payroll-period-detail";

export default function PayrollPeriodPage() {
  const params = useParams<{ period: string }>();
  const periodId = params?.period;
  const { canReadPayroll, organization } = useOrganizationContext();
  const orgHash = organization?.id;

  return (
    <OrgFeatureGuard allowed={canReadPayroll}>
      {orgHash && periodId ? (
        <PayrollPeriodDetail orgHash={orgHash} periodId={periodId} />
      ) : null}
    </OrgFeatureGuard>
  );
}
