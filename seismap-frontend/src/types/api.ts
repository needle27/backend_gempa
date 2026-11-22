export interface ApiMeta {
  status: 'success' | 'error' | string;
  count?: number;
  limit?: number;
  offset?: number;
  code?: string;
  message?: string;
  details?: Record<string, unknown> | null;
}

export interface ApiEnvelope<T> {
  data: T;
  meta: ApiMeta;
}

export class ApiError extends Error {
  status: number;
  code?: string;
  details?: Record<string, unknown> | null;
  requestId?: string;

  constructor(message: string, status: number, code?: string, details?: Record<string, unknown> | null, requestId?: string) {
    super(requestId ? `${message} (ID Referensi: ${requestId})` : message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
    this.requestId = requestId;
  }
}
