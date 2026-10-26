"use client";

import { useState } from "react";
import { ArrowLeftIcon, BanknotesIcon } from "@heroicons/react/24/outline";
import ButtonLink from "@/components/Common/ButtonLink";
import DateRangePicker from "@/components/FormElements/DateRangePicker";
import { Tabs, TabPanel } from "@/components/Common/Tabs";
import { useOrganizationContext } from "@/contexts/organization-context";
import { OrgFeatureGuard } from "../_components/org-guard";
import {
  PnlSection,
  CashflowSection,
  TutorProfitabilitySection,
  PayablesSection,
  ReceivablesSection,
} from "../_components/finance-sections";
import { currentMonthRange } from "../_components/finance-format";

const TABS = [
  { id: "pnl", label: "Lãi/lỗ" },
  { id: "cashflow", label: "Dòng tiền" },
  { id: "tutors", label: "Lợi nhuận GV" },
  { id: "payables", label: "Phải trả" },
  { id: "receivables", label: "Phải thu" },
];

export default function OrganizationFinancePage() {
  const { canViewFinance } = useOrganizationContext();
  const [range, setRange] = useState(() => currentMonthRange());
  const [tab, setTab] = useState("pnl");

  return (
    <OrgFeatureGuard allowed={canViewFinance}>
      <div className="space-y-4 sm:space-y-6">
        {/* Header */}
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
              <BanknotesIcon className="h-6 w-6 text-primary" />
              Tài chính
            </h1>
            <p className="mt-1 text-dark-4 dark:text-dark-6">
              Lãi/lỗ, dòng tiền, lợi nhuận theo giáo viên và công nợ của trung tâm
            </p>
          </div>
          <ButtonLink
            href="/organization/finance/expenses"
            variant="outline"
            className="w-full justify-center sm:w-auto"
            lockAware={false}
          >
            Chi phí
          </ButtonLink>
        </div>

        {/* Bộ lọc khoảng thời gian */}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <span className="text-sm font-medium text-dark-4 dark:text-dark-6">
            Khoảng thời gian
          </span>
          <div className="w-full sm:w-80">
            <DateRangePicker
              value={range}
              onChange={(r) => r && setRange(r)}
              placeholder="Chọn khoảng thời gian"
            />
          </div>
        </div>

        <Tabs tabs={TABS} activeTab={tab} onChange={setTab} />

        <TabPanel activeTab={tab} tabId="pnl">
          <PnlSection dateFrom={range.start} dateTo={range.end} />
        </TabPanel>
        <TabPanel activeTab={tab} tabId="cashflow">
          <CashflowSection dateFrom={range.start} dateTo={range.end} />
        </TabPanel>
        <TabPanel activeTab={tab} tabId="tutors">
          <TutorProfitabilitySection dateFrom={range.start} dateTo={range.end} />
        </TabPanel>
        <TabPanel activeTab={tab} tabId="payables">
          <PayablesSection dateFrom={range.start} dateTo={range.end} />
        </TabPanel>
        <TabPanel activeTab={tab} tabId="receivables">
          <ReceivablesSection dateFrom={range.start} dateTo={range.end} />
        </TabPanel>
      </div>
    </OrgFeatureGuard>
  );
}
