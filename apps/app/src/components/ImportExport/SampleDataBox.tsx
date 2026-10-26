"use client";

import { DocumentArrowDownIcon } from "@heroicons/react/24/outline";

type ImportType = 'students' | 'enrollments' | 'attendance' | 'grades' | 'payments' | 'assignment-types' | 'subjects' | 'grade-levels' | 'grade-types';

type SampleDataBoxProps = {
  importType: ImportType;
};

const sampleConfigs: Record<
  ImportType,
  {
    file: string;
    title: string;
    description: string;
  }
> = {
  students: {
    file: "/samples/students/mau-hoc-sinh.csv",
    title: "Mẫu file nhập danh sách học viên",
    description: "File CSV mẫu dùng để nhập nhanh danh sách học viên vào hệ thống.",
  },
  enrollments: {
    file: "/samples/enrollments/mau-ghi-danh.csv",
    title: "Mẫu file nhập ghi danh học viên vào lớp",
    description: "File CSV mẫu dùng để ghi danh học viên vào các lớp học.",
  },
  attendance: {
    file: "/samples/attendance/mau-diem-danh.csv",
    title: "Mẫu file nhập điểm danh",
    description: "File CSV mẫu dùng để nhập nhanh dữ liệu điểm danh theo buổi học.",
  },
  grades: {
    file: "/samples/grades/mau-diem-so.csv",
    title: "Mẫu file nhập điểm",
    description: "File CSV mẫu dùng để nhập điểm kiểm tra, bài tập hoặc loại điểm cho học viên.",
  },
  payments: {
    file: "/samples/payments/mau-thanh-toan.csv",
    title: "Mẫu file nhập thanh toán",
    description: "File CSV mẫu dùng để nhập nhanh các khoản thanh toán học phí.",
  },
  "assignment-types": {
    file: "/samples/assignment-types/mau-loai-bai-tap.csv",
    title: "Mẫu file nhập loại bài tập",
    description: "File CSV mẫu dùng để cấu hình và quản lý các loại bài tập.",
  },
  subjects: {
    file: "/samples/subjects/mau-mon-hoc.csv",
    title: "Mẫu file nhập môn học",
    description: "File CSV mẫu dùng để thêm và quản lý danh sách môn học.",
  },
  "grade-levels": {
    file: "/samples/grade-levels/mau-cap-do-khoi.csv",
    title: "Mẫu file nhập cấp độ/khối",
    description: "File CSV mẫu dùng để cấu hình các cấp độ/khối lớp trong hệ thống.",
  },
  "grade-types": {
    file: "/samples/grade-types/mau-loai-diem.csv",
    title: "Mẫu file nhập loại điểm",
    description: "File CSV mẫu dùng để thiết lập các loại điểm (miệng, 15 phút, 1 tiết, học kỳ, ...).",
  },
};

export default function SampleDataBox({ importType }: SampleDataBoxProps) {
  const config = sampleConfigs[importType];

  if (!config) return null;

  return (
    <div className="rounded-lg bg-primary/5 border border-primary/20 p-4">
      <div className="flex items-start gap-3">
        <DocumentArrowDownIcon className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-900 dark:text-white mb-1">
            {config.title}
          </p>
          <p className="text-xs text-gray-600 dark:text-gray-400 mb-2">
            {config.description}
          </p>
          <a
            href={config.file}
            download
            data-nprogress-ignore
            className="text-xs text-primary hover:underline inline-flex items-center gap-1"
          >
            📄 Tải file mẫu CSV
          </a>
        </div>
      </div>
    </div>
  );
}

