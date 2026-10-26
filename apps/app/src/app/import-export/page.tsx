"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/Common/Button";
import ButtonLink from "@/components/Common/ButtonLink";
import { apiClient } from "@/lib/api-client";
import { useToast } from "@/contexts/toast-context";
import { useAuthContext } from "@/contexts/auth-context";
import { useLockContext } from "@/contexts/lock-context";
import { ArrowLeftIcon, ArrowRightIcon, DocumentArrowUpIcon, DocumentArrowDownIcon, CheckCircleIcon, ExclamationTriangleIcon } from "@heroicons/react/24/outline";
import ProtectedRoute from "@/components/Auth/ProtectedRoute";
import SelectInput from "@/components/FormElements/SelectInput";
import DateRangePicker from "@/components/FormElements/DateRangePicker";
import { Switch } from "@/components/FormElements/switch";
import { canImportType, canExportType, canImportData, canExportData } from "@/lib/import-export-permissions";
import SampleDataBox from "@/components/ImportExport/SampleDataBox";
import { useClasses, useDataJobs } from "@/hooks/use-api";
import Pagination from "@/components/Common/Pagination";
import { Tabs, TabPanel } from "@/components/Common/Tabs";
import FileUpload from "@/components/FormElements/FileUpload";
import { getObjId } from "@/lib/id-utils";
import { useFaviconProgress } from "@/hooks/use-favicon-progress";
import { useFakeProgress } from "@/hooks/use-fake-progress";
import ZaloDownloadNotice from "@/components/Common/ZaloDownloadNotice";
import { useErrorDisplay } from "@/components/Common/ErrorDisplay";

type ImportType =
  | 'students'
  | 'enrollments'
  | 'attendance'
  | 'grades'
  | 'payments'
  | 'assignment-types'
  | 'subjects'
  | 'grade-levels'
  | 'grade-types';
type ExportType =
  | 'students'
  | 'attendance'
  | 'grades'
  | 'payments'
  | 'revenue'
  | 'payment-requests'
  | 'classes'
  | 'assignments'
  | 'login-activities'
  | 'assignment-types'
  | 'subjects'
  | 'grade-levels'
  | 'grade-types';
type OperationType = 'import' | 'export';

interface ImportResult {
  total_rows?: number;
  total?: number;
  success?: number;
  created?: number;
  updated?: number;
  failed: number;
  skipped: number;
  errors?: Array<{
    row?: number;
    index?: number;
    data?: Record<string, any>;
    errors?: string[];
    error?: string;
    message?: string;
  }>;
}

