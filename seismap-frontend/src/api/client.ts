import { API_BASE_URL, CSRF_COOKIE_NAME, CSRF_REFRESH_COOKIE_NAME } from '../config/env';
import { ApiError, type ApiEnvelope } from '../types/api';
import { friendlyErrorMessage } from '../utils/presentation';

function readCookie(name: string): string | undefined {
  if (!name || typeof document === 'undefined') return undefined;
  const prefix = `${encodeURIComponent(name)}=`;
  const entry = document.cookie.split('; ').find((part) => part.startsWith(prefix));
  return entry ? decodeURIComponent(entry.slice(prefix.length)) : undefined;
}

const memoryCsrfTokens: Record<string, string> = {};
let memoryAccessToken: string | undefined;
let memoryRefreshToken: string | undefined;

export function setAuthTokens(tokens: { accessToken?: string; refreshToken?: string }): void {
  if (tokens.accessToken !== undefined) {
    memoryAccessToken = tokens.accessToken || undefined;
    try {
      if (tokens.accessToken) {
        window?.sessionStorage?.setItem('seismap:access_token', tokens.accessToken);
      } else {
        window?.sessionStorage?.removeItem('seismap:access_token');
      }
    } catch {}
  }
  if (tokens.refreshToken !== undefined) {
    memoryRefreshToken = tokens.refreshToken || undefined;
    try {
      if (tokens.refreshToken) {
        window?.sessionStorage?.setItem('seismap:refresh_token', tokens.refreshToken);
      } else {
        window?.sessionStorage?.removeItem('seismap:refresh_token');
      }
    } catch {}
  }
}

export function getAccessToken(): string | undefined {
  if (memoryAccessToken) return memoryAccessToken;
  try {
    const fromStorage = window?.sessionStorage?.getItem('seismap:access_token');
    if (fromStorage) return fromStorage;
  } catch {}
  return undefined;
}

export function getRefreshToken(): string | undefined {
  if (memoryRefreshToken) return memoryRefreshToken;
  try {
    const fromStorage = window?.sessionStorage?.getItem('seismap:refresh_token');
    if (fromStorage) return fromStorage;
  } catch {}
  return undefined;
}

export function clearAuthTokens(): void {
  setAuthTokens({ accessToken: '', refreshToken: '' });
  setCsrfToken(CSRF_COOKIE_NAME, undefined);
  setCsrfToken(CSRF_REFRESH_COOKIE_NAME, undefined);
}

export function setCsrfToken(name: string, token: string | undefined): void {
  if (!name) return;
  if (token) {
    memoryCsrfTokens[name] = token;
    try { window?.sessionStorage?.setItem(`seismap:${name}`, token); } catch {}
  } else {
    delete memoryCsrfTokens[name];
    try { window?.sessionStorage?.removeItem(`seismap:${name}`); } catch {}
  }
}

export function getCsrfToken(name: string): string | undefined {
  const fromCookie = readCookie(name);
  if (fromCookie) return fromCookie;
  if (memoryCsrfTokens[name]) return memoryCsrfTokens[name];
  try {
    const fromStorage = window?.sessionStorage?.getItem(`seismap:${name}`);
    if (fromStorage) return fromStorage;
  } catch {}
  return undefined;
}

export function hasSessionCredential(type: 'access' | 'refresh' = 'access'): boolean {
  if (type === 'refresh') {
    return Boolean(getRefreshToken() || getCsrfToken(CSRF_REFRESH_COOKIE_NAME));
  }
  return Boolean(getAccessToken() || getCsrfToken(CSRF_COOKIE_NAME));
}

export function hasCsrfCookie(type: 'access' | 'refresh' = 'access'): boolean {
  return hasSessionCredential(type);
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

  const csrfHeader = response.headers.get('X-CSRF-TOKEN');
  if (csrfHeader) {
    setCsrfToken(CSRF_COOKIE_NAME, csrfHeader);
  }
  const bodyObj = body as Record<string, unknown> | null;
  const bodyData = (envelope.data ?? bodyObj?.data) as Record<string, unknown> | null;
  if (bodyData) {
    if (typeof bodyData.access_token === 'string') {
      setAuthTokens({ accessToken: bodyData.access_token });
    }
    if (typeof bodyData.refresh_token === 'string') {
      setAuthTokens({ refreshToken: bodyData.refresh_token });
    }
    if (typeof bodyData.csrf_token === 'string') {
      setCsrfToken(CSRF_COOKIE_NAME, bodyData.csrf_token);
    }
    if (typeof bodyData.csrf_refresh_token === 'string') {
      setCsrfToken(CSRF_REFRESH_COOKIE_NAME, bodyData.csrf_refresh_token);
    }
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

  const tokenToUse = csrf === 'refresh' ? getRefreshToken() : getAccessToken();
  if (tokenToUse && !nextHeaders.has('Authorization')) {
    nextHeaders.set('Authorization', `Bearer ${tokenToUse}`);
  }

  if (csrf !== false && !['GET', 'HEAD', 'OPTIONS'].includes(method)) {
    const cookieName = csrf === 'refresh' ? CSRF_REFRESH_COOKIE_NAME : CSRF_COOKIE_NAME;
    const token = getCsrfToken(cookieName);
    if (token) {
      nextHeaders.set('X-CSRF-TOKEN', token);
    }
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
    if (error instanceof ApiError && error.status === 401 && (path.startsWith('/api/admin/') || path === '/api/auth/me')) {
      const refreshToken = getRefreshToken();
      const hasRefresh = refreshToken || hasCsrfCookie('refresh');
      if (hasRefresh) {
        try {
          await sendOnce<unknown>('/api/auth/refresh', { method: 'POST', csrf: 'refresh' });
          return await sendOnce<T>(path, options);
        } catch {
          clearAuthTokens();
          if (typeof window !== 'undefined') window.dispatchEvent(new Event('seismap:auth-expired'));
          throw error;
        }
      }
    }
    throw error;
  }
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const result = await apiRequestEnvelope<T>(path, options);
  return result.data;
}
