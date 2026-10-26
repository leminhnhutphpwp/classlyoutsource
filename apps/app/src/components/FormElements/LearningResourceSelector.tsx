import { useState, useEffect, useMemo } from "react";
import { LinkIcon, XMarkIcon, PlusIcon, PaperClipIcon, PlayIcon } from "@heroicons/react/24/outline";
import { getLearningResourceTypeBadge, getLearningResourceFileSize } from "@/lib/learning-resource-helpers";
import { getObjId, idsEqual } from "@/lib/id-utils";
import LearningResourcePicker from "./LearningResourcePicker";

interface LearningResourceSelectorProps {
  value: (number | string)[]; // Array of learning resource IDs (mixed types)
  onChange: (ids: (number | string)[]) => void;
  label?: string;
  error?: string;
  disabled?: boolean;
  initialResources?: any[];
}

export default function LearningResourceSelector({
  value = [],
  onChange,
  label = "Tài liệu đính kèm",
  error,
  disabled = false,
  initialResources = [],
}: LearningResourceSelectorProps) {
  const [showPicker, setShowPicker] = useState(false);
  const [cachedResources, setCachedResources] = useState<any[]>(initialResources || []);

  // Merge initialResources into cache when they change
  useEffect(() => {
    if (initialResources && initialResources.length > 0) {
      setCachedResources(prev => {
        const prevIds = new Set(prev.map(r => getObjId(r)));
        const newOnes = initialResources.filter(r => !prevIds.has(getObjId(r)));
        if (newOnes.length === 0) return prev;
        return [...prev, ...newOnes];
      });
    }
  }, [initialResources]);

  const selectedResourcesList = useMemo(() => {
    const selectedSet = new Set(value.map(v => String(v)));
    return cachedResources.filter(r => selectedSet.has(getObjId(r)));
  }, [value, cachedResources]);

  const handleApply = (ids: (number | string)[], resources?: any[]) => {
    if (resources) {
      setCachedResources(prev => {
        const prevIds = new Set(prev.map(r => getObjId(r)));
        const newItems = resources.filter(r => !prevIds.has(getObjId(r)));
        if (newItems.length === 0) return prev;
        return [...prev, ...newItems];
      });
    }
    onChange(ids);
  };

  const handleRemove = (resourceId: number | string) => {
    if (disabled) return;
    onChange(value.filter(id => !idsEqual(id, resourceId)));
  };

  return (
    <div className={`w-full ${disabled ? 'opacity-50' : ''}`}>
      <label className="mb-2 block text-sm font-medium text-gray-900 dark:text-white">
        {label}
      </label>

      {/* Selected Resources Display */}
      {selectedResourcesList.length > 0 && (
        <div className="mb-3 space-y-2">
          {selectedResourcesList.map((resource: any) => (
            <div
              key={getObjId(resource)}
              className="flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 p-2.5 dark:border-gray-700 dark:bg-gray-700/50"
            >
              <div className="flex items-center gap-3 flex-1 min-w-0">
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
                  <div className="flex items-center gap-2 min-w-0">
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
                        <span>{getLearningResourceFileSize(resource)}</span>
                      )}
                      {getLearningResourceFileSize(resource) && resource.description && <span>•</span>}
                      {resource.description && (
                        <span className="truncate max-w-[200px]">{resource.description.replace(/<[^>]*>?/gm, '')}</span>
                      )}
                    </div>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={() => handleRemove(getObjId(resource))}
                disabled={disabled}
                className="ml-2 flex-shrink-0 p-1 rounded-full text-gray-400 hover:bg-gray-200 hover:text-red-600 dark:hover:bg-gray-600 dark:hover:text-red-400 transition-colors disabled:cursor-not-allowed"
              >
                <XMarkIcon className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Actions */}
      <button
        type="button"
        onClick={() => setShowPicker(true)}
        disabled={disabled}
        className="flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <PlusIcon className="h-4 w-4" />
        Chọn tài liệu
      </button>

      {error && (
        <p className="mt-1 text-sm text-red-600 dark:text-red-400">{error}</p>
      )}

      {/* Resource Picker Modal */}
      <LearningResourcePicker
        showModal={showPicker}
        onClose={() => setShowPicker(false)}
        onApply={handleApply}
        initialSelectedIds={value}
        initialResources={initialResources}
        disabled={disabled}
      />
    </div>
  );
}

