import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { api, setApiSession } from '../services/api';
import { clearSession, loadSession, saveSession } from '../services/authStorage';
import type { AuthSession, OtpPurpose, SignupPayload } from '../types';

interface AuthContextValue {
  session: AuthSession | null;
  loading: boolean;
  requestOtp: (email: string, purpose: OtpPurpose) => Promise<void>;
  login: (payload: { email: string; password: string; otpCode: string }) => Promise<void>;
  signup: (payload: SignupPayload) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSession()
      .then((stored) => {
        setSession(stored);
        setApiSession(stored);
      })
      .finally(() => setLoading(false));
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      loading,
      requestOtp: async (email, purpose) => {
        await api.requestOtp(email, purpose);
      },
      login: async (payload) => {
        const next = await api.login(payload);
        setSession(next);
        setApiSession(next);
        await saveSession(next);
      },
      signup: async (payload) => {
        const next = await api.signup(payload);
        setSession(next);
        setApiSession(next);
        await saveSession(next);
      },
      logout: async () => {
        setSession(null);
        setApiSession(null);
        await clearSession();
      }
    }),
    [session, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
