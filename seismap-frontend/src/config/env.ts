const rawPreview = import.meta.env.VITE_UI_PREVIEW_MODE === 'true';

// Preview bypass is only available during Vite development/preview sessions.
export const IS_PREVIEW_MODE = import.meta.env.DEV && rawPreview;

function getApiBaseUrl(): string {
  if (typeof window !== 'undefined' && window.location?.hostname) {
    const host = window.location.hostname;
    return `http://${host}:5001`;
  }
  return (import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:5001').replace(/\/$/, '');
}

export const API_BASE_URL = getApiBaseUrl();
export const CSRF_COOKIE_NAME = import.meta.env.VITE_CSRF_COOKIE_NAME || 'csrf_access_token';
export const CSRF_REFRESH_COOKIE_NAME = import.meta.env.VITE_CSRF_REFRESH_COOKIE_NAME || 'csrf_refresh_token';
