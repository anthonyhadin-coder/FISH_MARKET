// ─── API / Error Types ──────────────────────────────────────────────────────

export interface ApiError {
  message?: string;
  code?: string;
  response?: {
    status?: number;
    data?: {
      message?: string;
      errors?: Array<{ path: string | string[]; message: string }>;
    };
  };
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  message?: string;
  data?: T;
  errors?: Array<{ path: string | string[]; message: string }>;
}
