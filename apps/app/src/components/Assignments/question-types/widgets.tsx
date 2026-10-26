"use client";

import { useMemo, useState } from "react";
import { getObjId, idsEqual } from "@/lib/id-utils";
import RichTextDisplay from "@/components/Common/RichTextDisplay";
import QuizMediaDisplay from "@/components/Common/QuizMediaDisplay";
import type { QuizQuestionOption } from "@/lib/api-config";

/** Reusable option list for radio-style questions (single choice, TFNG). */
export function ChoiceList({
  options,
  selectedId,
  onSelect,
  disabled,
  namePrefix,
  columns = 1,
}: {
  options: QuizQuestionOption[];
  selectedId: string | null;
  onSelect: (optionId: string) => void;
  disabled?: boolean;
  namePrefix: string;
  columns?: number;
}) {
  return (
    <div className={`mt-4 grid gap-3 ${columns === 2 ? "sm:grid-cols-2" : ""}`}>
      {options.map((option) => {
        const optionId = getObjId(option) || "";
        const isSelected = optionId !== "" && idsEqual(selectedId, optionId);
        return (
          <label
            key={optionId || option.label}
            className={`flex items-start gap-3 rounded-2xl border p-3 transition-colors ${
              isSelected
                ? "border-primary bg-primary/5"
                : "border-gray-200 dark:border-gray-700"
            } ${disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer"}`}
          >
            <input
              type="radio"
              name={`${namePrefix}-${optionId}`}
              checked={isSelected}
              disabled={disabled}
              onChange={() => onSelect(optionId)}
              className="mt-1 h-4 w-4 border-gray-300 text-primary focus:ring-primary dark:border-gray-600"
            />
            <div className="min-w-0">
              {option.label ? (
                <span className="block text-sm font-semibold text-gray-900 dark:text-white">
                  {option.label}
                </span>
              ) : null}
              {option.content ? (
                <RichTextDisplay
                  content={option.content}
                  className="text-sm text-gray-600 dark:text-gray-300"
                />
              ) : null}
              <QuizMediaDisplay media={option.media} variant="option" />
            </div>
          </label>
        );
      })}
    </div>
  );
}

/** Reusable multi-select checkbox list. */
export function MultiChoiceList({
  options,
  selectedIds,
  onToggle,
  disabled,
  namePrefix,
}: {
  options: QuizQuestionOption[];
  selectedIds: string[];
  onToggle: (optionId: string) => void;
  disabled?: boolean;
  namePrefix: string;
}) {
  return (
    <div className="mt-4 grid gap-3">
      {options.map((option) => {
        const optionId = getObjId(option) || "";
        const isSelected = selectedIds.some((sid) => idsEqual(optionId, sid));
        return (
          <label
            key={optionId || option.label}
            className={`flex items-start gap-3 rounded-2xl border p-3 transition-colors ${
              isSelected
                ? "border-primary bg-primary/5"
                : "border-gray-200 dark:border-gray-700"
            } ${disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer"}`}
          >
            <input
              type="checkbox"
              name={`${namePrefix}-${optionId}`}
              checked={isSelected}
              disabled={disabled}
              onChange={() => onToggle(optionId)}
              className="mt-1 h-4 w-4 border-gray-300 text-primary focus:ring-primary dark:border-gray-600"
            />
            <div className="min-w-0">
              {option.label ? (
                <span className="block text-sm font-semibold text-gray-900 dark:text-white">
                  {option.label}
                </span>
              ) : null}
              {option.content ? (
                <RichTextDisplay
                  content={option.content}
                  className="text-sm text-gray-600 dark:text-gray-300"
                />
              ) : null}
              <QuizMediaDisplay media={option.media} variant="option" />
            </div>
          </label>
        );
      })}
    </div>
  );
}

/** Small textarea used by short-answer style questions. */
export function ShortAnswerInput({
  value,
  onChange,
  disabled,
  placeholder = "Nhập câu trả lời...",
  rows = 3,
}: {
  value: string;
  onChange: (next: string) => void;
  disabled?: boolean;
  placeholder?: string;
  rows?: number;
}) {
  return (
    <textarea
      rows={rows}
      disabled={disabled}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="mt-4 w-full rounded-2xl border border-gray-200 bg-white p-3 text-sm text-gray-900 focus:border-primary focus:outline-none dark:border-gray-700 dark:bg-gray-900 dark:text-white disabled:opacity-60"
    />
  );
}

/**
 * Two-panel matching UI: left = items, right = choice pool with select dropdowns.
 * The pool is rendered once as a reference; each item picks via a dropdown so the
 * student can reuse the same choice for several items (backend normalizes anyway).
 */
