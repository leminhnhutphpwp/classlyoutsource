import { useState, useEffect, useRef, useMemo } from "react";
import { useDebounce } from "@/hooks/use-debounce";
import { createPortal } from "react-dom";
import { useLearningResources } from "@/hooks/use-api";
import { LinkIcon, XMarkIcon, PaperClipIcon, PlayIcon } from "@heroicons/react/24/outline";
import { getLearningResourceTypeBadge, getLearningResourceFileSize } from "@/lib/learning-resource-helpers";
import { ListSkeleton } from "@/components/ui/loading";
import CreateResourceForm from "@/components/LearningResources/CreateResourceForm";
import { Tabs } from "@/components/Common/Tabs";
import { getObjId, idsEqual } from "@/lib/id-utils";
import { useErrorDisplay } from "@/components/Common/ErrorDisplay";

interface LearningResourcePickerProps {
    showModal: boolean;
    onClose: () => void;
    onApply: (ids: (number | string)[], resources?: any[]) => void;
    initialSelectedIds: (number | string)[];
    initialResources?: any[];
    disabled?: boolean;
}

export default function LearningResourcePicker({
    showModal,
    onClose,
    onApply,
    initialSelectedIds,
    initialResources = [],
}: LearningResourcePickerProps) {
    const [searchTerm, setSearchTerm] = useState("");
    const debouncedSearchTerm = useDebounce(searchTerm, 300);
    const [tempSelectedIds, setTempSelectedIds] = useState<(number | string)[]>([]);
    const [activeTab, setActiveTab] = useState<'list' | 'create'>('list');
    const scrollbarWidthRef = useRef(0);
    const { renderError } = useErrorDisplay("Chọn tài liệu");

    const { data: resources, loading: resourcesLoading, refetch, error: resourcesError } = useLearningResources({
        status: 'active',
        search: debouncedSearchTerm || undefined,
        per_page: 50,
    });

    // Handle scroll locking lifecycle
    useEffect(() => {
        if (showModal) {
            if (typeof window !== 'undefined') {
                scrollbarWidthRef.current = window.innerWidth - document.documentElement.clientWidth;
                document.body.style.paddingRight = `${scrollbarWidthRef.current}px`;
                document.body.style.setProperty("overflow", "hidden", "important");
            }
        } else {
            if (typeof document !== 'undefined') {
                document.body.style.removeProperty("overflow");
                document.body.style.paddingRight = "";
            }
        }

        return () => {
            if (typeof document !== 'undefined') {
                document.body.style.removeProperty("overflow");
                document.body.style.paddingRight = "";
            }
        };
    }, [showModal]);

    // Sync tempSelectedIds with initialSelectedIds when modal opens
    useEffect(() => {
        if (showModal) {
            setTempSelectedIds(initialSelectedIds.map(v => String(v)));
            setActiveTab('list');
            setSearchTerm("");
        }
    }, [showModal, initialSelectedIds]);

    const availableResources = useMemo(() => {
        const allResources = [...(initialResources || [])];
        if (resources && Array.isArray(resources)) {
            allResources.push(...resources);
        }

        if (allResources.length === 0) return [];

        const uniqueResources = new Map();
        allResources.forEach((resource: any) => {
            if (!resource) return;

            const resourceId = getObjId(resource);
            const key = resourceId;

            if (resourceId && !uniqueResources.has(key)) {
                uniqueResources.set(key, { ...resource, id: resourceId });
            }
        });
        return Array.from(uniqueResources.values());
    }, [resources, initialResources]);

    const handleToggleSelection = (resourceId: number | string) => {
        if (tempSelectedIds.some(id => idsEqual(id, resourceId))) {
            setTempSelectedIds(tempSelectedIds.filter(id => !idsEqual(id, resourceId)));
        } else {
            setTempSelectedIds([...tempSelectedIds, resourceId]);
        }
    };

    const handleCreateSuccess = (newResource: any) => {
        const newId = getObjId(newResource);
        if (!newId) return;

        setTempSelectedIds(prev => {
            if (prev.some(id => idsEqual(id, newId))) {
                return prev;
            }
            return [...prev, newId];
        });
        setActiveTab('list');
        refetch();
    };

    const handleApply = () => {
        const selectedResources = availableResources.filter((r: any) =>
            tempSelectedIds.some(id => idsEqual(id, r))
        );
        onApply(tempSelectedIds, selectedResources);
        onClose();
    };

    if (!showModal) return null;

    return createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="w-full max-w-2xl rounded-lg bg-white shadow-xl dark:bg-gray-800 max-h-[90vh] sm:max-h-[85vh] flex flex-col relative overflow-hidden">
                <div className="flex items-center justify-between border-b border-gray-200 p-3 sm:p-4 dark:border-gray-700 bg-white dark:bg-gray-800 z-10">
                    <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white">
                        Chọn tài liệu
                    </h3>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                    >
                        <XMarkIcon className="h-5 w-5 sm:h-6 sm:w-6" />
                    </button>
                </div>

                {/* Tabs */}
                {!resourcesError && (
                    <div className="bg-gray-50/50 dark:bg-gray-800/50 px-3 sm:px-4 pt-1 border-b border-gray-200 dark:border-gray-700">
                        <Tabs
                            tabs={[
                                { id: 'list', label: 'Tài liệu có sẵn' },
                                { id: 'create', label: 'Tạo mới' },
                            ]}
                            activeTab={activeTab}
                            onChange={(id) => setActiveTab(id as any)}
                            className="border-none"
                        />
                    </div>
                )}

                <div className="flex-1 overflow-y-auto bg-gray-50 dark:bg-gray-800">
                    {activeTab === 'list' ? (
                        <div className="p-3 sm:p-4">
                            {resourcesError ? (
                                renderError(resourcesError)
                            ) : (
                                <>
                                    <div className="mb-4">
                                        <input
                                            type="text"
                                            placeholder="Tìm kiếm tài liệu..."
                                            value={searchTerm}
                                            onChange={(e) => setSearchTerm(e.target.value)}
                                            className="w-full rounded-lg border border-gray-300 bg-white px-3 sm:px-4 py-2 text-sm sm:text-base text-gray-900 placeholder-gray-500 focus:border-primary focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder-gray-400 dark:focus:border-primary"
                                        />
                                    </div>

                                    {resourcesLoading ? (
                                        <ListSkeleton count={5} showAvatar={true} />
                                    ) : availableResources.length === 0 ? (
                                        <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                                            {searchTerm ? "Không tìm thấy tài liệu" : "Chưa có tài liệu nào"}
                                        </div>
                                    ) : (
                                        <div className="space-y-2">
                                            {availableResources.map((resource: any) => {
                                                const isSelected = tempSelectedIds.some(id => idsEqual(id, resource));
                                                return (
                                                    <button
                                                        key={getObjId(resource)}
                                                        type="button"
                                                        onClick={() => handleToggleSelection(getObjId(resource))}
                                                        className={`w-full text-left flex items-center gap-3 rounded-lg border p-2.5 transition-colors ${isSelected
                                                            ? 'border-primary bg-primary/5 dark:bg-primary/10'
                                                            : 'border-gray-200 bg-white hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:hover:bg-gray-700/50'
                                                            }`}
                                                    >
                                                        <div className={`flex-shrink-0 size-9 rounded-lg flex items-center justify-center ${resource.type === 'video'
                                                            ? 'bg-primary-100 bg-primary-pastel/40'
                                                            : 'bg-primary-100'
                                                            }`}>
                                                            {resource.type === 'video' ? (
                                                                <PlayIcon className="h-4 w-4 text-primary" />
                                                            ) : resource.external_url ? (
                                                                <LinkIcon className="h-4 w-4 text-primary" />
                                                            ) : (
                                                                <PaperClipIcon className="h-4 w-4 text-primary" />
                                                            )}
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <div className="flex items-center gap-2 mb-0.5 min-w-0">
                                                                <div className="text-sm font-medium text-gray-900 dark:text-white truncate">
                                                                    {resource.title}
                                                                </div>
                                                                {(() => {
                                                                    const typeBadge = getLearningResourceTypeBadge(resource);
                                                                    return typeBadge ? (
                                                                        <span className={`flex-shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium leading-none ${typeBadge.bgColor} ${typeBadge.textColor}`}>
                                                                            {typeBadge.icon}
                                                                            <span className="mt-[1px]">{typeBadge.label}</span>
                                                                        </span>
                                                                    ) : null;
                                                                })()}
                                                            </div>
                                                            {(getLearningResourceFileSize(resource) || resource.description) && (
                                                                <div className="flex items-center gap-2 mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                                                                    {getLearningResourceFileSize(resource) && (
                                                                        <>
                                                                            <span className="flex-shrink-0 font-medium text-gray-600 dark:text-gray-300">
                                                                                {getLearningResourceFileSize(resource)}
                                                                            </span>
                                                                            {resource.description && <span className="text-gray-300 dark:text-gray-600">•</span>}
                                                                        </>
                                                                    )}
                                                                    {resource.description && (
                                                                        <span className="truncate">
                                                                            {resource.description.replace(/<[^>]*>?/gm, '')}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            )}
                                                        </div>
                                                        {isSelected ? (
                                                            <div className="flex-shrink-0 size-5 rounded-full bg-primary flex items-center justify-center">
                                                                <svg className="h-3 w-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                                                </svg>
                                                            </div>
                                                        ) : (
                                                            <div className="flex-shrink-0 size-5 rounded-full border-2 border-gray-300 dark:border-gray-600" />
                                                        )}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    ) : (
                        <div className="p-4 sm:p-6 bg-white dark:bg-gray-800 min-h-full">
                            <CreateResourceForm
                                onSuccess={handleCreateSuccess}
                                onCancel={() => setActiveTab('list')}
                                className="pb-2"
                            />
                        </div>
                    )}
                </div>

                {/* Footer with Apply button - only show in list tab */}
                {activeTab === 'list' && !resourcesError && (
                    <div className="border-t border-gray-200 p-3 sm:p-4 dark:border-gray-700 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 sm:gap-0 bg-white dark:bg-gray-800 z-10">
                        <div className="text-sm text-gray-500 dark:text-gray-400">
                            Đã chọn: <span className="font-medium text-gray-900 dark:text-white">{tempSelectedIds.length}</span>
                        </div>
                        <div className="flex gap-2">
                            <button
                                type="button"
                                onClick={onClose}
                                className="flex-1 sm:flex-none rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
                            >
                                Hủy
                            </button>
                            <button
                                type="button"
                                onClick={handleApply}
                                className="flex-1 sm:flex-none rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary/90"
                            >
                                Lưu thay đổi ({tempSelectedIds.length})
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>,
        document.body
    );
}
