"use client";
import { useState } from "react";
import { useCreateLearningResource, useSubjects, useGradeLevels } from "@/hooks/use-api";
import { useAuthContext } from "@/contexts/auth-context";
import InputGroup from "@/components/FormElements/InputGroup";
import SelectInput from "@/components/FormElements/SelectInput";
import RichTextEditor from "@/components/FormElements/RichTextEditorDynamic";
import TagsInput from "@/components/FormElements/TagsInput";
import { CheckCircleIcon } from "@heroicons/react/24/outline";
import { useNotification } from "@/hooks/use-notification";
import { extractErrorMessage, extractFieldErrors, extractStorageLimitErrorDetails } from "@/lib/api-error-utils";
import Button from "@/components/Common/Button";
import FileUpload from "@/components/FormElements/FileUpload";
import ImageUpload from "@/components/FormElements/ImageUpload";
import { getObjId } from "@/lib/id-utils";
import { useErrorDisplay } from "@/components/Common/ErrorDisplay";

interface CreateResourceFormProps {
    onSuccess?: (resource: any) => void;
    onCancel?: () => void;
    className?: string;
}

export default function CreateResourceForm({ onSuccess, onCancel, className = "" }: CreateResourceFormProps) {
    const { user } = useAuthContext();
    const { mutate: createResource, loading: createLoading } = useCreateLearningResource();
    const { success, error: showError } = useNotification();
    const { data: subjects, loading: subjectsLoading } = useSubjects({ is_active: true, sort: 'order', order: 'asc' });
    const { data: gradeLevels, loading: gradeLevelsLoading } = useGradeLevels({ is_active: true, sort: 'order', order: 'asc' });
    const { renderError } = useErrorDisplay("Tạo tài liệu");

    const isLoading = subjectsLoading || gradeLevelsLoading;

    // Check if user is Tutor (cannot share publicly in tutor-only system)
    const isTutor = user?.is_tutor || user?.role === 'tutor';

    const [formData, setFormData] = useState({
        title: "",
        description: "",
        type: "document",
        external_url: "",
        status: "active",
        is_public: false,
        topic: "",
        tags: [] as string[],
        subject_id: "",
        grade_level_id: "",
    });

    const [file, setFile] = useState<File | null>(null);
    const [imageFiles, setImageFiles] = useState<File[]>([]); // Multiple images for image type
    const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
    const [permissionDenied, setPermissionDenied] = useState<{ message: string } | null>(null);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value, type } = e.target;
        const checked = (e.target as HTMLInputElement).checked;
        setFormData(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value
        }));
        if (fieldErrors[name]) {
            setFieldErrors(prev => {
                const newErrors = { ...prev };
                delete newErrors[name];
                return newErrors;
            });
        }
    };

    const handleRichTextChange = (value: string) => {
        setFormData(prev => ({
            ...prev,
            description: value
        }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setFieldErrors({});

        if (!formData.title.trim()) {
            showError("Vui lòng nhập tiêu đề");
            return;
        }

        if (formData.type === 'link' && !formData.external_url.trim()) {
            showError("Vui lòng nhập liên kết");
            return;
        }

        if (formData.type === 'image' && imageFiles.length === 0) {
            showError("Vui lòng chọn ít nhất một hình ảnh");
            return;
        }

        if (formData.type !== 'link' && formData.type !== 'image' && !file) {
            showError("Vui lòng chọn file hoặc thêm liên kết");
            return;
        }

        try {
            const isPublicValue = isTutor ? false : formData.is_public;
            let result;

            if (formData.type === 'image' && imageFiles.length > 0) {
                // Handle multiple images
                const formDataToSend = new FormData();
                formDataToSend.append('title', formData.title);
                if (formData.description) formDataToSend.append('description', formData.description);
                formDataToSend.append('type', 'image');
                formDataToSend.append('status', formData.status);
                formDataToSend.append('is_public', isPublicValue ? '1' : '0');
                if (formData.topic) formDataToSend.append('topic', formData.topic);
                if (formData.tags && formData.tags.length > 0) {
                    formData.tags.forEach((tag, index) => {
                        formDataToSend.append(`tags[${index}]`, tag);
                    });
                }
                if (formData.subject_id) formDataToSend.append('subject_id', formData.subject_id);
                if (formData.grade_level_id) formDataToSend.append('grade_level_id', formData.grade_level_id);

                // Add multiple image files
                imageFiles.forEach((imageFile) => {
                    formDataToSend.append('files[]', imageFile);
                });

                result = await createResource(formDataToSend);
            } else if (file) {
                // Handle single file
                const formDataToSend = new FormData();
                formDataToSend.append('title', formData.title);
                if (formData.description) formDataToSend.append('description', formData.description);
                formDataToSend.append('type', formData.type);
                formDataToSend.append('status', formData.status);
                formDataToSend.append('is_public', isPublicValue ? '1' : '0');
                if (formData.topic) formDataToSend.append('topic', formData.topic);
                if (formData.tags && formData.tags.length > 0) {
                    formData.tags.forEach((tag, index) => {
                        formDataToSend.append(`tags[${index}]`, tag);
                    });
                }
                if (formData.external_url) formDataToSend.append('external_url', formData.external_url);
                if (formData.subject_id) formDataToSend.append('subject_id', formData.subject_id);
                if (formData.grade_level_id) formDataToSend.append('grade_level_id', formData.grade_level_id);
                formDataToSend.append('file', file);

                result = await createResource(formDataToSend);
            } else if (formData.external_url) {
                // Handle external URL
                result = await createResource({
                    title: formData.title,
                    description: formData.description || undefined,
                    type: formData.type,
                    external_url: formData.external_url,
                    status: formData.status,
                    is_public: isPublicValue,
                    topic: formData.topic || undefined,
                    tags: formData.tags && formData.tags.length > 0 ? formData.tags : undefined,
                    subject_id: formData.subject_id ? formData.subject_id : undefined,
                    grade_level_id: formData.grade_level_id ? formData.grade_level_id : undefined,
                });
            }

            if (result) {
                if (result.success) {
                    success("Tạo tài liệu thành công");
                    if (onSuccess) {
                        onSuccess(result.data);
                    }
                } else {
                    if (result.code === 'UNAUTHORIZED' || result.code === 'FORBIDDEN') {
                        setPermissionDenied({ message: result.message || "Bạn không có quyền thực hiện thao tác này." });
                        return;
                    }

                    const storageErrorDetails = extractStorageLimitErrorDetails(result);
                    if (storageErrorDetails && result.code === 'STORAGE_LIMIT_EXCEEDED') {
                        const errorMsg = result.message || "Dung lượng lưu trữ không đủ";
                        showError(errorMsg);
                        setFieldErrors({ file: errorMsg });
                    } else {
                        const errors = extractFieldErrors(result);
                        const errorMessage = extractErrorMessage(result, "Có lỗi xảy ra khi tạo tài liệu");
                        setFieldErrors(errors);
                        showError(errorMessage);
                    }
                }
            }
        } catch (_err) {
            showError('Lỗi khi tạo tài liệu');
        }
    };

    if (permissionDenied) {
        return (
            <div className="py-8">
                {renderError(permissionDenied.message, undefined, false)}
                <div className="flex justify-center mt-6">
                    <Button variant="outline" onClick={onCancel}>Quay lại</Button>
                </div>
            </div>
        );
    }

    if (isLoading) {
        return (
            <div className="space-y-6 p-4">
                <div className="h-4 w-48 rounded bg-gray-200 dark:bg-gray-700 animate-pulse" />
                <div className="h-12 w-full rounded-lg bg-gray-200 dark:bg-gray-700 animate-pulse" />
                <div className="h-32 w-full rounded-lg bg-gray-200 dark:bg-gray-700 animate-pulse" />
            </div>
        );
    }

    return (
        <form onSubmit={handleSubmit} className={`space-y-6 ${className}`}>
            <div className="space-y-6">
                <SelectInput
                    label="Loại tài liệu"
                    name="type"
                    value={formData.type}
                    onChange={handleChange}
                    error={fieldErrors.type}
                    options={[
                        { value: "document", label: "Tài liệu" },
                        { value: "pdf", label: "PDF" },
                        { value: "video", label: "Video" },
                        { value: "image", label: "Hình ảnh" },
                        { value: "audio", label: "Âm thanh" },
                        { value: "link", label: "Liên kết" },
                        { value: "other", label: "Khác" },
                    ]}
                    required
                />

                {formData.type === 'link' ? (
                    <InputGroup
                        label="Liên kết"
                        name="external_url"
                        type="url"
                        value={formData.external_url}
                        handleChange={handleChange}
                        placeholder="https://example.com"
                        required={formData.type === 'link'}
                        error={fieldErrors.external_url}
                    />
                ) : formData.type === 'image' ? (
                    <ImageUpload
                        label="Hình ảnh"
                        name="images"
                        value={imageFiles}
                        onChange={(files) => {
                            setImageFiles(files);

                            // Auto-fill title if empty and only one image
                            if (!formData.title && files.length === 1) {
                                const name = files[0].name.substring(0, files[0].name.lastIndexOf('.')) || files[0].name;
                                setFormData(prev => ({ ...prev, title: name }));
                            }

                            // Clear field errors
                            if (files.length > 0 && fieldErrors.files) {
                                setFieldErrors(prev => {
                                    const newErrors = { ...prev };
                                    delete newErrors.files;
                                    return newErrors;
                                });
                            }
                        }}
                        onError={showError}
                        error={fieldErrors.files}
                        required
                        disabled={createLoading}
                        maxFiles={10}
                        maxFileSize={5 * 1024 * 1024}
                    />
                ) : (
                    <FileUpload
                        label="File"
                        required
                        value={file}
                        onChange={(newFile) => {
                            setFile(newFile);
                            if (newFile) {
                                const updates: any = {};

                                // Auto-detect type
                                const extension = newFile.name.split('.').pop()?.toLowerCase();
                                if (newFile.type.startsWith('image/')) {
                                    updates.type = 'image';
                                } else if (newFile.type.startsWith('video/')) {
                                    updates.type = 'video';
                                } else if (newFile.type.startsWith('audio/')) {
                                    updates.type = 'audio';
                                } else if (newFile.type === 'application/pdf' || extension === 'pdf') {
                                    updates.type = 'pdf';
                                } else if (['doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt'].includes(extension || '')) {
                                    updates.type = 'document';
                                }

                                // Auto-fill title if empty
                                if (!formData.title) {
                                    const name = newFile.name.substring(0, newFile.name.lastIndexOf('.')) || newFile.name;
                                    updates.title = name;
                                }

                                if (Object.keys(updates).length > 0) {
                                    setFormData(prev => ({ ...prev, ...updates }));
                                }

                                if (fieldErrors.file) {
                                    setFieldErrors(prev => {
                                        const newErrors = { ...prev };
                                        delete newErrors.file;
                                        return newErrors;
                                    });
                                }
                            }
                        }}
                        accept={
                            formData.type === 'pdf' ? '.pdf' :
                                formData.type === 'video' ? 'video/*' :
                                    formData.type === 'image' ? 'image/*' :
                                        formData.type === 'audio' ? 'audio/*' :
                                            formData.type === 'document' ? '.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt' :
                                                undefined
                        }
                        helperText={
                            formData.type === 'pdf' ? 'PDF' :
                                formData.type === 'video' ? 'Video (MP4, AVI, MOV...)' :
                                    formData.type === 'image' ? 'Hình ảnh (JPG, PNG, GIF...)' :
                                        formData.type === 'audio' ? 'Âm thanh (MP3, WAV...)' :
                                            formData.type === 'document' ? 'PDF, Word, Excel, PowerPoint...' :
                                                'Tất cả các định dạng file'
                        }
                        error={fieldErrors.file}
                    />
                )}

                <InputGroup
                    label="Tiêu đề"
                    name="title"
                    type="text"
                    value={formData.title}
                    handleChange={handleChange}
                    placeholder="Nhập tiêu đề tài liệu"
                    required
                    error={fieldErrors.title}
                />

                <RichTextEditor
                    label="Mô tả"
                    value={formData.description}
                    onChange={handleRichTextChange}
                    placeholder="Nhập mô tả tài liệu (tùy chọn)"
                    error={fieldErrors.description}
                />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <SelectInput
                        label="Môn học"
                        name="subject_id"
                        value={formData.subject_id}
                        onChange={handleChange}
                        error={fieldErrors.subject_id}
                        options={[
                            { value: "", label: "-- Chọn môn học --" },
                            ...(subjects?.map((subject: any) => {
                                const subjectId = getObjId(subject);
                                return {
                                    value: String(subjectId),
                                    label: subject.name,
                                };
                            }) || []),
                        ]}
                    />

                    <SelectInput
                        label="Cấp độ/Khối"
                        name="grade_level_id"
                        value={formData.grade_level_id}
                        onChange={handleChange}
                        error={fieldErrors.grade_level_id}
                        options={[
                            { value: "", label: "-- Chọn cấp độ --" },
                            ...(gradeLevels?.map((gradeLevel: any) => {
                                const levelId = getObjId(gradeLevel);
                                return {
                                    value: String(levelId),
                                    label: gradeLevel.name,
                                };
                            }) || []),
                        ]}
                    />
                </div>

                <InputGroup
                    label="Chủ đề"
                    name="topic"
                    type="text"
                    value={formData.topic}
                    handleChange={handleChange}
                    placeholder="Ví dụ: Toán học, Lịch sử..."
                    error={fieldErrors.topic}
                />

                <TagsInput
                    label="Tags"
                    value={formData.tags}
                    onChange={(tags) => {
                        setFormData(prev => ({ ...prev, tags }));
                        if (fieldErrors.tags) {
                            setFieldErrors(prev => {
                                const newErrors = { ...prev };
                                delete newErrors.tags;
                                return newErrors;
                            });
                        }
                    }}
                    placeholder="Nhập tag và nhấn Enter hoặc dấu phẩy"
                    error={fieldErrors.tags}
                />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <SelectInput
                            label="Trạng thái"
                            name="status"
                            value={formData.status}
                            onChange={handleChange}
                            options={[
                                { value: "active", label: "Đang dùng" },
                                { value: "archived", label: "Đã lưu trữ" },
                            ]}
                        />
                    </div>

                    {!isTutor && (
                        <div className="flex items-center pt-8">
                            <input
                                id="is_public"
                                name="is_public"
                                type="checkbox"
                                checked={formData.is_public}
                                onChange={handleChange}
                                className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary dark:border-gray-600"
                            />
                            <label htmlFor="is_public" className="ml-2 text-sm font-medium text-gray-900 dark:text-white">
                                Chia sẻ công khai (các giáo viên khác có thể xem)
                            </label>
                        </div>
                    )}
                </div>
            </div>

            <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-3 sm:gap-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                <Button
                    type="button"
                    onClick={onCancel}
                    variant="outline"
                    size="sm"
                    className="w-full sm:w-auto justify-center"
                >
                    Hủy
                </Button>
                <Button
                    type="submit"
                    disabled={createLoading}
                    loading={createLoading}
                    size="sm"
                    variant="primary"
                    icon={<CheckCircleIcon />}
                    className="w-full sm:w-auto justify-center"
                >
                    Tạo tài liệu
                </Button>
            </div>
        </form>
    );
}
