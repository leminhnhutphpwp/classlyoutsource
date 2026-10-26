"use client";

import type { WizardStep } from "../types";

type Props = {
  mode: "standard" | "quiz";
  steps: WizardStep[];
  activeStep: number;
};

const STATE_STYLES = {
  active: "border-primary bg-primary/5 text-primary",
  completed:
    "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-900/20 dark:text-emerald-100",
  idle: "border-gray-200 bg-white text-gray-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300",
};

export default function QuizWizardSteps({ mode, steps, activeStep }: Props) {
  if (mode !== "quiz" || steps.length <= 1) {
    return null;
  }

  return (
    <div className="rounded-2xl border border-gray-200 bg-white/90 p-3 dark:border-gray-700 dark:bg-gray-800/80">
      <div className="flex flex-wrap gap-3">
        {steps.map((step, index) => {
          const isActive = index === activeStep;
          const isCompleted = index < activeStep;
          const stateClass = isActive
            ? STATE_STYLES.active
            : isCompleted
              ? STATE_STYLES.completed
              : STATE_STYLES.idle;

          return (
            <div
              key={step.id}
              className={`flex min-w-[180px] flex-1 items-center gap-3 rounded-xl border px-3 py-2 text-xs transition-all ${stateClass}`}
            >
              <span
                className={`flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-semibold ${isActive
                    ? "bg-primary text-white"
                    : isCompleted
                      ? "bg-emerald-500 text-white"
                      : "bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-300"
                  }`}
              >
                {index + 1}
              </span>
              <div className="min-w-0">
                <p className="truncate text-[12px] font-semibold text-gray-900 dark:text-white">
                  {step.title}
                </p>
                <p className="truncate text-[11px] text-gray-500 dark:text-gray-400">
                  {step.description}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

