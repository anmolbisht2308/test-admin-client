"use client";

import type { AuthSessionResponse, User } from "@mockprep/types";
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { createApiClient, type ApiClient } from "./client";

export type AuthState =
  | { status: "loading"; user: null }
  | { status: "signed_in"; user: User }
  | { status: "signed_out"; user: null };

interface AuthContextValue {
  state: AuthState;
  api: ApiClient;
  /** Replace the user after a profile update. */
  setUser: (user: User) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export interface AuthProviderProps {
  refreshPath: string;
  logoutPath: string;
  children: ReactNode;
}

/** Restores the session from the refresh cookie on load and exposes an authed api client. */
export function AuthProvider({ refreshPath, logoutPath, children }: AuthProviderProps) {
  const [state, setState] = useState<AuthState>({ status: "loading", user: null });

  const api = useMemo(
    () =>
      createApiClient({
        refreshPath,
        logoutPath,
        onSession: (session: AuthSessionResponse | null) =>
          setState(
            session
              ? { status: "signed_in", user: session.user }
              : { status: "signed_out", user: null },
          ),
      }),
    [refreshPath, logoutPath],
  );

  useEffect(() => {
    api.refresh().catch(() => setState({ status: "signed_out", user: null }));
  }, [api]);

  const value = useMemo<AuthContextValue>(
    () => ({ state, api, setUser: (user) => setState({ status: "signed_in", user }) }),
    [state, api],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside <AuthProvider>");
  return value;
}
