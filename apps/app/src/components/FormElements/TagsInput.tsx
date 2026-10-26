"use client";
import { useState, KeyboardEvent, ChangeEvent } from "react";
import { XMarkIcon, PlusIcon } from "@heroicons/react/24/outline";

interface TagsInputProps {
  label?: string;
  value: string[];
  onChange: (tags: string[]) => void;
  placeholder?: string;
  maxTags?: number;
  error?: string;
}

export default function TagsInput({
  label,
  value = [],
  onChange,
  placeholder = "Thêm tag...",
  maxTags,
  error,
}: TagsInputProps) {
  const [inputValue, setInputValue] = useState("");
  const [isFocused, setIsFocused] = useState(false);

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    // Add tag on Enter or comma
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addTag();
    }
    // Remove last tag on Backspace if input is empty
    else if (e.key === "Backspace" && inputValue === "" && value.length > 0) {
      removeTag(value.length - 1);
    }
  };

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);

    // Auto-add tag when comma is typed
    if (e.target.value.includes(",")) {
      const tags = e.target.value
        .split(",")
        .map((tag) => tag.trim())
        .filter((tag) => tag.length > 0);

      if (tags.length > 0) {
        const newTags = [...value];
        tags.forEach((tag) => {
          if (!newTags.includes(tag) && (!maxTags || newTags.length < maxTags)) {
            newTags.push(tag);
          }
        });
        onChange(newTags);
        setInputValue("");
      }
    }
  };

  const addTag = () => {
    const trimmedValue = inputValue.trim();
    if (
      trimmedValue &&
      !value.includes(trimmedValue) &&
      (!maxTags || value.length < maxTags)
    ) {
      onChange([...value, trimmedValue]);
      setInputValue("");
    }
  };

  const removeTag = (index: number) => {
    const newTags = value.filter((_, i) => i !== index);
    onChange(newTags);
  };

  const handleFocus = () => {
    setIsFocused(true);
  };

  const handleBlur = () => {
    setIsFocused(false);
    // Add tag when input loses focus (if there's a value)
    if (inputValue.trim()) {
      addTag();
    }
  };

  const isMaxReached = maxTags !== undefined && value.length >= maxTags;

  return (
    <div className="space-y-2">
      {label && (
        <label className="block text-sm font-medium text-gray-900 dark:text-white">
          {label}
        </label>
      )}

      {/* Combined Tags + Input Area */}
      <div className="relative">
        <div className={`flex flex-wrap items-center gap-1.5 min-h-[41px] w-full rounded-lg border bg-white px-4 py-2 transition-all duration-200 dark:bg-gray-700 ${error
          ? "border-red-500 focus:border-red-500 dark:border-red-400 dark:focus:border-red-400"
          : isFocused
            ? "border-primary dark:border-primary"
            : "border-gray-300 dark:border-gray-600"
          }`}>

          {/* Existing Tags */}
          {value.map((tag, index) => (
            <span
              key={index}
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium transition-all duration-200 ${error
                ? "bg-red-100 text-red-700 border border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800"
                : "bg-primary/10 text-primary border border-primary/20 hover:bg-primary/15 hover:border-primary/30 dark:bg-primary/20 dark:border-primary/30 dark:hover:bg-primary/25"
                }`}
            >
              <span className="select-none">{tag}</span>
              <button
                type="button"
                onClick={() => removeTag(index)}
                className={`flex items-center justify-center w-3 h-3 rounded-full transition-all duration-200 hover:scale-110 focus:outline-none ${error
                  ? "text-red-600 hover:bg-red-200 dark:text-red-400 dark:hover:bg-red-800"
                  : "text-primary/70 hover:text-primary hover:bg-primary/20 dark:hover:bg-primary/30"
                  }`}
                title={`Xóa tag "${tag}"`}
              >
                <XMarkIcon className="w-2.5 h-2.5" />
              </button>
            </span>
          ))}

          {/* Input Field - inline with tags */}
          <div className="flex items-center flex-1 min-w-[100px]">
            <input
              type="text"
              value={inputValue}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              onFocus={handleFocus}
              onBlur={handleBlur}
              placeholder={isMaxReached ? `Đã đạt giới hạn ${maxTags} tags` : (value.length === 0 ? placeholder : "Thêm tag...")}
              disabled={isMaxReached}
              className="flex-1 bg-transparent text-sm text-gray-900 dark:text-white placeholder:text-gray-400 border-none outline-none focus:ring-0 disabled:cursor-not-allowed disabled:opacity-50 py-0.5"
              style={{ border: 'none', boxShadow: 'none' }}
            />

            {/* Inline Add Button */}
            {inputValue.trim() && !isMaxReached && (
              <button
                type="button"
                onClick={addTag}
                className="ml-1 flex items-center justify-center w-4 h-4 rounded-full bg-primary text-white hover:bg-primary/90 transition-all duration-200 hover:scale-105 focus:outline-none"
                title="Thêm tag"
              >
                <PlusIcon className="w-2 h-2" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Helper Text and Status */}
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-2">
          <span className="text-gray-500 dark:text-gray-400">
            Nhấn <kbd className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-xs">Enter</kbd> hoặc <kbd className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-xs">,</kbd> để thêm
          </span>
        </div>

        <div className="flex items-center gap-2">
          {maxTags && (
            <span className={`font-medium ${value.length >= maxTags
              ? "text-amber-600 dark:text-amber-400"
              : "text-gray-500 dark:text-gray-400"
              }`}>
              {value.length} / {maxTags}
            </span>
          )}
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <div className="flex-shrink-0 w-4 h-4 text-red-500">
            <svg fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
          </div>
          <span className="text-sm text-red-700 dark:text-red-400">
            {error}
          </span>
        </div>
      )}
    </div>
  );
}

