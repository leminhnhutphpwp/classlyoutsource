"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { MagnifyingGlassIcon, XMarkIcon } from "@heroicons/react/24/outline";
import { useStudents, useClasses, useAssignments } from "@/hooks/use-api";
import { useAuthContext } from "@/contexts/auth-context";
import RichTextDisplay from "@/components/Common/RichTextDisplay";
import Link from "next/link";
import { getObjId, idsEqual } from "@/lib/id-utils";

interface SearchResult {
  type: 'student' | 'class' | 'assignment';
  id: string | number;
  title: string;
  description?: string;
  url: string;
}

const TYPE_LABELS = {
  student: 'Học viên',
  class: 'Lớp học',
  assignment: 'Bài tập',
} as const;

const TYPE_COLORS = {
  student: 'bg-primary-pastel/40 text-primary',
  class: 'bg-primary-pastel text-primary',
  assignment: 'bg-primary-pastel/40 text-primary',
} as const;

interface SearchPopupProps {
  query: string;
  onClose: () => void;
  onQueryChange: (query: string) => void;
}

export function SearchPopup({ query, onClose, onQueryChange }: SearchPopupProps) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  const [debouncedQuery, setDebouncedQuery] = useState(query);
  const [selectedIndex, setSelectedIndex] = useState(-1);

  const { user } = useAuthContext();
  const isStudent = user?.role === 'student';

  const { data: studentsData, loading: studentsLoading, permissions: studentsPermissions, error: studentsError } = useStudents();
  const { data: classesData, loading: classesLoading, permissions: classesPermissions, error: classesError } = useClasses();
  const { data: assignmentsData, loading: assignmentsLoading, permissions: assignmentsPermissions, error: assignmentsError } = useAssignments();

  const isLoading = studentsLoading || classesLoading || assignmentsLoading;

  // Check permissions: 
  // - Students can always view their own data (isStudent = true)
  // - Tutors: if API returns error (FEATURE_NOT_AVAILABLE) or can_manage = false, block access
  // - If permissions is undefined or can_manage = true, allow access
  const canViewStudents = isStudent || (studentsData && studentsPermissions?.can_manage !== false && !studentsError);
  const canViewClasses = isStudent || (classesData && classesPermissions?.can_manage !== false && !classesError);
  const canViewAssignments = isStudent || (assignmentsData && assignmentsPermissions?.can_manage !== false && !assignmentsError);

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query);
      setSelectedIndex(-1); // Reset selection when query changes
    }, 300);

    return () => clearTimeout(timer);
  }, [query]);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Disable body scroll when popup is open
  useEffect(() => {
    // Disable scroll
    const previousBodyOverflow = document.body.style.overflow;
    const previousHtmlOverflow = document.documentElement.style.overflow;

    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';

    // Cleanup: Re-enable scroll when popup closes
    return () => {
      document.body.style.overflow = previousBodyOverflow || '';
      document.documentElement.style.overflow = previousHtmlOverflow || '';
    };
  }, []);

  // Calculate search results - only include types that user has permission to view
  const results = useMemo<SearchResult[]>(() => {
    if (!debouncedQuery.trim()) return [];

    const q = debouncedQuery.toLowerCase().trim();
    const allResults: SearchResult[] = [];

    // Only search students if user has permission
    if (canViewStudents && studentsData) {
      for (const student of studentsData) {
        const name = student.name?.toLowerCase() || '';
        const email = student.email?.toLowerCase() || '';
        const phone = student.phone || '';

        if (name.includes(q) || email.includes(q) || phone.includes(q)) {
          allResults.push({
            type: 'student',
            id: getObjId(student),
            title: student.name || 'Học viên không tên',
            description: student.email || student.phone || '',
            url: `/students/${getObjId(student)}`,
          });
        }
      }
    }

    // Only search classes if user has permission
    if (canViewClasses && classesData) {
      for (const classItem of classesData) {
        const name = classItem.name?.toLowerCase() || '';
        const description = classItem.description?.toLowerCase() || '';

        if (name.includes(q) || description.includes(q)) {
          allResults.push({
            type: 'class',
            id: getObjId(classItem),
            title: classItem.name || 'Lớp học không tên',
            description: classItem.description || '',
            url: `/classes/${getObjId(classItem)}`,
          });
        }
      }
    }

    // Only search assignments if user has permission
    if (canViewAssignments && assignmentsData) {
      for (const assignment of assignmentsData) {
        const title = assignment.title?.toLowerCase() || '';
        const description = assignment.description?.toLowerCase() || '';

        if (title.includes(q) || description.includes(q)) {
          allResults.push({
            type: 'assignment',
            id: getObjId(assignment),
            title: assignment.title || 'Bài tập không tên',
            description: assignment.description || assignment.class?.name || '',
            url: `/assignments/${getObjId(assignment)}`,
          });
        }
      }
    }

    return allResults.slice(0, 10); // Limit to 10 results
  }, [debouncedQuery, studentsData, classesData, assignmentsData, canViewStudents, canViewClasses, canViewAssignments]);

  // Group results by type
  const resultsByType = useMemo(() => {
    return {
      students: results.filter(r => r.type === 'student'),
      classes: results.filter(r => r.type === 'class'),
      assignments: results.filter(r => r.type === 'assignment'),
    };
  }, [results]);

  // Flatten results for keyboard navigation
  const flattenedResults = useMemo(() => {
    const flat: Array<SearchResult & { index: number }> = [];
    let index = 0;

    if (resultsByType.students.length > 0) {
      resultsByType.students.forEach(r => {
        flat.push({ ...r, index });
        index++;
      });
    }

    if (resultsByType.classes.length > 0) {
      resultsByType.classes.forEach(r => {
        flat.push({ ...r, index });
        index++;
      });
    }

    if (resultsByType.assignments.length > 0) {
      resultsByType.assignments.forEach(r => {
        flat.push({ ...r, index });
        index++;
      });
    }

    return flat;
  }, [resultsByType]);

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(prev => {
          const next = prev < flattenedResults.length - 1 ? prev + 1 : prev;
          // Scroll into view
          if (resultsRef.current && next >= 0) {
            const selectedElement = resultsRef.current.querySelector(
              `[data-index="${next}"]`
            ) as HTMLElement;
            selectedElement?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
          }
          return next;
        });
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(prev => {
          const next = prev > 0 ? prev - 1 : -1;
          // Scroll into view
          if (resultsRef.current && next >= 0) {
            const selectedElement = resultsRef.current.querySelector(
              `[data-index="${next}"]`
            ) as HTMLElement;
            selectedElement?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
          }
          return next;
        });
      } else if (e.key === 'Enter' && selectedIndex >= 0 && flattenedResults[selectedIndex]) {
        e.preventDefault();
        router.push(flattenedResults[selectedIndex].url);
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [flattenedResults, selectedIndex, router, onClose]);

  const handleResultClick = (url: string) => {
    router.push(url);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 px-4" data-search-popup>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Popup */}
      <div className="relative w-full max-w-2xl bg-white rounded-lg shadow-2xl dark:bg-gray-800 border border-gray-200 dark:border-gray-700" data-search-popup>
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-200 dark:border-gray-700">
          <MagnifyingGlassIcon className="h-5 w-5 text-gray-400 dark:text-gray-500" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder="Tìm kiếm học viên, lớp học, bài tập..."
            className="flex-1 outline-none bg-transparent text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500"
          />
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            aria-label="Đóng"
          >
            <XMarkIcon className="h-5 w-5 text-gray-400 dark:text-gray-500" />
          </button>
        </div>

        {/* Results */}
        <div
          ref={resultsRef}
          className="max-h-[60vh] overflow-y-auto"
        >
          {!debouncedQuery && (
            <div className="px-4 py-12 text-center">
              <MagnifyingGlassIcon className="mx-auto h-12 w-12 text-gray-400 dark:text-gray-500 mb-4" />
              <p className="text-gray-500 dark:text-gray-400">
                Nhập từ khóa để tìm kiếm học viên, lớp học, bài tập...
              </p>
            </div>
          )}

          {debouncedQuery && isLoading && (
            <div className="px-4 py-12 text-center">
              <div className="inline-block h-8 w-8 animate-spin rounded-full border-4" style={{ borderColor: 'var(--color-primary)', borderTopColor: 'transparent' }} />
              <p className="mt-4 text-gray-500 dark:text-gray-400">Đang tìm kiếm...</p>
            </div>
          )}

          {debouncedQuery && !isLoading && results.length === 0 && (
            <div className="px-4 py-12 text-center">
              <MagnifyingGlassIcon className="mx-auto h-12 w-12 text-gray-400 dark:text-gray-500 mb-4" />
              <p className="text-gray-500 dark:text-gray-400">
                Không tìm thấy kết quả cho &quot;{debouncedQuery}&quot;
              </p>
            </div>
          )}

          {debouncedQuery && !isLoading && results.length > 0 && (
            <div className="py-2">
              {resultsByType.students.length > 0 && (
                <div className="mb-2">
                  <div className="px-4 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">
                    {TYPE_LABELS.student} ({resultsByType.students.length})
                  </div>
                  {resultsByType.students.map((result) => {
                    const flatIndex = flattenedResults.findIndex(r => idsEqual(r.id, result.id) && r.type === result.type);
                    return (
                      <Link
                        key={`${result.type}-${result.id}`}
                        href={result.url}
                        data-index={flatIndex}
                        onClick={() => handleResultClick(result.url)}
                        className={`block px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors ${selectedIndex === flatIndex ? 'bg-gray-50 dark:bg-gray-700' : ''
                          }`}
                      >
                        <div className="flex items-start gap-3">
                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${TYPE_COLORS.student}`}>
                            {TYPE_LABELS.student}
                          </span>
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-gray-900 dark:text-white truncate">
                              {result.title}
                            </div>
                            {result.description && (
                              <div className="text-sm text-gray-500 dark:text-gray-400 truncate mt-0.5">
                                <RichTextDisplay content={result.description} />
                              </div>
                            )}
                          </div>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}

              {resultsByType.classes.length > 0 && (
                <div className="mb-2">
                  <div className="px-4 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">
                    {TYPE_LABELS.class} ({resultsByType.classes.length})
                  </div>
                  {resultsByType.classes.map((result) => {
                    const flatIndex = flattenedResults.findIndex(r => idsEqual(r.id, result.id) && r.type === result.type);
                    return (
                      <Link
                        key={`${result.type}-${result.id}`}
                        href={result.url}
                        data-index={flatIndex}
                        onClick={() => handleResultClick(result.url)}
                        className={`block px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors ${selectedIndex === flatIndex ? 'bg-gray-50 dark:bg-gray-700' : ''
                          }`}
                      >
                        <div className="flex items-start gap-3">
                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${TYPE_COLORS.class}`}>
                            {TYPE_LABELS.class}
                          </span>
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-gray-900 dark:text-white truncate">
                              {result.title}
                            </div>
                            {result.description && (
                              <div className="text-sm text-gray-500 dark:text-gray-400 truncate mt-0.5">
                                <RichTextDisplay content={result.description} />
                              </div>
                            )}
                          </div>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}

              {resultsByType.assignments.length > 0 && (
                <div className="mb-2">
                  <div className="px-4 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">
                    {TYPE_LABELS.assignment} ({resultsByType.assignments.length})
                  </div>
                  {resultsByType.assignments.map((result) => {
                    const flatIndex = flattenedResults.findIndex(r => idsEqual(r.id, result.id) && r.type === result.type);
                    return (
                      <Link
                        key={`${result.type}-${result.id}`}
                        href={result.url}
                        data-index={flatIndex}
                        onClick={() => handleResultClick(result.url)}
                        className={`block px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors ${selectedIndex === flatIndex ? 'bg-gray-50 dark:bg-gray-700' : ''
                          }`}
                      >
                        <div className="flex items-start gap-3">
                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${TYPE_COLORS.assignment}`}>
                            {TYPE_LABELS.assignment}
                          </span>
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-gray-900 dark:text-white truncate">
                              {result.title}
                            </div>
                            {result.description && (
                              <div className="text-sm text-gray-500 dark:text-gray-400 truncate mt-0.5">
                                <RichTextDisplay content={result.description} />
                              </div>
                            )}
                          </div>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}

            </div>
          )}
        </div>
      </div>
    </div>
  );
}

