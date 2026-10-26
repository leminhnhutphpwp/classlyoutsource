"use client";
import { CloudArrowUpIcon, XMarkIcon, PhotoIcon } from "@heroicons/react/24/outline";
import { useEffect, useState, useRef, useCallback } from "react";
import { formatFileSize } from "@/lib/format-number";
import { useUploadLimits } from "@/hooks/use-upload-limits";

interface ImageUploadProps {
    label?: string;
    name?: string;
    onChange: (files: File[]) => void;
    error?: string;
    required?: boolean;
    value?: File[];
    /**
     * Helper text shown below the drag area
     */
    helperText?: string;
    disabled?: boolean;
    maxFiles?: number;
    maxFileSize?: number; // in bytes
    /**
     * Callback for showing error messages
     */
    onError?: (message: string) => void;
}

export default function ImageUpload({
    label = "Hình ảnh",
    name = "images",
    onChange,
    error,
    required = false,
    value = [],
    helperText = "Chọn tối đa 10 hình ảnh (JPEG, PNG, GIF, WebP). Mỗi file tối đa 5MB.",
    disabled = false,
    maxFiles = 10,
    maxFileSize = 5 * 1024 * 1024, // 5MB
    onError,
}: ImageUploadProps) {
    const [files, setFiles] = useState<File[]>(value || []);
    const [previews, setPreviews] = useState<string[]>([]);
    const [isHovering, setIsHovering] = useState(false);
    const [isDragOver, setIsDragOver] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [showPasteSuccess, setShowPasteSuccess] = useState(false);
    const containerRef = useRef<HTMLLabelElement>(null);

    // Get upload limits from system config
    const { formatMaxSize, validateFileSize } = useUploadLimits();

    useEffect(() => {
        setFiles(value || []);

        // Generate previews
        const newPreviews: string[] = [];
        (value || []).forEach((file, index) => {
            if (file.type.startsWith("image/")) {
                const reader = new FileReader();
                reader.onloadend = () => {
                    newPreviews[index] = reader.result as string;
                    if (newPreviews.filter(p => p).length === (value || []).length) {
                        setPreviews([...newPreviews]);
                    }
                };
                reader.readAsDataURL(file);
            }
        });

        if ((value || []).length === 0) {
            setPreviews([]);
        }
    }, [value]);

    // Generate file hash for duplicate detection
    const generateFileHash = useCallback(async (file: File): Promise<string> => {
        const buffer = await file.arrayBuffer();
        const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
        return hashHex;
    }, []);

    // Check for duplicate files
    const checkForDuplicates = useCallback(async (newFiles: File[], existingFiles: File[]): Promise<{ unique: File[], duplicates: string[] }> => {
        const unique: File[] = [];
        const duplicates: string[] = [];

        // Generate hashes for existing files
        const existingHashes = new Map<string, string>();
        for (const existingFile of existingFiles) {
            const hash = await generateFileHash(existingFile);
            existingHashes.set(hash, existingFile.name);
        }

        // Track hashes of files being added in this batch
        const batchHashes = new Map<string, string>();

        // Check new files against existing and batch
        for (const newFile of newFiles) {
            const newHash = await generateFileHash(newFile);

            // Check if hash already exists in existing files
            if (existingHashes.has(newHash)) {
                duplicates.push(newFile.name);
            }
            // Check if hash already exists in current batch
            else if (batchHashes.has(newHash)) {
                duplicates.push(newFile.name);
            }
            else {
                unique.push(newFile);
                batchHashes.set(newHash, newFile.name);
            }
        }

        return { unique, duplicates };
    }, [generateFileHash]);

    const validateFiles = useCallback((newFiles: File[]): { valid: File[], errors: string[] } => {
        const errors: string[] = [];
        const valid: File[] = [];

        newFiles.forEach(file => {
            // Check file type
            if (!file.type.startsWith('image/')) {
                errors.push(`${file.name}: Chỉ chấp nhận file hình ảnh`);
                return;
            }

            // Check system upload limit first
            const uploadValidation = validateFileSize(file.size);
            if (!uploadValidation.valid && uploadValidation.error) {
                errors.push(`${file.name}: ${uploadValidation.error}`);
                return;
            }

            // Check component-specific file size limit
            if (file.size > maxFileSize) {
                errors.push(`${file.name}: Kích thước vượt quá ${formatFileSize(maxFileSize)}`);
                return;
            }

            valid.push(file);
        });

        return { valid, errors };
    }, [validateFileSize, maxFileSize]);

    const addFiles = useCallback(async (newFiles: File[]) => {
        if (isProcessing) return; // Prevent multiple simultaneous operations

        setIsProcessing(true);

        try {
            const { valid, errors } = validateFiles(newFiles);

            if (errors.length > 0) {
                errors.forEach(error => {
                    if (onError) {
                        onError(error);
                    } else {
                        console.error('File validation error:', error);
                    }
                });
                return;
            }

            // Check for duplicates
            const { unique, duplicates } = await checkForDuplicates(valid, files);

            if (duplicates.length > 0) {
                const duplicateMsg = duplicates.length === 1
                    ? `Đã bỏ qua hình ảnh trùng lặp: ${duplicates[0]}`
                    : `Đã bỏ qua ${duplicates.length} hình ảnh trùng lặp: ${duplicates.slice(0, 3).join(', ')}${duplicates.length > 3 ? '...' : ''}`;

                if (onError) {
                    onError(duplicateMsg);
                } else {
                    console.warn(duplicateMsg);
                }
            }

            // If no unique files after duplicate check
            if (unique.length === 0) {
                if (duplicates.length > 0) {
                    // All files were duplicates, already showed message above
                    return;
                } else {
                    // No valid files at all
                    return;
                }
            }

            const totalFiles = [...files, ...unique];

            if (totalFiles.length > maxFiles) {
                const errorMsg = `Tối đa ${maxFiles} hình ảnh`;
                if (onError) {
                    onError(errorMsg);
                } else {
                    console.error(errorMsg);
                }
                return;
            }

            const updatedFiles = totalFiles.slice(0, maxFiles);
            onChange(updatedFiles);

            // Show success feedback for paste operations
            if (newFiles.length > 0) {
                setShowPasteSuccess(true);
                setTimeout(() => setShowPasteSuccess(false), 2000);
            }
        } finally {
            setIsProcessing(false);
        }
    }, [isProcessing, validateFiles, checkForDuplicates, files, maxFiles, onChange, onError]);

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFiles = Array.from(e.target.files || []);
        await addFiles(selectedFiles);
        // Reset input
        e.target.value = '';
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragOver(true);
    };

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragOver(false);
    };

    const handleDrop = async (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragOver(false);

        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            const droppedFiles = Array.from(e.dataTransfer.files);
            await addFiles(droppedFiles);
        }
    };

    const handlePaste = async (e: React.ClipboardEvent) => {
        e.preventDefault();
        if (disabled || isProcessing) return;

        if (e.clipboardData.files && e.clipboardData.files.length > 0) {
            // Filter only image files
            const imageFiles = Array.from(e.clipboardData.files).filter(file =>
                file.type.startsWith('image/')
            );

            if (imageFiles.length > 0) {
                await addFiles(imageFiles);
            } else {
                // Show message if no image files found
                if (onError) {
                    onError("Chỉ có thể dán file hình ảnh");
                }
            }
        }
    };

    // Add global paste event listener with improved focus detection
    useEffect(() => {
        const handleGlobalPaste = async (e: ClipboardEvent) => {
            // Check if component is visible and not disabled
            if (disabled || isProcessing || !containerRef.current) return;

            // Check if container is visible in viewport
            const rect = containerRef.current.getBoundingClientRect();
            const isVisible = rect.width > 0 && rect.height > 0 &&
                rect.top < window.innerHeight && rect.bottom > 0;

            if (!isVisible) return;

            // Only handle paste if the upload area is focused or no other input is focused
            const activeElement = document.activeElement;

            // More comprehensive check for focused inputs
            const isInputFocused = activeElement && (
                activeElement.tagName === 'INPUT' ||
                activeElement.tagName === 'TEXTAREA' ||
                (activeElement as HTMLElement).contentEditable === 'true' ||
                activeElement.getAttribute('contenteditable') === 'true' ||
                activeElement.closest('[contenteditable="true"]') ||
                activeElement.closest('input') ||
                activeElement.closest('textarea') ||
                // Check for rich text editors
                activeElement.closest('.ql-editor') ||
                activeElement.closest('.tox-edit-area') ||
                activeElement.closest('[role="textbox"]') ||
                // Check if we're inside a modal search input
                (activeElement.closest('[data-modal]') && activeElement.tagName === 'INPUT')
            );

            // If an input is focused, don't handle the paste
            if (isInputFocused) return;

            // Check if we have image files in clipboard
            if (e.clipboardData?.files && e.clipboardData.files.length > 0) {
                // Check if files contain images
                const imageFiles = Array.from(e.clipboardData.files).filter(file =>
                    file.type.startsWith('image/')
                );

                if (imageFiles.length > 0) {
                    e.preventDefault();
                    e.stopPropagation();
                    await addFiles(imageFiles);
                }
            }
        };

        // Only add listener if component is mounted and not disabled
        if (!disabled) {
            document.addEventListener('paste', handleGlobalPaste, { capture: true });
        }

        return () => {
            document.removeEventListener('paste', handleGlobalPaste, { capture: true });
        };
    }, [disabled, isProcessing, addFiles]);

    const removeFile = (index: number) => {
        const updatedFiles = files.filter((_, i) => i !== index);
        onChange(updatedFiles);
    };

    const clearAllFiles = () => {
        onChange([]);
    };

    return (
        <div>
            <label className="mb-2 block text-sm font-medium text-gray-900 dark:text-white">
                {label} {required && <span className="text-red-500">*</span>}
            </label>

            <div className="flex flex-col gap-4">
                {/* Upload Area */}
                <label
                    ref={containerRef}
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
                    onKeyDown={(e) => {
                        // Allow keyboard activation
                        if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            const input = e.currentTarget.querySelector('input[type="file"]') as HTMLInputElement;
                            input?.click();
                        }
                    }}
                >
                    <div className="flex flex-col items-center justify-center space-y-2 text-center py-10 px-6">
                        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 transition-colors group-hover:bg-white dark:bg-gray-800 dark:group-hover:bg-gray-700">
                            <CloudArrowUpIcon className={`h-6 w-6 transition-colors ${isDragOver || isHovering ? "text-primary" : "text-gray-400 group-hover:text-primary"}`} />
                        </div>
                        <div className="space-y-1">
                            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                <span className="text-primary group-hover:underline">
                                    {isProcessing ? "Đang xử lý..." : showPasteSuccess ? "Đã dán thành công!" : "Chọn hình ảnh, dán (Ctrl+V)"}
                                </span> hoặc kéo thả vào đây
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                                {helperText}
                                <br />
                                <span className="font-medium">Giới hạn: {formatMaxSize()}</span>
                                <br />
                            </p>
                        </div>
                    </div>
                    <input
                        type="file"
                        name={name}
                        onChange={handleFileChange}
                        className="hidden"
                        accept="image/*"
                        multiple
                        disabled={disabled || isProcessing}
                    />
                </label>

                {/* Selected Images Preview */}
                {files.length > 0 && (
                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                Đã chọn {files.length} hình ảnh
                            </p>
                            <button
                                type="button"
                                onClick={clearAllFiles}
                                disabled={disabled}
                                className={`text-xs text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 ${disabled ? 'opacity-40 cursor-not-allowed' : 'hover:underline'}`}
                            >
                                Xóa tất cả
                            </button>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                            {files.map((file, index) => (
                                <div key={index} className="relative group">
                                    <div className="aspect-square rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
                                        {previews[index] ? (
                                            <img
                                                src={previews[index]}
                                                alt={file.name}
                                                className="w-full h-full object-cover"
                                            />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center">
                                                <PhotoIcon className="h-8 w-8 text-gray-400" />
                                            </div>
                                        )}
                                    </div>

                                    {/* Remove button */}
                                    <button
                                        type="button"
                                        onClick={() => removeFile(index)}
                                        disabled={disabled}
                                        className={`absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 transition-opacity ${disabled ? 'opacity-40 cursor-not-allowed' : 'opacity-0 group-hover:opacity-100 hover:bg-red-600'}`}
                                    >
                                        <XMarkIcon className="h-4 w-4" />
                                    </button>

                                    {/* File info */}
                                    <div className="mt-1">
                                        <p className="text-xs text-gray-500 dark:text-gray-400 truncate" title={file.name}>
                                            {file.name}
                                        </p>
                                        <p className="text-xs text-gray-400 dark:text-gray-500">
                                            {formatFileSize(file.size)}
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>
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