"use client";

import { ReactNode, ComponentType, isValidElement } from "react";
import { cn } from "@/lib/utils";

interface Tab {
  id: string;
  label: string;
  name?: string; // Alias for label (for backward compatibility)
  icon?: ReactNode | ComponentType<{ className?: string }>;
  count?: number;
}

interface TabsProps {
  tabs: Tab[];
  activeTab: string;
  onChange: (tabId: string) => void;
  className?: string;
}

export function Tabs({ tabs, activeTab, onChange, className }: TabsProps) {
  return (
    <div className={cn("border-b border-gray-200 dark:border-gray-700", className)}>
      <nav className="-mb-px flex gap-4 sm:gap-8 tabs-scrollbar -mx-4 px-4 sm:mx-0 sm:px-0 overflow-x-auto" aria-label="Tabs">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          const label = tab.label || tab.name || "";
          
          // Handle icon: can be ComponentType (function) or ReactNode (JSX element)
          let iconElement: ReactNode = null;
          if (tab.icon) {
            if (typeof tab.icon === 'function') {
              // It's a component, render it
              const IconComponent = tab.icon as ComponentType<{ className?: string }>;
              iconElement = <IconComponent className="h-4 w-4 sm:h-5 sm:w-5" />;
            } else if (isValidElement(tab.icon)) {
              // It's already a valid React element
              iconElement = tab.icon;
            }
          }
          
          return (
            <button
              key={tab.id}
              onClick={() => onChange(tab.id)}
              className={cn(
                "flex items-center gap-1.5 sm:gap-2 py-2 px-3 sm:px-1 border-b-2 font-medium text-xs sm:text-sm whitespace-nowrap flex-shrink-0 transition-colors",
                isActive
                  ? "border-primary text-primary"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300"
              )}
              aria-current={isActive ? "page" : undefined}
            >
              {iconElement && (
                <span className="h-4 w-4 sm:h-5 sm:w-5 flex-shrink-0">
                  {iconElement}
                </span>
              )}
              <span>{label}</span>
              {tab.count !== undefined && tab.count > 0 && (
                <span
                  className={cn(
                    "ml-1.5 rounded-full px-2 py-0.5 text-xs font-medium",
                    isActive
                      ? "bg-primary/10 text-primary"
                      : "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400"
                  )}
                >
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </nav>
    </div>
  );
}

interface TabPanelProps {
  children: ReactNode;
  activeTab: string;
  tabId: string;
  className?: string;
}

export function TabPanel({ children, activeTab, tabId, className }: TabPanelProps) {
  if (activeTab !== tabId) {
    return null;
  }

  return (
    <div className={cn("mt-6 overflow-visible", className)} role="tabpanel">
      {children}
    </div>
  );
}

