"use client";

import { DocumentArrowDownIcon } from "@heroicons/react/24/outline";
import FileUpload from "@/components/FormElements/FileUpload";

type ImportQuestionsFileSelectorProps = {
  onFileSelect: (file: File) => void;
  disabled?: boolean;
  acceptedTypes?: string;
};

export default function ImportQuestionsFileSelector({
  onFileSelect,
  disabled = false,
  acceptedTypes = ".xlsx,.xls,.csv,.docx",
}: ImportQuestionsFileSelectorProps) {


  return (
    <div className="space-y-4">
      <FileUpload
        label="Chọn file dữ liệu"
        onChange={(file) => file && onFileSelect(file)}
        accept={acceptedTypes}
        helperText="Hỗ trợ: Excel (.xlsx, .xls), CSV (.csv), Word (.docx)"
        disabled={disabled}
      />

      <div className="rounded-lg bg-primary/5 border border-primary/20 p-4">
        <div className="flex items-start gap-3">
          <DocumentArrowDownIcon className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-medium text-gray-900 dark:text-white mb-1">
              Chưa biết cấu trúc file?
            </p>
            <p className="text-xs text-gray-600 dark:text-gray-400 mb-2">
              Cột <code className="rounded bg-primary/10 px-1">question_type</code> bật các dạng luyện thi:
              <span className="ml-1">
                single_choice, multiple_choice (đáp án &quot;A,C&quot;), short_answer, true_false_not_given,
                matching (items: <code className="rounded bg-primary/10 px-1">mục|đúng;;mục|đúng</code>),
                ordering (items theo đúng thứ tự),
                gap_fill (nội dung có <code className="rounded bg-primary/10 px-1">{"{{1}}"}</code>, items: <code className="rounded bg-primary/10 px-1">1|đáp án</code>)
              </span>
            </p>
            <div className="flex flex-wrap gap-2">
              <a
                href="/samples/assignments/mau-cau-hoi-trac-nghiem.csv"
                download
                data-nprogress-ignore
                className="text-xs text-primary hover:underline"
              >
                📄 Tải mẫu CSV
              </a>
              <a
                href="/samples/assignments/mau-cau-hoi-trac-nghiem.xlsx"
                download
                data-nprogress-ignore
                className="text-xs text-primary hover:underline"
              >
                📊 Tải mẫu Excel
              </a>
              <a
                href="/samples/assignments/mau-cau-hoi-luyen-thi.csv"
                download
                data-nprogress-ignore
                className="text-xs text-primary hover:underline"
              >
                🎯 Tải mẫu CSV luyện thi (7 dạng)
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

