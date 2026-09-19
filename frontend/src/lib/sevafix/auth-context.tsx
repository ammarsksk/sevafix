"use client";

import {
  confirmResetPassword,
  confirmSignUp,
  fetchAuthSession,
  resendSignUpCode,
  resetPassword,
  signIn as amplifySignIn,
  signOut as amplifySignOut,
  signUp as amplifySignUp,
} from "aws-amplify/auth";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { configureSevaFixAuth } from "./amplify-auth";

export type SevaFixGroup = "citizen" | "policy-reviewer" | "admin";

export interface SevaFixUser {
  sub: string;
  email?: string;
  groups: SevaFixGroup[];
}

type AuthStatus = "loading" | "authenticated" | "unauthenticated";

interface AuthContextValue {
  status: AuthStatus;
  user: SevaFixUser | null;
  isReviewer: boolean;
  refresh: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  confirmEmail: (email: string, code: string) => Promise<void>;
  resendConfirmationCode: (email: string) => Promise<void>;
  requestPasswordReset: (email: string) => Promise<void>;
  confirmPasswordReset: (
    email: string,
    code: string,
    newPassword: string,
  ) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

async function loadUserFromSession(): Promise<SevaFixUser | null> {
  const session = await fetchAuthSession();
  const idToken = session.tokens?.idToken;
  if (!idToken) return null;

  const payload = idToken.payload;
  const rawGroups = payload["cognito:groups"];
  const groups = Array.isArray(rawGroups) ? (rawGroups as SevaFixGroup[]) : [];

  return {
    sub: String(payload.sub ?? ""),
    email: typeof payload.email === "string" ? payload.email : undefined,
    groups,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [user, setUser] = useState<SevaFixUser | null>(null);

  const refresh = useCallback(async () => {
    try {
      const nextUser = await loadUserFromSession();
      setUser(nextUser);
      setStatus(nextUser ? "authenticated" : "unauthenticated");
    } catch {
      setUser(null);
      setStatus("unauthenticated");
    }
  }, []);

  useEffect(() => {
    configureSevaFixAuth();
    // One-time session bootstrap on mount, not a derived-state sync.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
  }, [refresh]);

  const signIn = useCallback(
    async (email: string, password: string) => {
      await amplifySignIn({ username: email, password });
      await refresh();
    },
    [refresh],
  );

  const signUp = useCallback(async (email: string, password: string) => {
    await amplifySignUp({
      username: email,
      password,
      options: { userAttributes: { email } },
    });
  }, []);

  const confirmEmail = useCallback(async (email: string, code: string) => {
    await confirmSignUp({ username: email, confirmationCode: code });
  }, []);

  const resendConfirmationCode = useCallback(async (email: string) => {
    await resendSignUpCode({ username: email });
  }, []);

  const requestPasswordReset = useCallback(async (email: string) => {
    await resetPassword({ username: email });
  }, []);

  const confirmPasswordReset = useCallback(
    async (email: string, code: string, newPassword: string) => {
      await confirmResetPassword({
        username: email,
        confirmationCode: code,
        newPassword,
      });
    },
    [],
  );

  const signOut = useCallback(async () => {
    await amplifySignOut();
    setUser(null);
    setStatus("unauthenticated");
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      user,
      isReviewer: Boolean(
        user?.groups.includes("policy-reviewer") || user?.groups.includes("admin"),
      ),
      refresh,
      signIn,
      signUp,
      confirmEmail,
      resendConfirmationCode,
      requestPasswordReset,
      confirmPasswordReset,
      signOut,
    }),
    [
      status,
      user,
      refresh,
      signIn,
      signUp,
      confirmEmail,
      resendConfirmationCode,
      requestPasswordReset,
      confirmPasswordReset,
      signOut,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
