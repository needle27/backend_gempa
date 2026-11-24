import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { ApiError } from '../types/api';
import type { AdminUser } from '../types/domain';
import { getActiveLanguage } from '../i18n/LanguageContext';
import { IS_PREVIEW_MODE } from '../config/env';
import { hasCsrfCookie, clearAuthTokens } from '../api/client';
import { getCurrentUser, login as loginRequest, logout as logoutRequest, refreshSession } from '../api/auth';
import { clearNamespaceCache } from '../utils/resourceCache';

interface AuthContextValue {
  user: AdminUser | null;
  loading: boolean;
  authenticated: boolean;
  signIn: (identity: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  reloadUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AdminUser | null>(null);
  const [loading, setLoading] = useState(!IS_PREVIEW_MODE);

  const reloadUser = useCallback(async () => {
    if (IS_PREVIEW_MODE) { setUser(null); setLoading(false); return; }
    try {
      const current = await getCurrentUser();
      setUser(current);
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        // Jangan refresh sesi anonim tanpa CSRF refresh cookie.
        if (!hasCsrfCookie('refresh')) {
          clearNamespaceCache('admin');
          setUser(null);
          return;
        }

        try {
          await refreshSession();
          setUser(await getCurrentUser());
          return;
        } catch {
          clearNamespaceCache('admin');
          setUser(null);
          return;
        }
      }
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reloadUser();
    const expire = () => {
      clearNamespaceCache('admin');
      setUser(null);
    };
    window.addEventListener('seismap:auth-expired', expire);
    return () => window.removeEventListener('seismap:auth-expired', expire);
  }, [reloadUser]);

  const signIn = useCallback(async (identity: string, password: string) => {
    if (IS_PREVIEW_MODE) {
      throw new Error(
        getActiveLanguage() === 'en'
          ? 'Sign-in is disabled in Preview Mode.'
          : 'Login tidak dijalankan pada Mode Pratinjau.',
      );
    }
    await loginRequest(identity, password);
    setUser(await getCurrentUser());
  }, []);

  const signOut = useCallback(async () => {
    if (IS_PREVIEW_MODE) return;
    try {
      await logoutRequest();
    } catch {}
    clearAuthTokens();
    clearNamespaceCache('admin');
    setUser(null);
  }, []);

  const value = useMemo(() => ({ user, loading, authenticated: Boolean(user), signIn, signOut, reloadUser }), [user, loading, signIn, signOut, reloadUser]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth harus digunakan di dalam AuthProvider.');
  return value;
}
