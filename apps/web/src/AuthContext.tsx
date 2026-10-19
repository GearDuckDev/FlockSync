import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { AuthUser, RegisterRequest } from '@flocksync/shared-types';
import { ApiError, TOKEN_KEY, fetchMe, login as apiLogin } from './lib/api';
import { register as apiRegister } from './lib/apiUsers';

interface AuthState {
  user: AuthUser | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (input: RegisterRequest) => Promise<void>;
  updateLocalUsername: (id: string, username: string) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthState | null>(null);

export const AuthProvider = ({ children }: { children: React.ReactNode }): React.JSX.Element => {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(TOKEN_KEY));
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(token !== null);

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    setToken(null);
    setUser(null);
  }, []);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    fetchMe(token)
      .then((u) => !cancelled && setUser(u))
      .catch((err: unknown) => {
        // Only drop the session when the server rejects the token, not on network failures.
        if (!cancelled && err instanceof ApiError && err.status === 401) logout();
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [token, logout]);

  const login = useCallback(async (email: string, password: string) => {
    const res = await apiLogin(email, password);
    localStorage.setItem(TOKEN_KEY, res.token);
    setUser(res.user);
    setToken(res.token);
  }, []);

  const register = useCallback(async (input: RegisterRequest) => {
    const res = await apiRegister(input);
    localStorage.setItem(TOKEN_KEY, res.token);
    setUser(res.user);
    setToken(res.token);
  }, []);

  const updateLocalUsername = useCallback((id: string, username: string) => {
    setUser((current) => current?.id === id ? { ...current, username } : current);
  }, []);

  const value = useMemo(
    () => ({ user, token, loading, login, register, logout, updateLocalUsername }),
    [user, token, loading, login, register, logout, updateLocalUsername],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthState => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
