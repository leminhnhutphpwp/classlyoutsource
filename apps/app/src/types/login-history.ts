export interface LoginDeviceInfo {
  id?: string | null;
  name?: string | null;
  location?: string | null;
}

export interface LoginHistoryEntry {
  id?: string;
  email?: string | null;
  status: string;
  message?: string | null;
  ip_address?: string | null;
  device_id?: string | null;
  device_name?: string | null;
  device?: LoginDeviceInfo | null;
  location?: string | null;
  user_agent?: string | null;
  logged_in_at?: string | null;
  is_success?: boolean;
  context?: Record<string, any> | null;
}

export interface LoginHistoryMeta {
  current_page?: number;
  per_page?: number;
  total?: number;
  last_page?: number;
  from?: number;
  to?: number;
}

export interface LoginHistoryResponse {
  items?: LoginHistoryEntry[];
  meta?: LoginHistoryMeta;
  student?: {
    id: string;
    name: string;
    email?: string | null;
    user_id?: string | null;
  } | null;
}

export interface LoginHistoryFilters {
  status?: string;
  from_date?: string;
  to_date?: string;
  page?: number;
  per_page?: number;
}

