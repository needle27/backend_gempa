import { API_BASE_URL, CSRF_COOKIE_NAME, CSRF_REFRESH_COOKIE_NAME } from '../config/env';
import { ApiError, type ApiEnvelope } from '../types/api';
import { friendlyErrorMessage } from '../utils/presentation';

function readCookie(name: string): string | undefined {
  if (!name || typeof document === 'undefined') return undefined;
  const prefix = `${encodeURIComponent(name)}=`;
  const entry = document.cookie.split('; ').find((part) => part.startsWith(prefix));
  return entry ? decodeURIComponent(entry.slice(prefix.length)) : undefined;
}

export interface RequestOptions extends RequestInit {
  csrf?: 'access' | 'refresh' | false;
}

function getPublicRunError(path: string, status: number, code?: string): string | undefined {
  if (status !== 404 || code !== 'NOT_FOUND') return undefined;
  if (['/api/metadata', '/api/summary', '/api/profil', '/api/gempa'].some((route) => path.startsWith(route))) {
    return 'Belum ada hasil DBSCAN aktif yang dipublikasikan. WebGIS akan menampilkan hasil setelah administrator mengaktifkan eksekusi yang berhasil.';
  }
  return undefined;
}

async function parseResponse<T>(response: Response, path: string): Promise<ApiEnvelope<T>> {
  let body: unknown;
  try { body = await response.json(); } catch { body = null; }

  const envelope = body as Partial<ApiEnvelope<T>> | null;
  const meta = envelope?.meta;
  const jwtBody = body as { msg?: unknown; message?: unknown; code?: unknown; details?: unknown } | null;
  const requestId = response.headers.get('X-Request-ID') || undefined;

  if (!response.ok || meta?.status === 'error') {
    const rawCode = typeof meta?.code === 'string' ? meta.code : typeof jwtBody?.code === 'string' ? jwtBody.code : undefined;
    const noActiveRun = Boolean(getPublicRunError(path, response.status, rawCode));
    const code = noActiveRun ? 'NO_ACTIVE_RUN' : rawCode;
    const message = getPublicRunError(path, response.status, rawCode)
      || (typeof meta?.message === 'string' ? meta.message : undefined)
      || (typeof jwtBody?.msg === 'string' ? jwtBody.msg : undefined)
      || (typeof jwtBody?.message === 'string' ? jwtBody.message : undefined)
      || `Permintaan gagal (HTTP ${response.status}).`;
    const details = meta?.details && typeof meta.details === 'object'
      ? meta.details
      : jwtBody?.details && typeof jwtBody.details === 'object'
        ? jwtBody.details as Record<string, unknown>
        : undefined;
    throw new ApiError(friendlyErrorMessage(message, code, response.status), response.status, code, details, requestId);
  }

  if (!envelope || !('data' in envelope) || !meta) {
    throw new ApiError('Format data dari server tidak sesuai. Silakan coba lagi.', response.status, 'INVALID_RESPONSE', undefined, requestId);
  }
  return envelope as ApiEnvelope<T>;
}

async function sendOnce<T>(path: string, options: RequestOptions = {}): Promise<ApiEnvelope<T>> {
  const { csrf = 'access', headers, ...init } = options;
  const method = (init.method || 'GET').toUpperCase();
  const nextHeaders = new Headers(headers);
  nextHeaders.set('Accept', 'application/json');

  if (typeof init.body === 'string' && !nextHeaders.has('Content-Type')) {
    nextHeaders.set('Content-Type', 'application/json');
  }

  if (csrf !== false && !['GET', 'HEAD', 'OPTIONS'].includes(method)) {
    const cookieName = csrf === 'refresh' ? CSRF_REFRESH_COOKIE_NAME : CSRF_COOKIE_NAME;
    const token = readCookie(cookieName);
    if (!token) {
      throw new ApiError(
        'Sesi keamanan belum siap. Muat ulang aplikasi atau masuk kembali sebelum mengulangi tindakan.',
        0,
        'CSRF_COOKIE_MISSING',
      );
    }
    nextHeaders.set('X-CSRF-TOKEN', token);
  }

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      method,
      headers: nextHeaders,
      credentials: 'include',
    });
  } catch {
    throw new ApiError('Tidak dapat terhubung ke server. Periksa koneksi dan pastikan server sedang berjalan.', 0, 'NETWORK_ERROR');
  }
  return parseResponse<T>(response, path);
}

export async function apiRequestEnvelope<T>(path: string, options: RequestOptions = {}): Promise<ApiEnvelope<T>> {
  try {
    return await sendOnce<T>(path, options);
  } catch (error) {
    if (error instanceof ApiError && error.status === 401 && path.startsWith('/api/admin/')) {
      try {
        await sendOnce<unknown>('/api/auth/refresh', { method: 'POST', csrf: 'refresh' });
        return await sendOnce<T>(path, options);
      } catch {
        if (typeof window !== 'undefined') window.dispatchEvent(new Event('seismap:auth-expired'));
        throw error;
      }
    }
    throw error;
  }
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const result = await apiRequestEnvelope<T>(path, options);
  return result.data;
}