export function MatchingBoard({
  items,
  pool,
  picks,
  onPick,
  disabled,
}: {
  items: Array<{ _id?: string; label?: string | null; media?: unknown }>;
  pool: string[];
  picks: Record<string, string>;
  onPick: (itemId: string, choice: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="mt-4 space-y-3">
      {items.map((item, index) => {
        const itemId = item._id || `item-${index}`;
        const value = picks[itemId] ?? "";
        return (
          <div
            key={itemId}
            className="flex flex-col gap-2 rounded-2xl border border-gray-200 p-3 dark:border-gray-700 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="min-w-0 flex-1">
              {item.label ? (
                <RichTextDisplay
                  content={item.label}
                  className="text-sm text-gray-900 dark:text-white"
                />
              ) : (
                <span className="text-sm text-gray-400 dark:text-gray-500">Mục {index + 1}</span>
              )}
            </div>
            <select
              value={value}
              disabled={disabled}
              onChange={(e) => onPick(itemId, e.target.value)}
              className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 focus:border-primary focus:outline-none dark:border-gray-700 dark:bg-gray-900 dark:text-white disabled:opacity-60 sm:w-64"
            >
              <option value="">— Chọn —</option>
              {pool.map((choice) => (
                <option key={choice} value={choice}>
                  {choice}
                </option>
              ))}
            </select>
          </div>
        );
      })}
    </div>
  );
}

/**
 * Ordering UI: click ↑/↓ to move an item. Deterministic and simple — works on
 * touch screens where drag-and-drop is unreliable.
 */
export function OrderingBoard({
  items,
  order,
  onOrderChange,
  disabled,
}: {
  items: Array<{ _id?: string; content?: string | null; media?: unknown }>;
  order: string[];
  onOrderChange: (nextOrder: string[]) => void;
  disabled?: boolean;
}) {
  const ordered = useMemo(() => {
    if (order.length === items.length) {
      const byId = new Map(items.map((item, index) => [item._id || `item-${index}`, item]));
      const arranged = order.map((id) => byId.get(id)).filter(Boolean) as typeof items;
      if (arranged.length === items.length) return arranged;
    }
    return items;
  }, [items, order]);

  const move = (from: number, to: number) => {
    if (disabled || to < 0 || to >= ordered.length) return;
    const next = [...ordered];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    onOrderChange(next.map((item, index) => item._id || `item-${index}`));
  };

  return (
    <div className="mt-4 space-y-2">
      {ordered.map((item, index) => {
        const itemId = item._id || `item-${index}`;
        return (
          <div
            key={itemId}
            className="flex items-center justify-between gap-3 rounded-2xl border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-900"
          >
            <div className="flex min-w-0 items-center gap-3">
              <span className="flex h-7 w-7 flex-none items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                {index + 1}
              </span>
              {item.content ? (
                <RichTextDisplay
                  content={item.content}
                  className="min-w-0 text-sm text-gray-900 dark:text-white"
                />
              ) : null}
            </div>
            <div className="flex flex-none gap-1">
              <button
                type="button"
                disabled={disabled || index === 0}
                onClick={() => move(index, index - 1)}
                aria-label="Di chuyển lên"
                className="rounded-lg border border-gray-200 px-2 py-1 text-xs text-gray-600 hover:bg-gray-50 disabled:opacity-40 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
              >
                ↑
              </button>
              <button
                type="button"
                disabled={disabled || index === ordered.length - 1}
                onClick={() => move(index, index + 1)}
                aria-label="Di chuyển xuống"
                className="rounded-lg border border-gray-200 px-2 py-1 text-xs text-gray-600 hover:bg-gray-50 disabled:opacity-40 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
              >
                ↓
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** Gap-fill text: replaces {{1}}-style placeholders with inline inputs. */
export function GapFillText({
  text,
  gaps,
  fills,
  onFill,
  disabled,
}: {
  text: string;
  gaps: number[];
  fills: Record<string, string>;
  onFill: (gap: number, value: string) => void;
  disabled?: boolean;
}) {
  const parts = useMemo(() => {
    const segments: Array<{ type: "text" | "gap"; value: string | number }> = [];
    const regex = /\{\{(\d+)\}\}/g;
    let lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = regex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        segments.push({ type: "text", value: text.slice(lastIndex, match.index) });
      }
      segments.push({ type: "gap", value: Number(match[1]) });
      lastIndex = regex.lastIndex;
    }
    if (lastIndex < text.length) {
      segments.push({ type: "text", value: text.slice(lastIndex) });
    }
    return segments;
  }, [text]);

  const [focusGap, setFocusGap] = useState<number | null>(null);

  return (
    <div className="mt-4 whitespace-pre-wrap rounded-2xl border border-gray-200 bg-white p-4 text-sm leading-8 text-gray-900 dark:border-gray-700 dark:bg-gray-900 dark:text-white">
      {parts.map((part, index) =>
        part.type === "text" ? (
          <span key={index}>{part.value as string}</span>
        ) : (
          <input
            key={index}
            value={fills[String(part.value)] ?? ""}
            disabled={disabled}
            onChange={(e) => onFill(part.value as number, e.target.value)}
            onFocus={() => setFocusGap(part.value as number)}
            onBlur={() => setFocusGap(null)}
            aria-label={`Điền vào chỗ trống ${part.value}`}
            placeholder={`(${part.value})`}
            className={`mx-1 inline-block w-28 rounded-lg border-b-2 bg-transparent px-2 py-0.5 text-center text-sm focus:outline-none ${
              focusGap === part.value
                ? "border-primary"
                : "border-gray-300 dark:border-gray-600"
            } disabled:opacity-60`}
          />
        )
      )}
      {gaps.length === 0 ? null : null}
    </div>
  );
}
