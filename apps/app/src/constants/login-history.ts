import type { LoginHistoryFilters } from '@/types/login-history';

export const DEFAULT_LOGIN_HISTORY_FILTERS: Readonly<Required<LoginHistoryFilters>> = {
  status: 'all',
  from_date: '',
  to_date: '',
  page: 1,
  per_page: 10,
};

export const LOGIN_STATUS_OPTIONS = [
  { value: 'all', label: 'Tất cả trạng thái' },
  { value: 'success', label: 'Thành công' },
  { value: 'invalid_credentials', label: 'Sai mật khẩu' },
  { value: 'account_inactive', label: 'Tài khoản bị khóa' },
  { value: 'tutor_inactive', label: 'Thất bại' },
  { value: 'session_blocked', label: 'Bị chặn phiên' },
  { value: 'user_not_found', label: 'Không tìm thấy tài khoản' },
];

export const LOGIN_PER_PAGE_OPTIONS = [10, 20, 50, 100];

const loginDateFormatter = new Intl.DateTimeFormat('vi-VN', {
  dateStyle: 'short',
  timeStyle: 'short',
});

export function formatLoginHistoryDate(value?: string | null) {
  if (!value) return 'Không xác định';
  try {
    return loginDateFormatter.format(new Date(value));
  } catch {
    return value;
  }
}

const STATUS_META: Record<
  string,
  {
    label: string;
    badgeClass: string;
  }
> = {
  success: {
    label: 'Thành công',
    badgeClass: 'bg-[var(--status-badge-active)] text-[var(--status-badge-active-text)]',
  },
  invalid_credentials: {
    label: 'Sai mật khẩu',
    badgeClass: 'bg-[var(--status-badge-error)] text-[var(--status-badge-error-text)]',
  },
  account_inactive: {
    label: 'Tài khoản bị khóa',
    badgeClass: 'bg-[var(--status-badge-pending)] text-[var(--status-badge-pending-text)]',
  },
  tutor_inactive: {
    label: 'Thất bại',
    badgeClass: 'bg-[var(--status-badge-error)] text-[var(--status-badge-error-text)]',
  },
  session_blocked: {
    label: 'Bị chặn phiên',
    badgeClass: 'bg-[var(--status-badge-pending)] text-[var(--status-badge-pending-text)]',
  },
  user_not_found: {
    label: 'Không tìm thấy tài khoản',
    badgeClass: 'bg-[var(--status-badge-inactive)] text-[var(--status-badge-inactive-text)]',
  },
};

function formatStatusLabel(status?: string | null) {
  if (!status) return 'Không xác định';
  return status
    .split('_')
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export function getLoginStatusMeta(status?: string | null) {
  const normalized = status?.toLowerCase() || '';
  if (STATUS_META[normalized]) {
    return STATUS_META[normalized];
  }
  return {
    label: formatStatusLabel(status),
    badgeClass: 'bg-[var(--status-badge-inactive)] text-[var(--status-badge-inactive-text)]',
  };
}