export default function ImportExportPage() {
  const router = useRouter();
  const { addToast } = useToast();
  const { user, loading: authLoading } = useAuthContext();
  const { actionsLocked, planFeatureMessage } = useLockContext();
  const { renderError } = useErrorDisplay("Xuất/Nhập dữ liệu");

  // Fetch classes list for filter dropdown
  const { data: classesData } = useClasses(undefined, !actionsLocked);
  const classesList = Array.isArray(classesData) ? classesData : [];

  // Tab management
  const [activeTab, setActiveTab] = useState<'import-export' | 'history'>('import-export');

  // Step management
  const [currentStep, setCurrentStep] = useState(1);
  const [operationType, setOperationType] = useState<OperationType | null>(null);
  const [importType, setImportType] = useState<ImportType | null>(null);
  const [exportType, setExportType] = useState<ExportType | null>(null);

  // History filters
  const [historyFilters, setHistoryFilters] = useState<{
    type?: 'import' | 'export';
    status?: 'processing' | 'success' | 'partial' | 'failed';
    module?: string;
    date_from?: string;
    date_to?: string;
    page?: number;
    per_page?: number;
  }>({
    page: 1,
    per_page: 20,
  });

  // Fetch history (only when not locked)
  const shouldFetchHistory = !actionsLocked && !planFeatureMessage;
  const { jobs: historyJobs, loading: historyLoading, meta: historyMeta, error: historyError } = useDataJobs(
    historyFilters,
    { enabled: shouldFetchHistory }
  );

  // Step 2: Config
  const [file, setFile] = useState<File | null>(null);
  const [skipDuplicates, setSkipDuplicates] = useState(true);
  const [overrideExisting, setOverrideExisting] = useState(false);
  const [exportFormat, setExportFormat] = useState<'excel' | 'csv'>('excel');
  const [exportDateRange, setExportDateRange] = useState<{ start: string; end: string } | null>(null);

  // Additional filters for report exports (similar to reports page)
  const [exportStatus, setExportStatus] = useState<string>('all');
  const [exportPaymentMethod, setExportPaymentMethod] = useState<string>('all');
  const [exportClassId, setExportClassId] = useState<string>('all');

  // Step 3: Preview (for import)
  const [previewData, setPreviewData] = useState<any[]>([]);
  const [previewErrors, setPreviewErrors] = useState<string[]>([]);

  // Step 4: Processing & Results
  const [processing, setProcessing] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [exportSuccess, setExportSuccess] = useState(false);

  // Favicon Progress Logic
  const fakeProgress = useFakeProgress(processing);
  useFaviconProgress(fakeProgress ?? 0);

  // Define import/export types first (static — memoized so identity is stable
  // across renders, keeping the useCallback/useMemo deps below reliable)
  const importTypes: { value: ImportType; label: string; description: string }[] = useMemo(() => [
    { value: 'students', label: 'Học viên', description: 'Nhập danh sách học viên từ file CSV/Excel' },
    { value: 'enrollments', label: 'Ghi danh', description: 'Ghi danh học viên vào lớp học từ file' },
    { value: 'attendance', label: 'Điểm danh', description: 'Nhập điểm danh từ file' },
    { value: 'grades', label: 'Điểm số', description: 'Nhập điểm từ file' },
    { value: 'payments', label: 'Thanh toán', description: 'Nhập thanh toán từ file' },
    { value: 'assignment-types', label: 'Loại bài tập', description: 'Nhập danh sách loại bài tập từ file CSV/Excel' },
    { value: 'subjects', label: 'Môn học', description: 'Nhập danh sách môn học từ file CSV/Excel' },
    { value: 'grade-levels', label: 'Cấp độ/Khối', description: 'Nhập danh sách cấp độ/khối từ file CSV/Excel' },
    { value: 'grade-types', label: 'Loại điểm', description: 'Nhập danh sách loại điểm từ file CSV/Excel' },
  ], []);

  const exportTypes: { value: ExportType; label: string; description: string; category: string }[] = useMemo(() => [
    { value: 'students', label: 'Học viên', description: 'Xuất danh sách học viên (DATA)', category: 'Dữ liệu cơ bản' },
    { value: 'assignment-types', label: 'Loại bài tập', description: 'Xuất danh sách loại bài tập', category: 'Dữ liệu cơ bản' },
    { value: 'subjects', label: 'Môn học', description: 'Xuất danh sách môn học', category: 'Dữ liệu cơ bản' },
    { value: 'grade-levels', label: 'Cấp độ/Khối', description: 'Xuất danh sách cấp độ/khối', category: 'Dữ liệu cơ bản' },
    { value: 'grade-types', label: 'Loại điểm', description: 'Xuất danh sách loại điểm', category: 'Dữ liệu cơ bản' },
    { value: 'attendance', label: 'Điểm danh', description: 'Xuất báo cáo điểm danh', category: 'Báo cáo' },
    { value: 'grades', label: 'Điểm số', description: 'Xuất báo cáo điểm số', category: 'Báo cáo' },
    { value: 'payments', label: 'Thanh toán', description: 'Xuất báo cáo thanh toán', category: 'Báo cáo' },
    { value: 'revenue', label: 'Doanh thu', description: 'Xuất báo cáo doanh thu', category: 'Báo cáo' },
    { value: 'payment-requests', label: 'Yêu cầu thanh toán', description: 'Xuất báo cáo yêu cầu thanh toán', category: 'Báo cáo' },
    { value: 'classes', label: 'Lớp học', description: 'Xuất báo cáo lớp học', category: 'Báo cáo' },
    { value: 'assignments', label: 'Bài tập', description: 'Xuất báo cáo bài tập', category: 'Báo cáo' },
    { value: 'login-activities', label: 'Nhật ký đăng nhập', description: 'Xuất nhật ký đăng nhập', category: 'Báo cáo' },
  ], []);

  // Filter import/export types based on permissions
  // Only calculate after user is loaded
  const canImport = useMemo(() => {
    if (!user) return false;
    return canImportData(user);
  }, [user]);

  const canExport = useMemo(() => {
    if (!user) return false;
    return canExportData(user);
  }, [user]);

  const availableImportTypes = useMemo(() => {
    if (!user) return [];
    return importTypes.filter(type => canImportType(user, type.value));
  }, [user, importTypes]);

  const availableExportTypes = useMemo(() => {
    if (!user) return [];
    return exportTypes.filter(type => canExportType(user, type.value));
  }, [user, exportTypes]);

  const handleFileSelection = (selectedFile: File | null) => {
    if (selectedFile) {
      const validExtensions = ['.csv', '.xlsx', '.xls'];
      const fileExtension = selectedFile.name.substring(selectedFile.name.lastIndexOf('.')).toLowerCase();

      // 1. Extension Validation
      if (!validExtensions.includes(fileExtension)) {
        addToast({ type: 'error', title: 'File không hợp lệ', message: 'Vui lòng chọn file CSV hoặc Excel (.csv, .xlsx, .xls)' });
        return;
      }

      // 2. MIME Type Validation (Security Optimization)
      // Note: Some systems may not have correct MIME mapping, so we allow empty type but warn if explicitly wrong
      const validMimeTypes = [
        'text/csv',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/csv',
        'text/plain', // CSV often comes as text/plain
        '' // Allow empty if browser can't detect
      ];

      if (selectedFile.type && !validMimeTypes.some(type => selectedFile.type.startsWith(type))) {
        console.warn("MIME type suspicious:", selectedFile.type);
        // Optional: strict mode would return here. For now we rely on extension + backend check.
      }

      setFile(selectedFile);
      // Removed eager parsing (parseCSVPreview) to save resources. Validation happens on "Next".
      setPreviewErrors([]);
      setPreviewData([]);
    } else {
      setFile(null);
      setPreviewData([]);
      setPreviewErrors([]);
    }
  };

  // Helper to parse CSV line respecting quotes "Value, with comma"
  const parseCSVLine = (text: string): string[] => {
    const result: string[] = [];
    let startValueIndex = 0;
    let inQuotes = false;

    for (let i = 0; i < text.length; i++) {
      if (text[i] === '"') {
        inQuotes = !inQuotes;
      } else if (text[i] === ',' && !inQuotes) {
        let val = text.substring(startValueIndex, i).trim();
        // Remove wrapping quotes and unescape double quotes
        if (val.startsWith('"') && val.endsWith('"')) {
          val = val.slice(1, -1).replace(/""/g, '"');
        }
        result.push(val);
        startValueIndex = i + 1;
      }
    }
    // Push last value
    let lastVal = text.substring(startValueIndex).trim();
    if (lastVal.startsWith('"') && lastVal.endsWith('"')) {
      lastVal = lastVal.slice(1, -1).replace(/""/g, '"');
    }
    result.push(lastVal);

    return result;
  };

  const handleStep1Next = () => {
    if (!operationType) {
      addToast({ type: 'error', title: 'Vui lòng chọn loại thao tác' });
      return;
    }

    if (operationType === 'import' && !importType) {
      addToast({ type: 'error', title: 'Vui lòng chọn loại dữ liệu cần import' });
      return;
    }

    if (operationType === 'export' && !exportType) {
      addToast({ type: 'error', title: 'Vui lòng chọn loại dữ liệu cần export' });
      return;
    }

    setCurrentStep(2);
  };

  // Validation state
  const [checking, setChecking] = useState(false);

  // Required headers configuration
  const REQUIRED_HEADERS: Record<ImportType, string[]> = {
    'students': ['name', 'email'],
    'enrollments': ['student_email', 'class_code'],
    'attendance': ['student_email', 'date', 'status'],
    'grades': ['student_email', 'grade_type', 'score'],
    'payments': ['student_email', 'amount', 'method'],
    'assignment-types': ['name'],
    'subjects': ['name', 'code'],
    'grade-levels': ['name', 'code'],
    'grade-types': ['name', 'weight'],
  };

  const handleStep2Next = async () => {
    if (operationType === 'import') {
      if (!file) {
        addToast({ type: 'error', title: 'Vui lòng chọn file để import' });
        return;
      }

      // Start checking
      setChecking(true);

      // Simulate checking delay for better UX (as requested)
      await new Promise(resolve => setTimeout(resolve, 800));

      // Validate file structure
      await validateFileStructure(file);

      setChecking(false);
      // Always move to step 3 to result of validation (either preview data or errors)
      setCurrentStep(3);
    } else {
      // For export, move to preview step
      setCurrentStep(3);
    }
  };

  const validateFileStructure = async (file: File): Promise<boolean> => {
    if (!importType) return false;

    try {
      // PERF OPTIMIZATION: Read only first 50KB for preview/validation
      // This prevents browser freeze when user selects a 100MB file
      const CHUNK_SIZE = 50 * 1024;
      const chunk = file.slice(0, CHUNK_SIZE);
      const text = await chunk.text();

      // Remove BOM if present
      const cleanText = text.charCodeAt(0) === 0xFEFF ? text.substring(1) : text;

      // Split lines but be careful of cutoff at the end of chunk
      const lines = cleanText.split('\n').filter(line => line.trim());

      // If we read a partial chunk, drop the last line as it might be incomplete
      if (file.size > CHUNK_SIZE) {
        lines.pop();
      }

      if (lines.length === 0) {
        setPreviewErrors(['File trống không có dữ liệu']);
        return false;
      }

      // Robust CSV Parsing
      const headers = parseCSVLine(lines[0]);
      const requiredHelpers = REQUIRED_HEADERS[importType] || [];
      const missingHeaders = requiredHelpers.filter(h => !headers.includes(h));

      if (missingHeaders.length > 0) {
        setPreviewErrors([
          `File thiếu các cột bắt buộc: ${missingHeaders.join(', ')}`,
          `Các cột hiện có: ${headers.join(', ')}`,
          `Vui lòng kiểm tra lại file mẫu và thử lại.`
        ]);
        return false;
      }

      // Parse sample rows
      const rows = lines.slice(1, Math.min(6, lines.length)).map(line => {
        const values = parseCSVLine(line);
        const row: Record<string, string> = {};
        headers.forEach((header, index) => {
          row[header] = values[index] || '';
        });
        return row;
      });

      setPreviewData(rows);
      setPreviewErrors([]);

      return true;
    } catch (error) {
      console.error(error);
      setPreviewErrors(['Lỗi khi đọc file. Vui lòng đảm bảo file đúng định dạng CSV/Excel.']);
      return false;
    }
  };

  const handleStep3Next = async () => {
    setCurrentStep(4);
    if (operationType === 'import') {
      await handleImport();
    } else {
      await handleExport();
    }
  };

  const handleImport = async () => {
    if (!file || !importType) return;

    setProcessing(true);
    setImportResult(null);

    try {
      const options: any = {};
      if (importType === 'students' || importType === 'enrollments') {
        options.skip_duplicates = skipDuplicates;
      }
      if (importType === 'attendance' || importType === 'grades' || importType === 'payments') {
        options.override_existing = overrideExisting;
      }

      const response = await apiClient.importData(importType, file, options);

      // Handle permission errors
      if (response.code === 'UNAUTHORIZED' || response.code === 'FORBIDDEN') {
        addToast({ type: 'error', title: response.message || 'Bạn không có quyền thực hiện thao tác này.' });
        return;
      }

      if (response.success && response.data) {
        setImportResult(response.data as ImportResult);
        const result = response.data as ImportResult;

        if (result.failed === 0 && result.skipped === 0) {
          addToast({ type: 'success', title: `Import thành công ${result.success} bản ghi` });
        } else {
          addToast({ type: 'warning', title: 'Import hoàn tất', message: `${result.success} thành công, ${result.failed} thất bại, ${result.skipped} bỏ qua` });
        }
      } else {
        addToast({ type: 'error', title: response.message || 'Import thất bại' });
      }
    } catch (error: any) {
      addToast({ type: 'error', title: error.message || 'Có lỗi xảy ra khi import' });
    } finally {
      setProcessing(false);
    }
  };

  // Map payment method from frontend format to backend format (similar to reports page)
  const mapPaymentMethod = useCallback((method: string): string => {
    if (method === "all") return "all";
    // Map bank_transfer to bank for Payment model (enum), but keep as is for Invoice (nullable string)
    // For revenue export (Invoice), keep as is since Invoice has nullable string
    // For payments export (Payment), map bank_transfer to bank
    return method === "bank_transfer" ? "bank" : method;
  }, []);

  // Helper function to get module label from backend module name
  const getModuleLabel = useCallback((module: string) => {
    // Map backend module names to display labels
    const moduleMap: Record<string, string> = {
      'students': 'Học viên',
      'students-data': 'Học viên',
      'enrollments': 'Ghi danh',
      'attendance': 'Điểm danh',
      'grades': 'Điểm số',
      'payments': 'Thanh toán',
      'assignment-types': 'Loại bài tập',
      'assignment-types-data': 'Loại bài tập',
      'subjects': 'Môn học',
      'subjects-data': 'Môn học',
      'grade-levels': 'Cấp độ/Khối',
      'grade-levels-data': 'Cấp độ/Khối',
      'grade-types': 'Loại điểm',
      'grade-types-data': 'Loại điểm',
      'revenue': 'Doanh thu',
      'payment-requests': 'Yêu cầu thanh toán',
      'classes': 'Lớp học',
      'assignments': 'Bài tập',
      'login-activities': 'Nhật ký đăng nhập',
      'settings': 'Cài đặt',
      'email-templates': 'Mẫu email',
    };

    // Try exact match first
    if (moduleMap[module]) {
      return moduleMap[module];
    }

    // Try to find in exportTypes or importTypes
    const exportType = exportTypes.find(t => t.value === module);
    if (exportType) return exportType.label;

    const importType = importTypes.find(t => t.value === module);
    if (importType) return importType.label;

    // Remove -data suffix and try again
    const moduleWithoutSuffix = module.replace(/-data$/, '');
    if (moduleMap[moduleWithoutSuffix]) {
      return moduleMap[moduleWithoutSuffix];
    }

    // Fallback: format module name
    return module.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  }, [exportTypes, importTypes]);

  // Helper function to get status options based on export type
  const getStatusOptions = useCallback(() => {
    const baseOptions = [{ value: 'all', label: 'Tất cả' }];

    if (exportType === 'payments') {
      return [
        ...baseOptions,
        { value: 'paid', label: 'Đã thanh toán' },
        { value: 'pending', label: 'Chờ thanh toán' },
        { value: 'failed', label: 'Thất bại' },
        { value: 'refunded', label: 'Đã hoàn tiền' },
      ];
    }

    if (exportType === 'students') {
      return [
        ...baseOptions,
        { value: 'active', label: 'Đang học' },
        { value: 'inactive', label: 'Đang nghỉ' },
        { value: 'graduated', label: 'Đã tốt nghiệp' },
      ];
    }

    if (exportType === 'classes') {
      return [
        ...baseOptions,
        { value: 'active', label: 'Đang dạy' },
        { value: 'inactive', label: 'Tạm dừng' },
        { value: 'completed', label: 'Đã hoàn thành' },
      ];
    }

    if (exportType === 'assignments') {
      return [
        ...baseOptions,
        { value: 'published', label: 'Đang giao' },
        { value: 'draft', label: 'Sắp giao' },
        { value: 'closed', label: 'Đã kết thúc' },
      ];
    }

    return baseOptions;
  }, [exportType]);

  // Helper function to build export filters based on export type (similar to reports page)
  const buildExportFilters = useCallback(() => {
    const baseFilters: Record<string, any> = {};

    // Add date filters if present
    if (exportDateRange && exportDateRange.start && exportDateRange.end) {
      baseFilters.date_from = exportDateRange.start;
      baseFilters.date_to = exportDateRange.end;
    }

    // Add filters based on export type
    switch (exportType) {
      case 'revenue':
        if (exportPaymentMethod !== "all") {
          baseFilters.payment_method = exportPaymentMethod;
        }
        return baseFilters;
      case 'payments':
        if (exportPaymentMethod !== "all") {
          baseFilters.payment_method = mapPaymentMethod(exportPaymentMethod);
        }
        if (exportStatus !== "all") {
          baseFilters.status = exportStatus;
        }
        return baseFilters;
      case 'attendance':
        if (exportClassId !== "all") {
          baseFilters.class_id = exportClassId;
        }
        return baseFilters;
      case 'students':
        if (exportStatus !== "all") {
          baseFilters.status = exportStatus;
        }
        if (exportClassId !== "all") {
          baseFilters.class_id = exportClassId;
        }
        return baseFilters;
      case 'classes':
        if (exportStatus !== "all") {
          baseFilters.status = exportStatus;
        }
        return baseFilters;
      case 'assignments':
        if (exportStatus !== "all") {
          baseFilters.status = exportStatus;
        }
        if (exportClassId !== "all") {
          baseFilters.class_id = exportClassId;
        }
        return baseFilters;
      default:
        return baseFilters;
    }
  }, [exportType, exportDateRange, exportStatus, exportPaymentMethod, exportClassId, mapPaymentMethod]);

  const handleExport = async () => {
    if (!exportType) return;

    setProcessing(true);
    setExportSuccess(false);

    try {
      const filters = buildExportFilters();
      const { blob, actualFormat } = await apiClient.exportData(exportType, exportFormat, filters);

      // Use safe download that works in Zalo and other mobile apps
      const { safeDownload } = await import('@/lib/zalo-utils');
      const fileName = `${exportType}-${new Date().toISOString().split('T')[0]}.${actualFormat === 'excel' ? 'xlsx' : 'csv'}`;
      safeDownload(blob, fileName);

      setExportSuccess(true);
      addToast({ type: 'success', title: 'Export thành công' });
    } catch (error: any) {
      addToast({ type: 'error', title: error.message || 'Có lỗi xảy ra khi export' });
    } finally {
      setProcessing(false);
    }
  };

  const handleReset = () => {
    setCurrentStep(1);
    setOperationType(null);
    setImportType(null);
    setExportType(null);
    setFile(null);
    setSkipDuplicates(true);
    setOverrideExisting(false);
    setExportFormat('excel');
    setExportDateRange(null);
    setExportStatus('all');
    setExportPaymentMethod('all');
    setExportClassId('all');
    setPreviewData([]);
    setPreviewErrors([]);
    setImportResult(null);
    setExportSuccess(false);
  };

  // Check if user has any import/export permissions
  // Only check after user is loaded
  const hasAnyPermission = useMemo(() => {
    if (!user) return false; // Wait for user to load
    return canImport || canExport;
  }, [user, canImport, canExport]);

  // Chặn truy cập trực tiếp: user không có quyền import/export nào → đá về dashboard.
  // (Menu đã ẩn mục này, đây là lớp bảo vệ khi gõ URL thẳng.)
  useEffect(() => {
    if (!authLoading && user && !hasAnyPermission) {
      router.replace("/dashboard");
    }
  }, [authLoading, user, hasAnyPermission, router]);

  // Show loading while auth is loading
  if (authLoading || !user) {
    return (
      <ProtectedRoute>
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-4" style={{ borderColor: 'var(--color-primary)', borderTopColor: 'transparent' }}></div>
        </div>
      </ProtectedRoute>
    );
  }

  // Không có quyền → đang redirect về dashboard (useEffect ở trên). Hiện spinner
  // trong lúc chờ điều hướng, tránh render trang trắng.
  if (!hasAnyPermission) {
    return (
      <ProtectedRoute>
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-4" style={{ borderColor: 'var(--color-primary)', borderTopColor: 'transparent' }}></div>
        </div>
      </ProtectedRoute>
    );
  }

  // Kiểm tra lock trước để ưu tiên hiển thị lock content
  if (actionsLocked || planFeatureMessage) {
    return (
      <ProtectedRoute>
        {renderError()}
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute>
      <div className="space-y-6">
        {/* Zalo Download Notice */}
        <ZaloDownloadNotice />

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex-1 min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white truncate">Xuất/Nhập dữ liệu</h1>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400 break-words">
              Xuất hoặc nhập dữ liệu từ hệ thống bằng file CSV/Excel
            </p>
          </div>
          <ButtonLink href="/dashboard" variant="outline" size="sm" icon={<ArrowLeftIcon className="h-5 w-5" />} className="hidden sm:flex">
            Quay lại
          </ButtonLink>
        </div>

        {/* Tabs */}
        <Tabs
          tabs={[
            { id: 'import-export', label: 'Xuất/Nhập dữ liệu' },
            { id: 'history', label: 'Lịch sử' },
          ]}
          activeTab={activeTab}
          onChange={(tabId) => setActiveTab(tabId as 'import-export' | 'history')}
        />

        {/* Import/Export Content */}
        <TabPanel activeTab={activeTab} tabId="import-export">
          <>
            {/* Progress Steps */}
            <div className="flex items-center justify-between overflow-x-auto pt-4 pb-2 px-1">
              {[1, 2, 3, 4].map((step) => (
                <div key={step} className="flex items-center flex-1 min-w-0">
                  <div className="flex flex-col items-center flex-1 min-w-0">
                    <div
                      className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center font-semibold flex-shrink-0 ${step < currentStep
                        ? 'bg-primary text-white'
                        : step === currentStep
                          ? 'bg-primary text-white'
                          : 'bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
                        }`}
                    >
                      {step < currentStep ? (
                        <CheckCircleIcon className="h-4 w-4 sm:h-6 sm:w-6" />
                      ) : (
                        <span className="text-xs sm:text-base">{step}</span>
                      )}
                    </div>
                    <span className={`mt-1 sm:mt-2 text-[10px] sm:text-xs font-medium text-center px-0.5 ${step <= currentStep ? 'text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400'
                      }`}>
                      {step === 1 && 'Chọn loại'}
                      {step === 2 && 'Cấu hình'}
                      {step === 3 && 'Xem trước'}
                      {step === 4 && 'Kết quả'}
                    </span>
                  </div>
                  {step < 4 && (
                    <div className={`flex-1 h-0.5 mx-1 sm:mx-2 min-w-[8px] ${step < currentStep ? 'bg-primary' : 'bg-gray-200 dark:bg-gray-700'
                      }`} />
                  )}
                </div>
              ))}
            </div>

            {/* Step Content */}
            <div className="rounded-lg bg-white p-4 sm:p-6 dark:bg-gray-800">
              {/* Step 1: Choose Type */}
              {currentStep === 1 && (
                <div className="space-y-6">
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                      Chọn loại thao tác
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                      <button
                        onClick={() => canImport && setOperationType('import')}
                        disabled={!canImport}
                        className={`p-6 rounded-lg border-2 text-left transition-all ${!canImport
                          ? 'border-gray-200 bg-gray-50 opacity-50 cursor-not-allowed dark:border-gray-700 dark:bg-gray-800'
                          : operationType === 'import'
                            ? 'border-primary bg-primary-pastel dark:bg-primary/10'
                            : 'border-gray-200 hover:border-gray-300 dark:border-gray-700 dark:hover:border-gray-600'
                          }`}
                      >
                        <DocumentArrowUpIcon className={`h-8 w-8 mb-2 ${operationType === 'import' ? 'text-primary' : 'text-gray-400'
                          }`} />
                        <h3 className="font-semibold text-gray-900 dark:text-white mb-1">Nhập dữ liệu</h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          Nhập dữ liệu từ file CSV/Excel vào hệ thống
                        </p>
                      </button>
                      <button
                        onClick={() => canExport && setOperationType('export')}
                        disabled={!canExport}
                        className={`p-6 rounded-lg border-2 text-left transition-all ${!canExport
                          ? 'border-gray-200 bg-gray-50 opacity-50 cursor-not-allowed dark:border-gray-700 dark:bg-gray-800'
                          : operationType === 'export'
                            ? 'border-primary bg-primary-pastel dark:bg-primary/10'
                            : 'border-gray-200 hover:border-gray-300 dark:border-gray-700 dark:hover:border-gray-600'
                          }`}
                      >
                        <DocumentArrowDownIcon className={`h-8 w-8 mb-2 ${operationType === 'export' ? 'text-primary' : 'text-gray-400'
                          }`} />
                        <h3 className="font-semibold text-gray-900 dark:text-white mb-1">Xuất dữ liệu</h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          Xuất dữ liệu từ hệ thống ra file CSV/Excel
                        </p>
                      </button>
                    </div>
                  </div>

                  {operationType === 'import' && (
                    <div>
                      <h3 className="text-md font-semibold text-gray-900 dark:text-white mb-3">
                        Chọn loại dữ liệu cần nhập
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {availableImportTypes.length === 0 ? (
                          <div className="col-span-2 p-4 rounded-lg border border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800 text-center text-sm text-gray-500 dark:text-gray-400">
                            Bạn không có quyền nhập bất kỳ loại dữ liệu nào
                          </div>
                        ) : (
                          availableImportTypes.map((type) => (
                            <button
                              key={type.value}
                              onClick={() => setImportType(type.value)}
                              className={`p-4 rounded-lg border text-left transition-all ${importType === type.value
                                ? 'border-primary bg-primary-pastel dark:bg-primary/10'
                                : 'border-gray-200 hover:border-gray-300 dark:border-gray-700 dark:hover:border-gray-600'
                                }`}
                            >
                              <h4 className="font-medium text-gray-900 dark:text-white">{type.label}</h4>
                              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{type.description}</p>
                            </button>
                          ))
                        )}
                      </div>

                      {/* Sample Data Box - Hiển thị khi đã chọn loại import */}
                      {importType && (
                        <div className="mt-4">
                          <SampleDataBox importType={importType} />
                        </div>
                      )}
                    </div>
                  )}

                  {operationType === 'export' && (
                    <div>
                      <h3 className="text-md font-semibold text-gray-900 dark:text-white mb-3">
                        Chọn loại dữ liệu cần xuất
                      </h3>
                      <div className="space-y-4">
                        {['Dữ liệu cơ bản', 'Báo cáo'].map((category) => (
                          <div key={category}>
                            <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{category}</h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                              {availableExportTypes
                                .filter((type) => type.category === category)
                                .map((type) => (
                                  <button
                                    key={type.value}
                                    onClick={() => setExportType(type.value)}
                                    className={`p-4 rounded-lg border text-left transition-all ${exportType === type.value
                                      ? 'border-primary bg-primary-pastel dark:bg-primary/10'
                                      : 'border-gray-200 hover:border-gray-300 dark:border-gray-700 dark:hover:border-gray-600'
                                      }`}
                                  >
                                    <h4 className="font-medium text-gray-900 dark:text-white">{type.label}</h4>
                                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{type.description}</p>
                                  </button>
                                ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="flex justify-end">
                    <Button size="sm" onClick={handleStep1Next} disabled={!operationType || (operationType === 'import' && !importType) || (operationType === 'export' && !exportType)} className="w-full sm:w-auto">
                      Tiếp theo
                      <ArrowRightIcon className="h-5 w-5" />
                    </Button>
                  </div>
                </div>
              )}

              {/* Step 2: Config */}
              {currentStep === 2 && (
                <div className="space-y-6">
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                    Cấu hình {operationType === 'import' ? 'Nhập dữ liệu' : 'Xuất dữ liệu'}
                  </h2>

                  {operationType === 'import' && (
                    <div className="space-y-4">
                      <FileUpload
                        label="Chọn file"
                        required
                        accept=".csv,.xlsx,.xls"
                        value={file}
                        onChange={handleFileSelection}
                        helperText="Chọn file CSV hoặc Excel (.csv, .xlsx, .xls)"
                      />

                      {(importType === 'students' || importType === 'enrollments') && (
                        <Switch
                          label="Bỏ qua các bản ghi trùng lặp"
                          name="skipDuplicates"
                          checked={skipDuplicates}
                          onChange={(e) => setSkipDuplicates(e.target.checked)}
                        />
                      )}

                      {(importType === 'attendance' || importType === 'grades' || importType === 'payments') && (
                        <div className="flex items-center">
                          <input
                            type="checkbox"
                            id="overrideExisting"
                            checked={overrideExisting}
                            onChange={(e) => setOverrideExisting(e.target.checked)}
                            className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                          />
                          <label htmlFor="overrideExisting" className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                            Ghi đè dữ liệu đã tồn tại
                          </label>
                        </div>
                      )}
                    </div>
                  )}

                  {operationType === 'export' && (
                    <div className="space-y-4">
                      <div>
                        <SelectInput
                          label="Định dạng file"
                          name="format"
                          value={exportFormat}
                          handleChange={(e) => setExportFormat(e.target.value as 'excel' | 'csv')}
                          options={[
                            { value: 'excel', label: 'Excel (.xlsx)' },
                            { value: 'csv', label: 'CSV (.csv)' },
                          ]}
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Khoảng thời gian (tùy chọn)
                        </label>
                        <DateRangePicker
                          value={exportDateRange || undefined}
                          onChange={(range) => setExportDateRange(range)}
                          placeholder="Chọn khoảng thời gian"
                        />
                      </div>

                      {/* Additional filters for report exports */}
                      {(exportType === 'revenue' || exportType === 'payments' ||
                        exportType === 'attendance' || exportType === 'students' || exportType === 'classes' ||
                        exportType === 'assignments') && (
                          <>
                            {/* Status Filter - For Payments, Students, Classes, Assignments */}
                            {(exportType === 'payments' || exportType === 'students' || exportType === 'classes' || exportType === 'assignments') && (
                              <SelectInput
                                label="Trạng thái"
                                name="exportStatus"
                                value={exportStatus}
                                handleChange={(e) => setExportStatus(e.target.value)}
                                options={getStatusOptions()}
                              />
                            )}

                            {/* Payment Method Filter - For Revenue and Payments */}
                            {(exportType === 'revenue' || exportType === 'payments') && (
                              <SelectInput
                                label="Phương thức thanh toán"
                                name="exportPaymentMethod"
                                value={exportPaymentMethod}
                                handleChange={(e) => setExportPaymentMethod(e.target.value)}
                                options={[
                                  { value: 'all', label: 'Tất cả' },
                                  { value: 'bank_transfer', label: 'Chuyển khoản' },
                                  { value: 'cash', label: 'Tiền mặt' },
                                  { value: 'other', label: 'Khác' },
                                ]}
                              />
                            )}

                            {/* Class Filter - For Attendance, Students, Assignments */}
                            {(exportType === 'attendance' || exportType === 'students' || exportType === 'assignments') && (
                              <SelectInput
                                label="Lớp học"
                                name="exportClassId"
                                value={exportClassId}
                                handleChange={(e) => setExportClassId(e.target.value)}
                                options={[
                                  { value: 'all', label: 'Tất cả lớp' },
                                  ...classesList.map((classItem: any) => {
                                    const className = classItem.name || classItem.class_name || `Lớp ${getObjId(classItem)}`;
                                    return {
                                      value: getObjId(classItem),
                                      label: className,
                                    };
                                  }),
                                ]}
                              />
                            )}
                          </>
                        )}
                    </div>
                  )}

                  <div className="flex flex-col sm:flex-row justify-between gap-3">
                    <Button variant="outline" size="sm" onClick={() => setCurrentStep(1)} className="w-full sm:w-auto justify-center">
                      <ArrowLeftIcon className="h-5 w-5" />
                      Quay lại
                    </Button>
                    <Button
                      size="sm"
                      onClick={handleStep2Next}
                      disabled={operationType === 'import' && !file}
                      loading={checking}
                      className="w-full sm:w-auto"
                    >
                      {operationType === 'import' ? 'Kiểm tra dữ liệu' : 'Tiếp theo'}
                      <ArrowRightIcon className="h-5 w-5" />
                    </Button>
                  </div>
                </div>
              )}

              {/* Step 3: Preview */}
              {currentStep === 3 && operationType === 'import' && (
                <div className="space-y-6">
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                    Xem trước dữ liệu
                  </h2>

                  {previewErrors.length > 0 ? (
                    <div className="rounded-lg bg-red-50 dark:bg-red-900/20 p-4 border border-red-200 dark:border-red-900/50">
                      <div className="flex">
                        <ExclamationTriangleIcon className="h-6 w-6 text-red-600 dark:text-red-400 flex-shrink-0" />
                        <div className="ml-3">
                          <h3 className="text-sm font-medium text-red-800 dark:text-red-200">
                            Phát hiện lỗi định dạng file
                          </h3>
                          <div className="mt-2 text-sm text-red-700 dark:text-red-300">
                            <ul className="list-disc list-inside space-y-1">
                              {previewErrors.map((error, index) => (
                                <li key={index}>{error}</li>
                              ))}
                            </ul>
                          </div>
                          <p className="mt-3 text-sm text-red-600 dark:text-red-400 font-medium">
                            Vui lòng điều chỉnh lại file theo mẫu và thử lại.
                          </p>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
                        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                          <thead className="bg-gray-50 dark:bg-gray-800">
                            <tr>
                              {Object.keys(previewData[0] || {}).map((header) => (
                                <th
                                  key={header}
                                  scope="col"
                                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider whitespace-nowrap"
                                >
                                  {header}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
                            {previewData.map((row, index) => (
                              <tr key={index}>
                                {Object.values(row).map((value: any, i) => (
                                  <td
                                    key={i}
                                    className="px-6 py-4 text-sm text-gray-900 dark:text-gray-100 whitespace-nowrap"
                                  >
                                    {value}
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                        Hiển thị tối đa 5 dòng đầu tiên để kiểm tra cấu trúc file.
                      </p>
                    </>
                  )}

                  <div className="flex flex-col sm:flex-row justify-between gap-3">
                    <Button variant="outline" size="sm" onClick={() => setCurrentStep(2)} className="w-full sm:w-auto justify-center">
                      <ArrowLeftIcon className="h-5 w-5" />
                      Quay lại cấu hình
                    </Button>
                    <Button
                      size="sm"
                      onClick={handleStep3Next}
                      loading={processing}
                      disabled={previewErrors.length > 0}
                      className="w-full sm:w-auto"
                    >
                      Bắt đầu {operationType === 'import' ? 'Import' : 'Export'}
                      <ArrowRightIcon className="h-5 w-5" />
                    </Button>
                  </div>
                </div>
              )}

              {/* Step 3: Preview (Export) */}
              {currentStep === 3 && operationType === 'export' && (
                <div className="space-y-6">
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                    Xem trước thông tin xuất dữ liệu
                  </h2>

                  <div className="rounded-lg bg-gray-50 dark:bg-gray-900/50 p-6 space-y-4">
                    <div>
                      <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Loại dữ liệu
                      </h3>
                      <p className="text-sm text-gray-900 dark:text-white">
                        {exportTypes.find(t => t.value === exportType)?.label || exportType}
                      </p>
                    </div>

                    <div>
                      <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Định dạng file
                      </h3>
                      <p className="text-sm text-gray-900 dark:text-white">
                        {exportFormat === 'excel' ? 'Excel (.xlsx)' : 'CSV (.csv)'}
                      </p>
                    </div>

                    {exportDateRange && exportDateRange.start && exportDateRange.end && (
                      <div>
                        <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Khoảng thời gian
                        </h3>
                        <p className="text-sm text-gray-900 dark:text-white">
                          {new Date(exportDateRange.start).toLocaleDateString('vi-VN')} - {new Date(exportDateRange.end).toLocaleDateString('vi-VN')}
                        </p>
                      </div>
                    )}

                    {(exportType === 'payments' || exportType === 'students' || exportType === 'classes' || exportType === 'assignments') && exportStatus !== 'all' && (
                      <div>
                        <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Trạng thái
                        </h3>
                        <p className="text-sm text-gray-900 dark:text-white">
                          {getStatusOptions().find(opt => opt.value === exportStatus)?.label || exportStatus}
                        </p>
                      </div>
                    )}

                    {(exportType === 'revenue' || exportType === 'payments') && exportPaymentMethod !== 'all' && (
                      <div>
                        <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Phương thức thanh toán
                        </h3>
                        <p className="text-sm text-gray-900 dark:text-white">
                          {exportPaymentMethod === 'bank_transfer' ? 'Chuyển khoản' : exportPaymentMethod === 'cash' ? 'Tiền mặt' : 'Khác'}
                        </p>
                      </div>
                    )}

                    {(exportType === 'attendance' || exportType === 'students' || exportType === 'assignments') && exportClassId !== 'all' && (
                      <div>
                        <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Lớp học
                        </h3>
                        <p className="text-sm text-gray-900 dark:text-white">
                          {classesList.find((c: any) => getObjId(c) === exportClassId)?.name ||
                            classesList.find((c: any) => getObjId(c) === exportClassId)?.class_name ||
                            `Lớp ${exportClassId}`}
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col sm:flex-row justify-between gap-3">
                    <Button variant="outline" size="sm" onClick={() => setCurrentStep(2)} className="w-full sm:w-auto justify-center">
                      <ArrowLeftIcon className="h-5 w-5" />
                      Quay lại
                    </Button>
                    <Button size="sm" onClick={handleStep3Next} loading={processing} className="w-full sm:w-auto">
                      Xuất file
                      <ArrowRightIcon className="h-5 w-5" />
                    </Button>
                  </div>
                </div>
              )}

              {currentStep === 4 && (
                <div className="space-y-6">
                  <div className="rounded-lg bg-white p-6 dark:bg-gray-800 border border-gray-100 dark:border-gray-700">
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">
                      Kết quả {operationType === 'import' ? 'Import' : 'Export'}
                    </h2>

                    {processing ? (
                      <div className="flex flex-col items-center justify-center py-12">
                        <div className="relative">
                          <div className="h-16 w-16 rounded-full border-4 border-gray-200 dark:border-gray-700"></div>
                          <div className="absolute top-0 left-0 h-16 w-16 rounded-full border-4 border-primary border-t-transparent animate-spin"></div>
                        </div>
                        <h3 className="mt-6 text-lg font-medium text-gray-900 dark:text-white">
                          Đang xử lý dữ liệu...
                        </h3>
                        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                          Hệ thống đang kiểm tra và nhập dữ liệu. Vui lòng không tắt trình duyệt.
                        </p>
                      </div>
                    ) : (
                      <>
                        {operationType === 'import' && importResult && (
                          <div className="space-y-6">
                            <div className={`rounded-lg p-5 border ${importResult.failed === 0
                              ? 'bg-green-50 border-green-100 dark:bg-green-900/10 dark:border-green-900/20'
                              : 'bg-orange-50 border-orange-100 dark:bg-orange-900/10 dark:border-orange-900/20'
                              }`}>
                              <div className="flex items-start gap-4">
                                {importResult.failed === 0 ? (
                                  <CheckCircleIcon className="h-6 w-6 text-green-600 dark:text-green-400 flex-shrink-0" />
                                ) : (
                                  <ExclamationTriangleIcon className="h-6 w-6 text-orange-600 dark:text-orange-400 flex-shrink-0" />
                                )}
                                <div>
                                  <h3 className={`text-base font-semibold ${importResult.failed === 0
                                    ? 'text-green-800 dark:text-green-200'
                                    : 'text-orange-800 dark:text-orange-200'
                                    }`}>
                                    {importResult.failed === 0 ? 'Import hoàn tất thành công' : 'Import hoàn tất với cảnh báo'}
                                  </h3>
                                  <div className="mt-2 text-sm grid grid-cols-2 gap-x-8 gap-y-1">
                                    <div className="text-gray-600 dark:text-gray-400">Tổng số dòng: <span className="font-semibold text-gray-900 dark:text-white">{importResult.total_rows ?? importResult.total ?? 0}</span></div>
                                    <div className="text-green-700 dark:text-green-400">Thành công: <span className="font-semibold">{(importResult.success ?? ((importResult.created ?? 0) + (importResult.updated ?? 0)))}</span></div>
                                    {importResult.failed > 0 && (
                                      <div className="text-red-600 dark:text-red-400">Thất bại: <span className="font-semibold">{importResult.failed}</span></div>
                                    )}
                                    {importResult.skipped > 0 && (
                                      <div className="text-yellow-600 dark:text-yellow-400">Bỏ qua: <span className="font-semibold">{importResult.skipped}</span></div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>

                            {importResult.errors && importResult.errors.length > 0 && (
                              <div className="rounded-lg border border-red-200 dark:border-red-900/50 overflow-hidden">
                                <div className="bg-red-50 dark:bg-red-900/20 px-4 py-3 border-b border-red-200 dark:border-red-900/50">
                                  <h3 className="text-sm font-medium text-red-800 dark:text-red-200">
                                    Danh sách lỗi ({importResult.errors.length} dòng)
                                  </h3>
                                </div>
                                <div className="max-h-[300px] overflow-y-auto bg-white dark:bg-gray-800 p-0">
                                  <table className="min-w-full divide-y divide-gray-100 dark:divide-gray-700">
                                    <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                                      {importResult.errors.map((error, index) => (
                                        <tr key={index} className="hover:bg-gray-50 dark:hover:bg-gray-750">
                                          <td className="px-4 py-3 text-sm align-top whitespace-nowrap w-[100px]">
                                            <span className="font-medium text-red-600 dark:text-red-400">
                                              Dòng {(error.row ?? (error.index !== undefined ? error.index + 1 : index + 1))}
                                            </span>
                                          </td>
                                          <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">
                                            <ul className="list-disc list-inside space-y-1">
                                              {Array.isArray(error.errors) ? (
                                                error.errors.map((err, errIndex) => (
                                                  <li key={errIndex}>{err}</li>
                                                ))
                                              ) : (
                                                <li>{error.error || error.message || 'Lỗi không xác định'}</li>
                                              )}
                                            </ul>
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            )}
                          </div>
                        )}

                        {operationType === 'export' && exportSuccess && (
                          <div className="rounded-lg bg-green-50 dark:bg-green-900/20 p-5 border border-green-100 dark:border-green-900/20">
                            <div className="flex">
                              <CheckCircleIcon className="h-6 w-6 text-green-600 dark:text-green-400 flex-shrink-0" />
                              <div className="ml-4">
                                <h3 className="text-base font-medium text-green-800 dark:text-green-200">
                                  Export dữ liệu thành công
                                </h3>
                                <p className="mt-2 text-sm text-green-700 dark:text-green-300">
                                  File báo cáo đã được tải xuống thiết bị của bạn.
                                </p>
                              </div>
                            </div>
                          </div>
                        )}

                        <div className="flex flex-col sm:flex-row justify-end gap-3 mt-8 pt-6 border-t border-gray-100 dark:border-gray-700">
                          <Button variant="outline" size="sm" onClick={handleReset} className="w-full sm:w-auto justify-center">
                            Thao tác mới
                          </Button>
                          {operationType === 'import' && (
                            <Button size="sm" onClick={() => router.push('/assignment-types')} className="w-full sm:w-auto">
                              Xem danh sách
                            </Button>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          </>
        </TabPanel>

        {/* History Content */}
        <TabPanel activeTab={activeTab} tabId="history">
          <div className="space-y-6">
            {/* Filters */}
            <div className="rounded-lg bg-white p-4 sm:p-6 dark:bg-gray-800">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 relative">
                <SelectInput
                  label="Loại"
                  name="historyType"
                  value={historyFilters.type || 'all'}
                  handleChange={(e) => setHistoryFilters({ ...historyFilters, type: e.target.value === 'all' ? undefined : e.target.value as 'import' | 'export', page: 1 })}
                  options={[
                    { value: 'all', label: 'Tất cả' },
                    { value: 'import', label: 'Import' },
                    { value: 'export', label: 'Export' },
                  ]}
                />
                <SelectInput
                  label="Trạng thái"
                  name="historyStatus"
                  value={historyFilters.status || 'all'}
                  handleChange={(e) => setHistoryFilters({ ...historyFilters, status: e.target.value === 'all' ? undefined : e.target.value as any, page: 1 })}
                  options={[
                    { value: 'all', label: 'Tất cả' },
                    { value: 'processing', label: 'Đang xử lý' },
                    { value: 'success', label: 'Thành công' },
                    { value: 'partial', label: 'Thành công một phần' },
                    { value: 'failed', label: 'Thất bại' },
                  ]}
                />
                <div className="lg:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Khoảng thời gian
                  </label>
                  <DateRangePicker
                    value={historyFilters.date_from && historyFilters.date_to ? { start: historyFilters.date_from, end: historyFilters.date_to } : undefined}
                    onChange={(range) => setHistoryFilters({
                      ...historyFilters,
                      date_from: range?.start,
                      date_to: range?.end,
                      page: 1
                    })}
                    placeholder="Chọn khoảng thời gian"
                  />
                </div>

                {(historyFilters.type || historyFilters.status || historyFilters.date_from || historyFilters.date_to) && (
                  <button
                    onClick={() => setHistoryFilters({ page: 1, per_page: 20 })}
                    className="absolute -top-3 right-0 text-xs font-medium text-red-500 hover:text-red-700 bg-white dark:bg-gray-800 px-2 py-0.5 rounded-full border border-gray-100 dark:border-gray-700"
                  >
                    Xóa bộ lọc
                  </button>
                )}
              </div>
            </div>

            {/* History List */}
            <div className="rounded-lg bg-white dark:bg-gray-800">
              <div className="p-6">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                  Lịch sử Export/Import
                </h2>

                {historyLoading ? (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                      <thead className="bg-gray-50 dark:bg-gray-900">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                            Loại
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                            Module
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                            Trạng thái
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                            File
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                            Thời gian
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                        {[...Array(5)].map((_, i) => (
                          <tr key={i} className="animate-pulse">
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="h-6 w-16 rounded-full bg-gray-200 dark:bg-gray-700" />
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="h-4 w-24 rounded bg-gray-200 dark:bg-gray-700" />
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="h-6 w-20 rounded-full bg-gray-200 dark:bg-gray-700" />
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="h-4 w-16 rounded bg-gray-200 dark:bg-gray-700" />
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="h-4 w-36 rounded bg-gray-200 dark:bg-gray-700" />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : historyJobs && historyJobs.length > 0 ? (
                  <>
                    {/* Mobile Card View */}
                    <div className="block lg:hidden rounded-lg bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700 overflow-hidden">
                      {historyJobs.map((job: any, index: number) => (
                        <div key={getObjId(job) || index} className="p-3 hover:bg-gray-50 dark:hover:bg-gray-700/50">
                          <div className="space-y-1.5">
                            <div className="flex items-start justify-between gap-2">
                              <h3 className="text-sm font-medium text-gray-900 dark:text-white truncate flex-1 min-w-0">
                                {getModuleLabel(job.module)}
                              </h3>
                              <div className="flex items-center gap-1.5 flex-shrink-0">
                                <span className={`px-1.5 py-0.5 text-[10px] font-medium rounded-full ${job.type === 'export'
                                  ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400'
                                  : 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
                                  }`}>
                                  {job.type === 'export' ? 'Export' : 'Import'}
                                </span>
                                <span className={`px-1.5 py-0.5 text-[10px] font-medium rounded-full ${job.status === 'success'
                                  ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
                                  : job.status === 'partial'
                                    ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400'
                                    : job.status === 'failed'
                                      ? 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400'
                                      : 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400'
                                  }`}>
                                  {job.status === 'success' ? 'Thành công' :
                                    job.status === 'partial' ? 'Thành công một phần' :
                                      job.status === 'failed' ? 'Thất bại' : 'Đang xử lý'}
                                </span>
                              </div>
                            </div>
                            <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                              <div className="col-span-2">
                                <span className="text-gray-500 dark:text-gray-400 font-medium">Định dạng:</span>
                                <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                                  {job.format === 'excel' ? 'Excel' :
                                    job.format === 'csv' ? 'CSV' :
                                      job.file_name?.toLowerCase().endsWith('.csv') ? 'CSV' :
                                        job.file_name?.toLowerCase().match(/\.xlsx?$/) ? 'Excel' :
                                          job.format?.toUpperCase() || '-'}
                                </div>
                              </div>

                              {job.created_at && (
                                <div>
                                  <span className="text-gray-500 dark:text-gray-400 font-medium">Thời gian:</span>
                                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                                    {new Date(job.created_at).toLocaleString('vi-VN')}
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Desktop Table View */}
                    <div className="hidden lg:block rounded-lg bg-white dark:bg-gray-800 overflow-hidden">
                      <div className="overflow-x-auto">
                        <table className="min-w-[800px] w-full divide-y divide-gray-200 dark:divide-gray-700">
                          <thead className="bg-gray-50 dark:bg-gray-900">
                            <tr>
                              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400 min-w-[100px]">
                                Loại
                              </th>
                              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400 min-w-[150px]">
                                Module
                              </th>
                              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400 min-w-[160px]">
                                Trạng thái
                              </th>
                              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400 min-w-[100px]">
                                Định dạng
                              </th>
                              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400 min-w-[150px]">
                                Thời gian
                              </th>
                            </tr>
                          </thead>
                          <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                            {historyJobs.map((job: any, index: number) => (
                              <tr key={getObjId(job) || index} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                                <td className="px-6 py-4">
                                  <span className={`px-2 py-1 text-xs font-medium rounded-full ${job.type === 'export'
                                    ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400'
                                    : 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
                                    }`}>
                                    {job.type === 'export' ? 'Export' : 'Import'}
                                  </span>
                                </td>
                                <td className="px-6 py-4 text-sm text-gray-900 dark:text-white">
                                  {getModuleLabel(job.module)}
                                </td>
                                <td className="px-6 py-4">
                                  <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full whitespace-nowrap ${job.status === 'success'
                                    ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
                                    : job.status === 'partial'
                                      ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400'
                                      : job.status === 'failed'
                                        ? 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400'
                                        : 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400'
                                    }`}>
                                    {job.status === 'success' ? 'Thành công' :
                                      job.status === 'partial' ? 'Thành công một phần' :
                                        job.status === 'failed' ? 'Thất bại' : 'Đang xử lý'}
                                  </span>
                                </td>
                                <td className="px-6 py-4 text-sm text-gray-900 dark:text-white">
                                  {job.format === 'excel' ? 'Excel' :
                                    job.format === 'csv' ? 'CSV' :
                                      job.file_name?.toLowerCase().endsWith('.csv') ? 'CSV' :
                                        job.file_name?.toLowerCase().match(/\.xlsx?$/) ? 'Excel' :
                                          job.format?.toUpperCase() || '-'}
                                </td>

                                <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                                  {job.created_at ? new Date(job.created_at).toLocaleString('vi-VN') : '-'}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* Pagination */}
                    {historyMeta && (
                      <Pagination
                        meta={historyMeta}
                        currentPage={historyFilters.page || 1}
                        onPageChange={(page) => setHistoryFilters({ ...historyFilters, page })}
                        itemLabel="bản ghi"
                        className="mt-4"
                      />
                    )}
                  </>
                ) : historyError ? (
                  <div className="text-center py-12">
                    <p className="text-red-500 dark:text-red-400">
                      {typeof historyError === 'string' ? historyError : 'Có lỗi xảy ra khi tải lịch sử'}
                    </p>
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <p className="text-gray-500 dark:text-gray-400">Không có lịch sử nào</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </TabPanel>
      </div>
    </ProtectedRoute>
  );
}

