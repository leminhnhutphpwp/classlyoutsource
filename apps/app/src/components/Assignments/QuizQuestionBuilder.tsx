"use client";
import { QuizQuestion, QuizQuestionOption } from "@/lib/api-config";
import { getObjId } from "@/lib/id-utils";
import {
  TrashIcon,
  PlusIcon,
  CheckCircleIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  DocumentDuplicateIcon,
  ArrowUpIcon,
  ArrowDownIcon,
  Bars3Icon,
  DocumentTextIcon,
  SparklesIcon
} from "@heroicons/react/24/outline";
import { useMemo, useState } from "react";
import Button from "@/components/Common/Button";
import InputGroup from "@/components/FormElements/InputGroup";
import RichTextEditor from "@/components/FormElements/RichTextEditorDynamic";
import Tooltip from "@/components/Common/Tooltip";
import RichTextDisplay from "@/components/Common/RichTextDisplay";
import QuestionMediaUpload from "./QuestionMediaUpload";
import ImportQuestionsDialog from "./ImportQuestions/ImportQuestionsDialog";
import AiGenerateQuestionsDialog from "./AiQuestions/AiGenerateQuestionsDialog";
import ConfirmDeleteDialog from "@/components/Common/ConfirmDeleteDialog";
import { useAiAccess } from "@/hooks/use-api";
import QuestionTypeEditor from "./question-types/QuestionTypeEditor";

type QuizQuestionBuilderProps = {
  questions: QuizQuestion[];
  onChange: (value: QuizQuestion[]) => void;
  disabled?: boolean;
  error?: string;
  // When present (an existing assignment), enables the Pro "Tạo câu hỏi bằng AI" action.
  assignmentId?: string;
};

const createOption = (index: number): QuizQuestionOption => ({
  label: String.fromCharCode(65 + index),
  content: "",
  is_correct: index === 0,
});

const createQuestion = (): QuizQuestion => ({
  id: (Date.now() + Math.random()).toString(), // Ensure unique ID
  title: "",
  points: 1,
  question_type: "single_choice",
  options: [createOption(0), createOption(1), createOption(2), createOption(3)],
});

