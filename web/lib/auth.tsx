'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useRouter } from 'next/navigation';
import { api, tokenStore, type SignupInput } from './api';
import type { User } from './types';

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (input: SignupInput) => Promise<void>;
  logout: () => Promise<void>;
  /** Replace the cached user after a settings update. */
  setUser: (user: User) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  // On mount, restore the session from a stored token (if any).
  useEffect(() => {
    let cancelled = false;
    async function restore() {
      if (!tokenStore.access) {
        setLoading(false);
        return;
      }
      try {
        const { user: me } = await api.auth.me();
        if (!cancelled) setUser(me);
      } catch {
        tokenStore.clear();
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void restore();
    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const result = await api.auth.login(email, password);
    tokenStore.set(result.tokens);
    setUser(result.user);
  }, []);

  const signup = useCallback(async (input: SignupInput) => {
    const result = await api.auth.signup(input);
    tokenStore.set(result.tokens);
    setUser(result.user);
  }, []);

  const logout = useCallback(async () => {
    const refreshToken = tokenStore.refresh;
    if (refreshToken) {
      try {
        await api.auth.logout(refreshToken);
      } catch {
        // Best-effort; still clear local session below.
      }
    }
    tokenStore.clear();
    setUser(null);
    router.push('/login');
  }, [router]);

  const value = useMemo<AuthContextValue>(
    () => ({ user, loading, login, signup, logout, setUser }),
    [user, loading, login, signup, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
