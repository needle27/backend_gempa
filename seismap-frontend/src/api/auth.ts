import { apiRequest, apiRequestEnvelope } from './client';
import type { AdminUser } from '../types/domain';

function normalizeUser(payload: AdminUser | { user?: AdminUser }): AdminUser {
  const candidate = 'user' in payload && payload.user ? payload.user : payload;
  if (!candidate || typeof candidate !== 'object' || !('id' in candidate) || !('role' in candidate)) {
    throw new Error('Informasi akun administrator dari server tidak dapat dibaca. Silakan masuk kembali.');
  }
  return candidate as AdminUser;
}

export async function login(identity: string, password: string): Promise<void> {
  const credentials = identity.includes('@') ? { email: identity, password } : { username: identity, password };
  await apiRequestEnvelope<unknown>('/api/auth/login', {
    method: 'POST',
    csrf: false,
    body: JSON.stringify(credentials),
  });
  // Login sets HttpOnly cookies. The session identity is then verified through /me.
}

export async function refreshSession(): Promise<void> {
  await apiRequestEnvelope<unknown>('/api/auth/refresh', { method: 'POST', csrf: 'refresh' });
}

export async function getCurrentUser(): Promise<AdminUser> {
  const result = await apiRequest<AdminUser | { user?: AdminUser }>('/api/auth/me');
  return normalizeUser(result);
}

export async function logout(): Promise<void> {
  await apiRequestEnvelope<unknown>('/api/auth/logout', { method: 'POST', csrf: 'access' });
}
