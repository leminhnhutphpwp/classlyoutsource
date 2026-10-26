"use client";
import { useState } from "react";

export type SubmissionType = 'text' | 'file' | 'document' | 'image' | 'video' | 'audio' | 'link' | 'quiz';

interface SubmissionTypesSelectorProps {
  value: SubmissionType[];
  onChange: (types: SubmissionType[]) => void;
  label?: string;
  required?: boolean;
  error?: string;
}

const SUBMISSION_TYPE_LABELS: Record<SubmissionType, string> = {
  text: 'Văn bản',
  file: 'File',
  document: 'Tài liệu',
  image: 'Hình ảnh',
  video: 'Video',
  audio: 'Ghi âm',
  link: 'Liên kết',
  quiz: 'Trắc nghiệm',
};

const SUBMISSION_TYPE_DESCRIPTIONS: Record<SubmissionType, string> = {
  text: 'Cho phép nộp bài bằng văn bản',
  file: 'Cho phép nộp file bất kỳ',
  document: 'Cho phép nộp tài liệu (PDF, Word, Excel, ...)',
  image: 'Cho phép nộp hình ảnh (JPG, PNG, ...)',
  video: 'Cho phép nộp video (MP4, AVI, ...)',
  audio: 'Cho phép nộp ghi âm (MP3, WAV, ...)',
  link: 'Cho phép nộp liên kết (URL)',
  quiz: 'Dạng bài trắc nghiệm (hệ thống tự chấm)',
};

const ALL_SUBMISSION_TYPES: SubmissionType[] = ['text', 'file', 'document', 'image', 'video', 'audio', 'link'];

export default function SubmissionTypesSelector({
  value = [],
  onChange,
  label = 'Định dạng bài nộp được phép',
  required = false,
  error,
}: SubmissionTypesSelectorProps) {
  const [selectedTypes, setSelectedTypes] = useState<SubmissionType[]>(value);

  const handleToggle = (type: SubmissionType) => {
    const newTypes = selectedTypes.includes(type)
      ? selectedTypes.filter(t => t !== type)
      : [...selectedTypes, type];
    
    // Nếu không có loại nào được chọn, mặc định là text
    const finalTypes: SubmissionType[] = newTypes.length === 0 ? (['text'] as SubmissionType[]) : newTypes;
    
    setSelectedTypes(finalTypes);
    onChange(finalTypes);
  };

  return (
    <div className="space-y-3">
      <label className="block text-sm font-medium text-gray-900 dark:text-white">
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </label>
      
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {ALL_SUBMISSION_TYPES.map((type) => (
          <label
            key={type}
            className="relative flex items-start p-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
          >
            <div className="flex items-center h-5">
              <input
                type="checkbox"
                checked={selectedTypes.includes(type)}
                onChange={() => handleToggle(type)}
                className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary dark:border-gray-600 dark:bg-gray-700"
              />
            </div>
            <div className="ml-3 flex-1">
              <div className="text-sm font-medium text-gray-900 dark:text-white">
                {SUBMISSION_TYPE_LABELS[type]}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                {SUBMISSION_TYPE_DESCRIPTIONS[type]}
              </div>
            </div>
          </label>
        ))}
      </div>
      
      {error && (
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
      )}
      
      <p className="text-xs text-gray-500 dark:text-gray-400">
        {selectedTypes.length === 0 
          ? 'Mặc định: Chỉ cho phép nộp văn bản'
          : `Đã chọn ${selectedTypes.length} định dạng: ${selectedTypes.map(t => SUBMISSION_TYPE_LABELS[t]).join(', ')}`
        }
      </p>
    </div>
  );
}

