"use client";
import { CloudArrowUpIcon, DocumentTextIcon } from "@heroicons/react/24/outline";
import { useEffect, useState } from "react";
import { formatFileSize } from "@/lib/format-number";
import { useUploadLimits } from "@/hooks/use-upload-limits";

interface FileUploadProps {
    label?: string;
    name?: string;
    onChange: (file: File | null) => void;
    accept?: string;
    error?: string;
    required?: boolean;
    value?: File | null;
    /**
     * Helper text shown below the drag area
     */
    helperText?: string;
    disabled?: boolean;
}

export default function FileUpload({
    label = "Tài liệu",
    name = "file",
    onChange,
    accept,
    error,
    required = false,
    value,
    helperText = "PDF, Word, Excel, PowerPoint, Hình ảnh, Video...",
    disabled = false,
}: FileUploadProps) {
    const [file, setFile] = useState<File | null>(value || null);
    const [preview, setPreview] = useState<string | null>(null);
    const [isHovering, setIsHovering] = useState(false);
    const [isDragOver, setIsDragOver] = useState(false);

    // Get upload limits from system config
    const { formatMaxSize, validateFileSize } = useUploadLimits();

    useEffect(() => {
        setFile(value || null);
        if (value && value.type.startsWith("image/")) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setPreview(reader.result as string);
            };
            reader.readAsDataURL(value);
        } else {
            setPreview(null);
        }
    }, [value]);

    useEffect(() => {
        const handleGlobalPaste = (e: ClipboardEvent) => {
            // If clipboard has files, capture them regardless of hover state
            if (e.clipboardData && e.clipboardData.files && e.clipboardData.files.length > 0) {
                e.preventDefault();
                const pastedFile = e.clipboardData.files[0];
                onChange(pastedFile);
            }
        };

        document.addEventListener('paste', handleGlobalPaste);
        return () => {
            document.removeEventListener('paste', handleGlobalPaste);
        };
    }, [onChange]);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (files && files.length > 0) {
            const selectedFile = files[0];

            // Validate file size against system limits
            const validation = validateFileSize(selectedFile.size);
            if (!validation.valid && validation.error) {
                // Show error but still allow onChange to handle it
                console.error('File size validation failed:', validation.error);
            }

            onChange(selectedFile);
        }
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragOver(true);
    };

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragOver(false);
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragOver(false);

        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            const droppedFile = e.dataTransfer.files[0];

            // Validate file size against system limits
            const validation = validateFileSize(droppedFile.size);
            if (!validation.valid && validation.error) {
                console.error('File size validation failed:', validation.error);
            }

            onChange(droppedFile);
        }
    };

    const handlePaste = (e: React.ClipboardEvent) => {
        if (e.clipboardData.files && e.clipboardData.files.length > 0) {
            const pastedFile = e.clipboardData.files[0];

            // Validate file size against system limits
            const validation = validateFileSize(pastedFile.size);
            if (!validation.valid && validation.error) {
                console.error('File size validation failed:', validation.error);
            }

            onChange(pastedFile);
        }
    };

    const clearFile = () => {
        onChange(null);
        setPreview(null);
    };

    return (
        <div>
            <label className="mb-2 block text-sm font-medium text-gray-900 dark:text-white">
                {label} {required && <span className="text-red-500">*</span>}
            </label>

            <div className="flex flex-col gap-4">
                {!file ? (
                    <label
                        className={`group relative w-full flex flex-col items-center justify-center rounded-lg border-2 border-dashed transition-all outline-none focus:border-primary focus:ring-2 focus:ring-primary/20
              ${disabled ? "cursor-not-allowed opacity-60 bg-gray-100 border-gray-200 dark:bg-gray-800/20 dark:border-gray-700" : "cursor-pointer"}
              ${!disabled && (isDragOver || isHovering)
                                ? "border-primary bg-primary/10"
                                : !disabled ? "border-gray-300 bg-gray-50 hover:border-primary hover:bg-primary/5 dark:border-gray-700 dark:bg-gray-800/50 dark:hover:border-primary dark:hover:bg-primary/10" : ""
                            }
              ${error ? "border-red-300 bg-red-50 dark:border-red-800 dark:bg-red-900/10" : ""}
            `}
                        onMouseEnter={() => !disabled && setIsHovering(true)}
                        onMouseLeave={() => setIsHovering(false)}
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onDrop={handleDrop}
                        onPaste={handlePaste}
                        tabIndex={disabled ? -1 : 0}
                    >
                        <div className="flex flex-col items-center justify-center space-y-2 text-center py-10 px-6">
                            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 transition-colors group-hover:bg-white dark:bg-gray-800 dark:group-hover:bg-gray-700">
                                <CloudArrowUpIcon className={`h-6 w-6 transition-colors ${isDragOver || isHovering ? "text-primary" : "text-gray-400 group-hover:text-primary"}`} />
                            </div>
                            <div className="space-y-1">
                                <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                    <span className="text-primary group-hover:underline">Chọn file, dán (Ctrl+V)</span> hoặc kéo thả vào đây
                                </p>
                                <p className="text-xs text-gray-500 dark:text-gray-400">
                                    {helperText}
                                    <br />
                                    <span className="font-medium">Giới hạn: {formatMaxSize()}</span>
                                </p>
                            </div>
                        </div>
                        <input
                            type="file"
                            name={name}
                            onChange={handleFileChange}
                            className="hidden"
                            accept={accept}
                            disabled={disabled}
                        />
                    </label>
                ) : (
                    <div className="flex flex-col gap-3">
                        <div className="flex items-center justify-between rounded-lg border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-800">
                            <div className="flex items-center gap-3">
                                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                                    <DocumentTextIcon className="h-5 w-5" />
                                </div>
                                <div className="flex flex-col">
                                    <span className="text-sm font-medium text-gray-900 dark:text-white truncate max-w-[200px] sm:max-w-xs block">
                                        {file.name}
                                    </span>
                                    <span className="text-xs text-gray-500 dark:text-gray-400">
                                        {formatFileSize(file.size)}
                                    </span>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={clearFile}
                                disabled={disabled}
                                className={`rounded-lg p-2 text-gray-400 transition-colors ${disabled ? 'opacity-40 cursor-not-allowed' : 'hover:bg-gray-100 hover:text-red-600 dark:hover:bg-gray-700 dark:hover:text-red-400'}`}
                                title="Xóa file"
                            >
                                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>

                        {preview && (
                            <div className="text-center bg-gray-50 dark:bg-gray-800/50 rounded-lg p-2 border border-dashed border-gray-200 dark:border-gray-700">
                                <img src={preview} alt="Preview" className="max-h-60 mx-auto rounded-lg" />
                            </div>
                        )}
                    </div>
                )}

                {error && (
                    <div className="rounded-lg border border-red-200 bg-red-50 p-3 dark:border-red-800 dark:bg-red-900/20">
                        <p className="text-sm text-red-600 dark:text-red-400 mb-2">{error}</p>
                    </div>
                )}
            </div>
        </div>
    );
}
