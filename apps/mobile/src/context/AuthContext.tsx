import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { api, setApiSession, setUnauthorizedHandler } from '../services/api';
import { clearSession, loadSession, saveSession } from '../services/authStorage';
import type { AuthSession, OtpPurpose, SignupPayload } from '../types';
import { unregisterPush } from '../services/push';

interface AuthContextValue {
  session: AuthSession | null;
  loading: boolean;
  isNewSignup: boolean;
  requestOtp: (email: string, purpose: OtpPurpose, phone?: string) => Promise<{ message?: string; debugOtp?: string }>;
  verifyOtp: (email: string, purpose: OtpPurpose, otp: string) => Promise<void>;
  login: (payload: { email: string; password: string }) => Promise<void>;
  loginWithToken: (token: string, userId: string) => Promise<void>;
  signup: (payload: SignupPayload) => Promise<void>;
  logout: () => Promise<void>;
  completeProfileSetup: () => Promise<void>;
}

/** The account id inside a JWT (its `sub`), or '' when it cannot be read. */
function tokenSubject(token: string): string {
  try {
    const part = token.split('.')[1] || '';
    const base64 = part.replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
    return String(JSON.parse(atob(padded))?.sub || '');
  } catch {
    return '';
  }
}

/*
 * A session must know whose it is. The password-reset sign-in had no id to
 * pass, so it stored an empty one — and chat, which tells your messages from
 * theirs by comparing ids, put every message on the other person's side. The
 * token always carries the id, so fill it from there when it is missing.
 */
function withUserId<T extends AuthSession | null>(session: T): T {
  if (!session || session.user?.id) return session;
  const id = tokenSubject(session.authToken);
  return id ? ({ ...session, user: { ...session.user, id } } as T) : session;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [isNewSignup, setIsNewSignup] = useState(false);

  useEffect(() => {
    loadSession()
      .then((loaded) => {
        const stored = withUserId(loaded);
        if (stored !== loaded) void saveSession(stored!);
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
      requestOtp: async (email, purpose, phone) => {
        return api.requestOtp(email, purpose, phone);
      },
      verifyOtp: async (email, purpose, otp) => {
        const next = withUserId(await api.verifyOtp(email, purpose, otp));
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
        const next = withUserId(await api.login(payload));
        setSession(next);
        setApiSession(next);
        setIsNewSignup(false);
        await saveSession(next);
      },
      loginWithToken: async (token, userId) => {
        const session: AuthSession = {
          authToken: token,
          user: {
            id: userId || tokenSubject(token),
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
        const next = withUserId(await api.signup(payload));
        setSession(next);
        setApiSession(next);
        setIsNewSignup(true);
        await saveSession(next);
      },
      logout: async () => {
        // Before the session goes: detaching the device is an authenticated call.
        await unregisterPush();
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
