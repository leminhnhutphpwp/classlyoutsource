"use client";

import { ReactNode } from "react";
import { StarIcon, EyeIcon, PencilIcon, TrashIcon } from "@heroicons/react/24/outline";
import RichTextDisplay from "@/components/Common/RichTextDisplay";
import ButtonLink from "@/components/Common/ButtonLink";
import { getObjId } from "@/lib/id-utils";
import Button from "@/components/Common/Button";
import Tooltip from "@/components/Common/Tooltip";

interface LessonNoteData {
  id: string | number;
  title: string;
  class?: {
    name: string;
  };
  rating?: number;
  rating_stars?: string;
  lesson_date?: string;
  tutor?: {
    name: string;
  };
  content?: string;
  homework?: string;
  objectives?: string;
}

interface LessonNoteCardProps {
  note: LessonNoteData;
  canManage?: boolean;
  actions?: ReactNode;
  className?: string;
  onDelete?: () => void;
}

export function LessonNoteCard({
  note,
  canManage = false,
  actions,
  className = "",
  onDelete,
}: LessonNoteCardProps) {
  return (
    <div
      className={`flex flex-col rounded-lg bg-white p-6 transition-shadow dark:bg-gray-800 ${className}`}
    >
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
            {note.title}
          </h3>
          <p className="text-base text-gray-500 dark:text-gray-400">
            {note.class?.name || "Chưa phân lớp"}
          </p>
        </div>
        {note.rating && (
          <div className="flex items-center">
            <StarIcon className="h-5 w-5 text-primary-light" />
            <span className="ml-1 text-sm font-medium text-gray-900 dark:text-white">
              {note.rating_stars || note.rating}
            </span>
          </div>
        )}
      </div>

      <div className="space-y-2 mb-4">
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-500 dark:text-gray-400">Ngày học:</span>
          <span className="font-medium text-gray-900 dark:text-white">
            {note.lesson_date
              ? new Date(note.lesson_date).toLocaleDateString("vi-VN")
              : "N/A"}
          </span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-500 dark:text-gray-400">Giáo viên:</span>
          <span className="font-medium text-gray-900 dark:text-white">
            {note.tutor?.name || "Chưa phân công"}
          </span>
        </div>
      </div>

      {note.content && (
        <div className="text-sm text-gray-600 dark:text-gray-300 mb-4 line-clamp-3">
          <RichTextDisplay content={note.content} />
        </div>
      )}

      {note.homework && (
        <div className="mb-4 p-3 rounded-lg bg-primary-pastel/40">
          <p className="text-xs font-medium text-primary mb-1">Bài tập về nhà:</p>
          <div className="text-xs text-primary line-clamp-2">
            <RichTextDisplay content={note.homework} />
          </div>
        </div>
      )}

      {note.objectives && (
        <div className="mb-4">
          <p className="text-xs font-medium text-gray-700 dark:text-gray-400 mb-1">
            Mục tiêu:
          </p>
          <div className="text-xs text-gray-600 dark:text-gray-400 line-clamp-2">
            <RichTextDisplay content={note.objectives} />
          </div>
        </div>
      )}

      {actions ? (
        <div className="mt-auto flex items-center gap-2 pt-4 border-t border-gray-200 dark:border-gray-700">
          {actions}
        </div>
      ) : (
        <div className="mt-auto flex items-center gap-2 pt-4 border-t border-gray-200 dark:border-gray-700">
          <ButtonLink
            href={`/lesson-notes/${getObjId(note)}`}
            variant="outline"
            size="sm"
            icon={<EyeIcon />}
            className="flex-1"
          >
            Xem ghi chú
          </ButtonLink>
          <Tooltip label="Chỉnh sửa ghi chú">
            <ButtonLink
              href={`/lesson-notes/${getObjId(note)}/edit`}
              variant="outline"
              size="sm"
              icon={<PencilIcon />}
              className="flex-shrink-0"
              aria-label="Chỉnh sửa ghi chú"
              disabled={!canManage}
            >
              <span className="sr-only">Chỉnh sửa</span>
            </ButtonLink>
          </Tooltip>
          <Tooltip label="Xóa ghi chú">
            <Button
              onClick={onDelete}
              variant="danger"
              size="sm"
              icon={<TrashIcon />}
              className="flex-shrink-0"
              aria-label="Xóa ghi chú"
              disabled={!canManage || !onDelete}
            >
              <span className="sr-only">Xóa</span>
            </Button>
          </Tooltip>
        </div>
      )}
    </div>
  );
}

