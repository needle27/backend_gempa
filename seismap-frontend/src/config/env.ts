function getApiBaseUrl(): string {
  const configuredUrl = import.meta.env.VITE_API_BASE_URL?.trim();

  if (configuredUrl) {
    return configuredUrl.replace(/\/+$/, '');
  }

  if (import.meta.env.DEV) {
    return 'http://127.0.0.1:5000';
  }

  return 'https://backend-gempa.vercel.app';
}

export const API_BASE_URL = getApiBaseUrl();