export default function QuizQuestionBuilder({
  questions,
  onChange,
  disabled = false,
  error,
  assignmentId,
}: QuizQuestionBuilderProps) {
  const { canUseAi } = useAiAccess();
  const [expandedQuestions, setExpandedQuestions] = useState<Set<number>>(new Set());
  const [bulkCreateCount, setBulkCreateCount] = useState<string>("");
  const [showBulkCreate, setShowBulkCreate] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [showAiDialog, setShowAiDialog] = useState(false);
  const [questionIndexToDelete, setQuestionIndexToDelete] = useState<number | null>(null);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const totalPoints = useMemo(
    () => (questions || []).reduce((sum, q) => sum + (Number(q.points) || 0), 0),
    [questions]
  );

  const toggleQuestion = (index: number) => {
    const newExpanded = new Set(expandedQuestions);
    if (newExpanded.has(index)) {
      newExpanded.delete(index);
    } else {
      newExpanded.add(index);
    }
    setExpandedQuestions(newExpanded);
  };

  const expandAll = () => {
    setExpandedQuestions(new Set(questions.map((_, i) => i)));
  };

  const collapseAll = () => {
    setExpandedQuestions(new Set());
  };

  const handleQuestionChange = (index: number, patch: Partial<QuizQuestion>) => {
    const next = [...questions];
    next[index] = { ...next[index], ...patch };
    onChange(next);
  };

  const handleQuestionTypeChange = (index: number, type: QuizQuestion["question_type"]) => {
    const next = [...questions];
    const question = next[index];
    let options = question.options || [];
    let settings = question.settings;

    // Switching to single-choice must leave at most one correct answer — keep the first correct one.
    if (type === "single_choice") {
      let seenCorrect = false;
      options = options.map((option) => {
        const keep = Boolean(option.is_correct) && !seenCorrect;
        if (keep) {
          seenCorrect = true;
        }
        return { ...option, is_correct: keep };
      });
    }

    // Short answer stores each accepted answer as an option with is_correct=true.
    // Keep any non-empty existing answers; otherwise seed one blank accepted answer.
    if (type === "short_answer") {
      const kept = options.filter((option) => option.content?.trim());
      const base = kept.length > 0 ? kept : [{ label: "A", content: "", is_correct: true }];
      options = normalizeOptionLabels(base.map((option) => ({ ...option, is_correct: true })));
    }

    // Matching: options carry (label = item text, content = correct match). Seed 3 empty pairs.
    if (type === "matching") {
      const kept = options.filter((option) => option.content?.trim() && option.label?.trim());
      options = kept.length > 0
        ? kept.map((option) => ({ ...option, is_correct: true }))
        : [
            { label: "", content: "", is_correct: true },
            { label: "", content: "", is_correct: true },
            { label: "", content: "", is_correct: true },
          ];
    }

    // Ordering: options in the correct sequence (content = item text). Seed 3 empty steps.
    if (type === "ordering") {
      const kept = options.filter((option) => option.content?.trim());
      options = kept.length > 0
        ? kept.map((option) => ({ ...option, is_correct: true }))
        : [
            { label: "A", content: "", is_correct: true },
            { label: "B", content: "", is_correct: true },
            { label: "C", content: "", is_correct: true },
          ];
      settings = { ...(settings || {}), partial_ordering: settings?.partial_ordering ?? true };
    }

    // Gap fill + TFNG manage their own options (parsed from the text / fixed constants).
    if (type === "gap_fill") {
      options = [];
    }
    if (type === "true_false_not_given") {
      options = [];
    }

    next[index] = { ...question, question_type: type, options, settings };
    onChange(next);
  };

  const handleOptionChange = (
    questionIndex: number,
    optionIndex: number,
    patch: Partial<QuizQuestionOption>
  ) => {
    const next = [...questions];
    const question = next[questionIndex];
    const options = [...(question.options || [])];
    const updatedOption = { ...options[optionIndex], ...patch };

    if (patch.is_correct && question.question_type === "single_choice") {
      // Reset other options to false
      for (let i = 0; i < options.length; i++) {
        options[i] = {
          ...options[i],
          is_correct: i === optionIndex,
        };
      }
    } else {
      options[optionIndex] = updatedOption;
    }

    next[questionIndex] = {
      ...question,
      options: normalizeOptionLabels(options),
    };
    onChange(next);
  };

  const normalizeOptionLabels = (options: QuizQuestionOption[]) => {
    return options.map((option, idx) => ({
      ...option,
      label: String.fromCharCode(65 + idx),
    }));
  };

  const addQuestion = () => {
    const newQuestion = createQuestion();
    onChange([...(questions || []), newQuestion]);
    // Auto-expand new question
    setExpandedQuestions(prev => new Set([...prev, questions.length]));
  };

  const bulkCreateQuestions = () => {
    const count = parseInt(bulkCreateCount);
    if (isNaN(count) || count < 1 || count > 50) {
      return;
    }
    const newQuestions = Array.from({ length: count }, () => createQuestion());
    const newIndices = newQuestions.map((_, i) => questions.length + i);
    onChange([...(questions || []), ...newQuestions]);
    setExpandedQuestions(prev => new Set([...prev, ...newIndices]));
    setBulkCreateCount("");
    setShowBulkCreate(false);
  };

  const duplicateQuestion = (index: number) => {
    const questionToDuplicate = questions[index];
    const duplicated: QuizQuestion = {
      ...questionToDuplicate,
      id: (Date.now() + Math.random()).toString(),
      title: `${questionToDuplicate.title} (Bản sao)`,
    };
    const next = [...questions];
    next.splice(index + 1, 0, duplicated);
    onChange(next);
    // Auto-expand duplicated question
    setExpandedQuestions(prev => new Set([...prev, index + 1]));
  };

  const moveQuestion = (index: number, direction: 'up' | 'down') => {
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === questions.length - 1) return;

    const next = [...questions];
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    [next[index], next[newIndex]] = [next[newIndex], next[index]];
    onChange(next);

    // Update expanded state
    const newExpanded = new Set(expandedQuestions);
    const wasExpanded = newExpanded.has(index);
    const targetWasExpanded = newExpanded.has(newIndex);
    newExpanded.delete(index);
    newExpanded.delete(newIndex);
    if (wasExpanded) newExpanded.add(newIndex);
    if (targetWasExpanded) newExpanded.add(index);
    setExpandedQuestions(newExpanded);
  };

  const handleDragStart = (index: number) => {
    if (disabled) return;
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (disabled || draggedIndex === null || draggedIndex === index) return;
    setDragOverIndex(index);
  };

  const handleDragLeave = () => {
    setDragOverIndex(null);
  };

  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    if (disabled || draggedIndex === null || draggedIndex === dropIndex) {
      setDraggedIndex(null);
      setDragOverIndex(null);
      return;
    }

    const next = [...questions];
    const draggedItem = next[draggedIndex];
    next.splice(draggedIndex, 1);
    next.splice(dropIndex, 0, draggedItem);
    onChange(next);

    // Update expanded state - map old indices to new indices
    const newExpanded = new Set<number>();
    expandedQuestions.forEach(oldIdx => {
      if (oldIdx === draggedIndex) {
        // The dragged item moves to dropIndex
        newExpanded.add(dropIndex);
      } else if (draggedIndex < dropIndex) {
        // Moving down: items between draggedIndex and dropIndex shift up
        if (oldIdx > draggedIndex && oldIdx <= dropIndex) {
          newExpanded.add(oldIdx - 1);
        } else if (oldIdx < draggedIndex || oldIdx > dropIndex) {
          newExpanded.add(oldIdx);
        }
      } else {
        // Moving up: items between dropIndex and draggedIndex shift down
        if (oldIdx >= dropIndex && oldIdx < draggedIndex) {
          newExpanded.add(oldIdx + 1);
        } else if (oldIdx < dropIndex || oldIdx > draggedIndex) {
          newExpanded.add(oldIdx);
        }
      }
    });
    setExpandedQuestions(newExpanded);

    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const removeQuestion = (index: number) => {
    setQuestionIndexToDelete(index);
  };

  const handleConfirmDelete = () => {
    if (questionIndexToDelete === null) return;

    const index = questionIndexToDelete;
    const next = questions.filter((_, i) => i !== index);
    onChange(next);
    // Update expanded state
    const newExpanded = new Set<number>();
    expandedQuestions.forEach(idx => {
      if (idx < index) {
        newExpanded.add(idx);
      } else if (idx > index) {
        newExpanded.add(idx - 1);
      }
    });
    setExpandedQuestions(newExpanded);
    setQuestionIndexToDelete(null);
  };

  const addOption = (questionIndex: number) => {
    const next = [...questions];
    const question = next[questionIndex];
    const options = normalizeOptionLabels([
      ...(question.options || []),
      createOption(question.options?.length || 0),
    ]);
    next[questionIndex] = { ...question, options };
    onChange(next);
  };

  // Short-answer: each accepted answer is an option with is_correct=true (no "wrong" answers).
  const addAcceptedAnswer = (questionIndex: number) => {
    const next = [...questions];
    const question = next[questionIndex];
    const options = normalizeOptionLabels([
      ...(question.options || []),
      { label: "", content: "", is_correct: true },
    ]);
    next[questionIndex] = { ...question, options };
    onChange(next);
  };

  const removeOption = (questionIndex: number, optionIndex: number) => {
    const next = [...questions];
    const question = next[questionIndex];
    const updatedOptions = normalizeOptionLabels(
      (question.options || []).filter((_, idx) => idx !== optionIndex)
    );

    // Ensure at least one correct answer remains
    if (!updatedOptions.some((option) => option.is_correct)) {
      updatedOptions[0] = { ...updatedOptions[0], is_correct: true };
    }

    next[questionIndex] = { ...question, options: updatedOptions };
    onChange(next);
  };

  const isExpanded = (index: number) => expandedQuestions.has(index);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white">
            Danh sách câu hỏi ({questions.length})
          </h3>
          <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">
            Tổng điểm hiện tại:{" "}
            <span className="font-semibold text-gray-900 dark:text-white">{totalPoints} điểm</span>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {questions.length > 0 && (
            <>
              <Button
                type="button"
                onClick={expandAll}
                disabled={disabled || expandedQuestions.size === questions.length}
                variant="outline"
                size="sm"
              >
                Mở tất cả
              </Button>
              <Button
                type="button"
                onClick={collapseAll}
                disabled={disabled || expandedQuestions.size === 0}
                variant="outline"
                size="sm"
              >
                Thu tất cả
              </Button>
            </>
          )}
          <Button
            type="button"
            onClick={() => setShowBulkCreate(!showBulkCreate)}
            disabled={disabled}
            variant="outline"
            size="sm"
            icon={<PlusIcon />}
          >
            Tạo nhiều
          </Button>
          <Button
            type="button"
            onClick={() => setShowImportDialog(true)}
            disabled={disabled}
            variant="outline"
            size="sm"
            icon={<DocumentTextIcon />}
          >
            Nhập từ file
          </Button>
          {/* AI question generation — Pro only, and only for an existing assignment */}
          {canUseAi && assignmentId && (
            <Button
              type="button"
              onClick={() => setShowAiDialog(true)}
              disabled={disabled}
              variant="outline"
              size="sm"
              icon={<SparklesIcon />}
              className="border-violet-300 text-violet-700 hover:bg-violet-50 dark:border-violet-500/40 dark:text-violet-200 dark:hover:bg-violet-900/20"
            >
              Tạo câu hỏi bằng AI
            </Button>
          )}
          <Button
            type="button"
            onClick={addQuestion}
            disabled={disabled}
            variant="primary"
            size="sm"
            icon={<PlusIcon />}
          >
            Thêm câu hỏi
          </Button>
        </div>
      </div>

      {/* Bulk Create Section */}
      {showBulkCreate && (
        <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 sm:p-4 dark:bg-primary/10">
          <div className="flex flex-col gap-3 sm:gap-4 sm:flex-row">
            <div className="flex-1">
              <InputGroup
                label="Số lượng câu hỏi cần tạo"
                name="bulk_create_count"
                type="number"
                value={bulkCreateCount}
                handleChange={(e) => setBulkCreateCount(e.target.value)}
                placeholder="Nhập số từ 1-50"
                min="1"
                max="50"
                helperText="Tạo nhiều câu hỏi trống cùng lúc để tiết kiệm thời gian"
              />
            </div>
            <div className="flex items-start gap-2 sm:flex-shrink-0 sm:pt-7">
              <Button
                type="button"
                onClick={bulkCreateQuestions}
                disabled={disabled || !bulkCreateCount || parseInt(bulkCreateCount) < 1 || parseInt(bulkCreateCount) > 50}
                variant="primary"
                size="sm"
                className="flex-1 sm:flex-none h-[42px] sm:h-[41px]"
              >
                Tạo
              </Button>
              <Button
                type="button"
                onClick={() => {
                  setShowBulkCreate(false);
                  setBulkCreateCount("");
                }}
                variant="outline"
                size="sm"
                className="flex-1 sm:flex-none h-[42px] sm:h-[41px]"
              >
                Hủy
              </Button>
            </div>
          </div>
        </div>
      )}

      {questions.length === 0 && (
        <div className="rounded-2xl border border-dashed border-gray-300 p-6 text-center dark:border-gray-700">
          <p className="text-gray-600 dark:text-gray-300">
            Chưa có câu hỏi nào. Nhấn &quot;Thêm câu hỏi&quot; hoặc &quot;Tạo nhiều&quot; để bắt đầu.
          </p>
        </div>
      )}

      {error && (
        <div className="mt-4 rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300">
          {error}
        </div>
      )}

      {questions.map((question, index) => {
        const expanded = isExpanded(index);
        const isDragging = draggedIndex === index;
        const isDragOver = dragOverIndex === index;
        return (
          <div
            key={getObjId(question) || index}
            draggable={!disabled}
            onDragStart={() => handleDragStart(index)}
            onDragOver={(e) => handleDragOver(e, index)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, index)}
            onDragEnd={handleDragEnd}
            className={`rounded-2xl border bg-white transition-all dark:bg-gray-800 ${isDragging
              ? 'opacity-50 border-primary'
              : isDragOver
                ? 'border-primary border-2 shadow-md'
                : 'border-gray-200 dark:border-gray-700'
              }`}
          >
            {/* Question Header - Always Visible */}
            <div className="p-3 sm:p-4">
              <div className="flex flex-col gap-3">
                {/* Label and actions row */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <Tooltip label="Kéo để sắp xếp">
                      <div
                        className="flex-shrink-0 h-8 w-8 sm:h-9 sm:w-9 inline-flex items-center justify-center rounded-lg border border-gray-300 hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-700 transition-colors cursor-move"
                        draggable={!disabled}
                        onDragStart={(e) => {
                          e.stopPropagation();
                          handleDragStart(index);
                        }}
                      >
                        <Bars3Icon className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-gray-600 dark:text-gray-400" />
                      </div>
                    </Tooltip>
                    <Tooltip label={expanded ? "Thu gọn" : "Mở rộng"}>
                      <button
                        type="button"
                        onClick={() => toggleQuestion(index)}
                        className="flex-shrink-0 h-8 w-8 sm:h-9 sm:w-9 inline-flex items-center justify-center rounded-lg border border-gray-300 hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-700 transition-colors"
                        disabled={disabled}
                      >
                        {expanded ? (
                          <ChevronUpIcon className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-gray-600 dark:text-gray-400" />
                        ) : (
                          <ChevronDownIcon className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-gray-600 dark:text-gray-400" />
                        )}
                      </button>
                    </Tooltip>
                    <p className="text-xs sm:text-sm font-semibold text-primary whitespace-nowrap">Câu hỏi #{index + 1}</p>
                    {!expanded && (
                      <div className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 flex-1 ml-2 line-clamp-2 min-w-0">
                        {question.title ? <RichTextDisplay content={question.title} /> : "(Chưa có nội dung)"}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
                    {expanded && (
                      <div className="flex items-center gap-1.5">
                        <label className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap hidden sm:inline">Điểm:</label>
                        <input
                          type="number"
                          min={1}
                          value={question.points}
                          onChange={(e) => handleQuestionChange(index, { points: Number(e.target.value) || 0 })}
                          disabled={disabled}
                          className="h-8 w-16 sm:h-9 sm:w-20 rounded-lg border border-gray-300 bg-white px-2 sm:px-3 text-xs sm:text-sm text-gray-900 focus:border-primary focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:focus:border-primary"
                          placeholder="Điểm"
                        />
                      </div>
                    )}
                    <div className="flex items-center gap-0.5 sm:gap-1">
                      <Tooltip label="Di chuyển lên">
                        <button
                          type="button"
                          onClick={() => moveQuestion(index, 'up')}
                          disabled={disabled || index === 0}
                          className="h-8 w-8 sm:h-9 sm:w-9 inline-flex items-center justify-center rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                        >
                          <ArrowUpIcon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                        </button>
                      </Tooltip>
                      <Tooltip label="Di chuyển xuống">
                        <button
                          type="button"
                          onClick={() => moveQuestion(index, 'down')}
                          disabled={disabled || index === questions.length - 1}
                          className="h-8 w-8 sm:h-9 sm:w-9 inline-flex items-center justify-center rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                        >
                          <ArrowDownIcon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                        </button>
                      </Tooltip>
                      <Tooltip label="Sao chép câu hỏi">
                        <button
                          type="button"
                          onClick={() => duplicateQuestion(index)}
                          disabled={disabled}
                          className="h-8 w-8 sm:h-9 sm:w-9 inline-flex items-center justify-center rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700 transition-colors"
                        >
                          <DocumentDuplicateIcon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                        </button>
                      </Tooltip>
                      <Tooltip label="Xóa câu hỏi">
                        <button
                          type="button"
                          onClick={() => removeQuestion(index)}
                          disabled={disabled}
                          className="h-8 w-8 sm:h-9 sm:w-9 inline-flex items-center justify-center rounded-lg border border-red-200 text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-300 dark:hover:bg-red-900/30 transition-colors"
                        >
                          <TrashIcon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                        </button>
                      </Tooltip>
                    </div>
                  </div>
                </div>

                {/* Question content editor - Only when expanded */}
                {expanded && (
                  <div className={disabled ? "opacity-50 pointer-events-none" : ""}>
                    <RichTextEditor
                      value={question.title || ""}
                      onChange={(value) => handleQuestionChange(index, { title: value })}
                      placeholder="Nhập nội dung câu hỏi"
                      label="Nội dung câu hỏi"
                    />
                    <div className="mt-3">
                      <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
                        Loại câu hỏi
                      </label>
                      <select
                        value={question.question_type}
                        disabled={disabled}
                        onChange={(e) => handleQuestionTypeChange(index, e.target.value as QuizQuestion["question_type"])}
                        className="w-full sm:w-64 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-primary focus:outline-none dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                      >
                        <option value="single_choice">Một đáp án đúng</option>
                        <option value="multiple_choice">Nhiều đáp án đúng</option>
                        <option value="short_answer">Trả lời ngắn</option>
                        <option value="true_false_not_given">True / False / Not Given</option>
                        <option value="matching">Nối thông tin (Matching)</option>
                        <option value="ordering">Sắp xếp thứ tự (Ordering)</option>
                        <option value="gap_fill">Điền vào chỗ trống (Gap fill)</option>
                      </select>
                    </div>
                    <div className="mt-3">
                      <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
                        Media cho câu hỏi (tuỳ chọn)
                      </label>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        Đính ảnh (đề/đồ thị) hoặc audio (câu nghe) cho câu hỏi này.
                      </p>
                      <QuestionMediaUpload
                        accept="audio-image"
                        media={question.media}
                        disabled={disabled}
                        onChange={({ media_id, media }) =>
                          handleQuestionChange(index, { media_id, media })
                        }
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Question Content - Collapsible */}
            {expanded && (
              <div className="px-3 sm:px-4 pb-3 sm:pb-4 border-t border-gray-100 dark:border-gray-700 pt-3 sm:pt-4">
                {["true_false_not_given", "matching", "ordering", "gap_fill"].includes(question.question_type) ? (
                  <QuestionTypeEditor
                    question={question}
                    disabled={disabled}
                    onChange={(patch) => handleQuestionChange(index, patch)}
                  />
                ) : question.question_type === "short_answer" ? (
                <div className="space-y-2 sm:space-y-3">
                  <p className="text-xs sm:text-sm font-medium text-gray-900 dark:text-white">Các đáp án được chấp nhận</p>
                  {(question.options || []).map((option, optionIndex) => {
                    const inputId = `question-${index}-answer-${optionIndex}`;
                    return (
                      <div
                        key={inputId}
                        className="flex flex-col gap-2 sm:gap-3 rounded-xl border border-primary/60 bg-primary/5 p-2.5 sm:p-3 sm:flex-row sm:items-center"
                      >
                        <span className="inline-flex items-center gap-1 text-xs sm:text-sm font-semibold text-primary flex-shrink-0">
                          <CheckCircleIcon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                          Đáp án {optionIndex + 1}
                        </span>
                        <input
                          id={inputId}
                          type="text"
                          value={option.content}
                          onChange={(e) =>
                            handleOptionChange(index, optionIndex, {
                              content: e.target.value,
                            })
                          }
                          disabled={disabled}
                          placeholder="Nhập một đáp án đúng được chấp nhận"
                          className="flex-1 rounded-lg border border-gray-300 bg-white px-3 sm:px-4 py-2 text-sm sm:text-base text-gray-900 placeholder-gray-500 focus:border-primary focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:focus:border-primary"
                        />
                        <button
                          type="button"
                          onClick={() => removeOption(index, optionIndex)}
                          disabled={disabled || (question.options?.length || 0) <= 1}
                          className="h-8 sm:h-9 w-full sm:w-auto inline-flex items-center justify-center gap-1 rounded-lg border border-gray-300 px-2 sm:px-3 text-xs sm:text-sm font-medium text-gray-600 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          <TrashIcon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                          <span className="sm:hidden">Xóa đáp án</span>
                          <span className="hidden sm:inline">Xóa</span>
                        </button>
                      </div>
                    );
                  })}

                  <button
                    type="button"
                    onClick={() => addAcceptedAnswer(index)}
                    disabled={disabled || (question.options?.length || 0) >= 10}
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-lg border border-dashed border-primary px-3 py-2 text-xs sm:text-sm font-medium text-primary hover:bg-primary/5 disabled:opacity-40"
                  >
                    <PlusIcon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                    Thêm đáp án
                  </button>

                  <div className="rounded-xl bg-primary/5 p-2.5 sm:p-3 text-xs sm:text-sm text-primary">
                    <p className="font-medium flex items-center gap-1 mb-1">
                      <CheckCircleIcon className="h-3.5 w-3.5 sm:h-4 sm:w-4 flex-shrink-0" />
                      Lưu ý
                    </p>
                    <p>
                      Học sinh được tính đúng nếu câu trả lời khớp một trong các đáp án trên (không phân
                      biệt hoa/thường và khoảng trắng thừa, cho phép sai lệch nhỏ). Thêm nhiều biến thể để
                      chấm chính xác hơn.
                    </p>
                  </div>
                </div>
                ) : (
                <div className="space-y-2 sm:space-y-3">
                  <p className="text-xs sm:text-sm font-medium text-gray-900 dark:text-white">Phương án trả lời</p>
                  {(question.options || []).map((option, optionIndex) => {
                    const isMultiple = question.question_type === "multiple_choice";
                    const inputId = `question-${index}-option-${optionIndex}`;
                    return (
                      <div
                        key={inputId}
                        className={`rounded-xl border p-2.5 sm:p-3 ${option.is_correct
                          ? "border-primary/60 bg-primary/5"
                          : "border-gray-200 dark:border-gray-700"
                          }`}
                      >
                        <div className="flex flex-col gap-2 sm:gap-3 sm:flex-row sm:items-center">
                          <label className="inline-flex items-center gap-2 text-xs sm:text-sm text-gray-700 dark:text-gray-200 flex-shrink-0">
                            <input
                              id={inputId}
                              type={isMultiple ? "checkbox" : "radio"}
                              name={`question-${index}-correct`}
                              checked={Boolean(option.is_correct)}
                              onChange={() =>
                                handleOptionChange(index, optionIndex, {
                                  is_correct: !(option.is_correct ?? false),
                                })
                              }
                              disabled={disabled}
                              className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary dark:border-gray-600 dark:bg-gray-700"
                            />
                            <span className="font-semibold">{option.label}</span>
                          </label>
                          <input
                            type="text"
                            value={option.content}
                            onChange={(e) =>
                              handleOptionChange(index, optionIndex, {
                                content: e.target.value,
                              })
                            }
                            disabled={disabled}
                            placeholder="Nhập nội dung đáp án"
                            className="flex-1 rounded-lg border border-gray-300 bg-white px-3 sm:px-4 py-2 text-sm sm:text-base text-gray-900 placeholder-gray-500 focus:border-primary focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:focus:border-primary"
                          />
                          <button
                            type="button"
                            onClick={() => removeOption(index, optionIndex)}
                            disabled={disabled || (question.options?.length || 0) <= 2}
                            className="h-8 sm:h-9 w-full sm:w-auto inline-flex items-center justify-center gap-1 rounded-lg border border-gray-300 px-2 sm:px-3 text-xs sm:text-sm font-medium text-gray-600 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            <TrashIcon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                            <span className="sm:hidden">Xóa phương án</span>
                            <span className="hidden sm:inline">Xóa</span>
                          </button>
                        </div>
                        <div className="mt-2 sm:pl-1">
                          <QuestionMediaUpload
                            accept="image"
                            compact
                            media={option.media}
                            disabled={disabled}
                            onChange={({ media_id, media }) =>
                              handleOptionChange(index, optionIndex, { media_id, media })
                            }
                          />
                        </div>
                      </div>
                    );
                  })}

                  <button
                    type="button"
                    onClick={() => addOption(index)}
                    disabled={disabled || (question.options?.length || 0) >= 8}
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-lg border border-dashed border-primary px-3 py-2 text-xs sm:text-sm font-medium text-primary hover:bg-primary/5 disabled:opacity-40"
                  >
                    <PlusIcon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                    Thêm phương án
                  </button>

                  <div className="rounded-xl bg-primary/5 p-2.5 sm:p-3 text-xs sm:text-sm text-primary">
                    <p className="font-medium flex items-center gap-1 mb-1">
                      <CheckCircleIcon className="h-3.5 w-3.5 sm:h-4 sm:w-4 flex-shrink-0" />
                      Lưu ý
                    </p>
                    <p>
                      Mỗi câu hỏi phải có ít nhất 2 phương án và tối thiểu 1 đáp án đúng. Hệ thống sẽ tự
                      động chuẩn hoá dữ liệu khi gửi lên backend.
                    </p>
                  </div>
                </div>
                )}
              </div>
            )}
          </div>
        );
      })}

      {/* Import Questions Dialog */}
      <ImportQuestionsDialog
        open={showImportDialog}
        onClose={() => setShowImportDialog(false)}
        onImport={(importedQuestions) => {
          // Add imported questions to existing list
          const newQuestions = [...questions, ...importedQuestions];
          onChange(newQuestions);
          // Auto-expand imported questions
          const newIndices = importedQuestions.map((_, i) => questions.length + i);
          setExpandedQuestions(prev => new Set([...prev, ...newIndices]));
        }}
        disabled={disabled}
      />

      {/* AI Generate Questions Dialog (Pro) */}
      {assignmentId && (
        <AiGenerateQuestionsDialog
          open={showAiDialog}
          onClose={() => setShowAiDialog(false)}
          assignmentId={assignmentId}
          onAdd={(aiQuestions) => {
            const newQuestions = [...questions, ...aiQuestions];
            onChange(newQuestions);
            const newIndices = aiQuestions.map((_, i) => questions.length + i);
            setExpandedQuestions((prev) => new Set([...prev, ...newIndices]));
          }}
          disabled={disabled}
        />
      )}

      {/* Confirm Delete Dialog */}
      <ConfirmDeleteDialog
        open={questionIndexToDelete !== null}
        onClose={() => setQuestionIndexToDelete(null)}
        onConfirm={handleConfirmDelete}
        message={`Bạn có chắc chắn muốn xóa câu hỏi #${questionIndexToDelete !== null ? questionIndexToDelete + 1 : ''}? Hành động này không thể hoàn tác!`}
        label="Xóa câu hỏi"
      />
    </div>
  );
}
