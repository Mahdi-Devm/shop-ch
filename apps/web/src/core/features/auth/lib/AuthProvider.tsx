"use client";

import type { ApiFailure } from "@/core/lib/api/api-client";
import {
  createContext,
  useCallback,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import type { AuthSession } from "../assets/@types/auth.types";
import { requestLogin } from "../lib/auth-api";
import {
  getServerSession,
  getSession,
  setSession,
  subscribeToSession,
} from "../lib/session-store";

export type AuthContextValue = {
  session: AuthSession | null;
  isReady: boolean;
  login: (username: string, password: string) => Promise<ApiFailure | null>;
  logout: () => void;
};

export const AuthContext = createContext<AuthContextValue | null>(null);

function subscribeToNothing(): () => void {
  return () => undefined;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const session = useSyncExternalStore(
    subscribeToSession,
    getSession,
    getServerSession,
  );
  const isReady = useSyncExternalStore(
    subscribeToNothing,
    () => true,
    () => false,
  );

  const login = useCallback(async (username: string, password: string) => {
    const result = await requestLogin(username, password);
    if (!result.ok) {
      return result;
    }
    setSession({ token: result.data.access_token, userId: result.data.userId });
    return null;
  }, []);

  const logout = useCallback(() => setSession(null), []);

  const value = useMemo(
    () => ({ session, isReady, login, logout }),
    [session, isReady, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
