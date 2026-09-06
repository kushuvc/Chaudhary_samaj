import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { api, setApiSession, setUnauthorizedHandler } from '../services/api';
import { clearSession, loadSession, saveSession } from '../services/authStorage';
import type { AuthSession, OtpPurpose, SignupPayload } from '../types';

interface AuthContextValue {
  session: AuthSession | null;
  loading: boolean;
  isNewSignup: boolean;
  requestOtp: (email: string, purpose: OtpPurpose) => Promise<{ message?: string; debugOtp?: string }>;
  verifyOtp: (email: string, purpose: OtpPurpose, otp: string) => Promise<void>;
  login: (payload: { email: string; password: string }) => Promise<void>;
  loginWithToken: (token: string, userId: string) => Promise<void>;
  signup: (payload: SignupPayload) => Promise<void>;
  logout: () => Promise<void>;
  completeProfileSetup: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [isNewSignup, setIsNewSignup] = useState(false);

  useEffect(() => {
    loadSession()
      .then((stored) => {
        setSession(stored);
        setApiSession(stored);
        setIsNewSignup(false);
      })
      .finally(() => setLoading(false));
  }, []);

  // The API layer calls this when the server rejects our stored token, so an
  // expired or invalidated session lands the user on the login screen instead
  // of an authenticated shell that silently fails every request.
  useEffect(() => {
    setUnauthorizedHandler(() => {
      setSession(null);
      setApiSession(null);
      setIsNewSignup(false);
      void clearSession();
    });
    return () => setUnauthorizedHandler(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      loading,
      isNewSignup,
      requestOtp: async (email, purpose) => {
        return api.requestOtp(email, purpose);
      },
      verifyOtp: async (email, purpose, otp) => {
        const next = await api.verifyOtp(email, purpose, otp);
        // Signup verifies the address before the account exists, so there is no
        // session yet — the signup call that follows establishes it.
        if (next) {
          setSession(next);
          setApiSession(next);
          setIsNewSignup(false);
          await saveSession(next);
        }
      },
      login: async (payload) => {
        const next = await api.login(payload);
        setSession(next);
        setApiSession(next);
        setIsNewSignup(false);
        await saveSession(next);
      },
      loginWithToken: async (token, userId) => {
        const session: AuthSession = {
          authToken: token,
          user: {
            id: userId,
            name: '',
            email: '',
            isVerified: true,
          }
        };
        setSession(session);
        setApiSession(session);
        setIsNewSignup(false);
        await saveSession(session);
      },
      signup: async (payload) => {
        const next = await api.signup(payload);
        setSession(next);
        setApiSession(next);
        setIsNewSignup(true);
        await saveSession(next);
      },
      logout: async () => {
        setSession(null);
        setApiSession(null);
        setIsNewSignup(false);
        await clearSession();
      },
      completeProfileSetup: async () => {
        setIsNewSignup(false);
      }
    }),
    [session, loading, isNewSignup]
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
