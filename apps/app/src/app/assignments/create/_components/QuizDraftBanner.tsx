"use client";

type Props = {
  visible: boolean;
  lastSavedLabel?: string | null;
  onRestore: () => void;
  onDiscard: () => void;
};

export default function QuizDraftBanner({
  visible,
  lastSavedLabel,
  onRestore,
  onDiscard,
}: Props) {
  if (!visible) {
    return null;
  }

  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-800 dark:border-amber-500/30 dark:bg-amber-900/20 dark:text-amber-100">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="font-semibold">Đã tìm thấy bản nháp đang dở của bạn.</p>
          <p className="text-sm mt-1 text-amber-700 dark:text-amber-200">
            {lastSavedLabel
              ? `Tự động lưu lần cuối lúc ${lastSavedLabel}.`
              : "Bạn có thể khôi phục để tiếp tục chỉnh sửa."}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onRestore}
            className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white shadow hover:bg-amber-500 focus:outline-none focus-visible:ring focus-visible:ring-amber-500/70"
          >
            Khôi phục
          </button>
          <button
            type="button"
            onClick={onDiscard}
            className="rounded-lg border border-amber-200 px-4 py-2 text-sm font-medium text-amber-700 hover:bg-amber-100 dark:border-amber-500/40 dark:text-amber-200 dark:hover:bg-amber-500/10 focus:outline-none focus-visible:ring focus-visible:ring-amber-500/50"
          >
            Bỏ qua
          </button>
        </div>
      </div>
    </div>
  );
}

