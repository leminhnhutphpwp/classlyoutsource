"use client";

import { useState } from "react";
import { ArrowLeftIcon, CurrencyDollarIcon } from "@heroicons/react/24/outline";
import ButtonLink from "@/components/Common/ButtonLink";
import { Tabs, TabPanel } from "@/components/Common/Tabs";
import { useOrganizationContext } from "@/contexts/organization-context";
import { OrgFeatureGuard } from "../_components/org-guard";
import { PayrollPeriods } from "../_components/payroll-periods";
import { CompensationProfiles } from "../_components/compensation-profiles";

const TABS = [
  { id: "periods", label: "Kỳ lương" },
  { id: "profiles", label: "Hồ sơ lương" },
];

export default function OrganizationPayrollPage() {
  const { canReadPayroll, organization } = useOrganizationContext();
  const [tab, setTab] = useState("periods");
  const orgHash = organization?.id;

  return (
    <OrgFeatureGuard allowed={canReadPayroll}>
      <div className="space-y-4 sm:space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
          <ButtonLink
            href="/organization"
            variant="outline"
            size="sm"
            icon={<ArrowLeftIcon />}
            className="w-full justify-center sm:w-auto"
            lockAware={false}
          >
            Quay lại
          </ButtonLink>
          <div className="min-w-0 flex-1">
            <h1 className="flex items-center gap-2 text-xl font-bold text-dark dark:text-white sm:text-2xl">
              <CurrencyDollarIcon className="h-6 w-6 text-primary" />
              Bảng lương
            </h1>
            <p className="mt-1 text-dark-4 dark:text-dark-6">
              Cấu hình lương giáo viên, tạo và duyệt các kỳ lương
            </p>
          </div>
        </div>

        <Tabs tabs={TABS} activeTab={tab} onChange={setTab} />

        {orgHash && (
          <>
            <TabPanel activeTab={tab} tabId="periods">
              <PayrollPeriods orgHash={orgHash} />
            </TabPanel>
            <TabPanel activeTab={tab} tabId="profiles">
              <CompensationProfiles orgHash={orgHash} />
            </TabPanel>
          </>
        )}
      </div>
    </OrgFeatureGuard>
  );
}
