import { authSessionResponseSchema, type AuthSessionResponse } from "@mockprep/types";
import type { z } from "zod";
import { ApiError } from "./errors";

export interface ApiClientOptions {
  /** e.g. "/api/auth/refresh" (student) or "/api/admin/auth/refresh" (admin). */
  refreshPath: string;
  logoutPath: string;
  /** Called whenever the session changes (sign-in, refresh, sign-out). */
  onSession?: (session: AuthSessionResponse | null) => void;
  fetch?: typeof fetch;
}

export interface RequestOptions<S extends z.ZodType> {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  body?: unknown;
  /** Validates the response body. Omit for 204 responses. */
  schema?: S;
  /** Send the access token (default true). */
  auth?: boolean;
  signal?: AbortSignal;
}

/**
 * Fetch wrapper for same-origin `/api/*` calls (proxied to the api by Next rewrites).
 * - Access token lives in memory only; the refresh token is an httpOnly cookie.
 * - On 401 it refreshes once and retries. Refreshes are serialised in this tab (shared promise)
 *   and across tabs (Web Locks), because refresh tokens rotate: two concurrent refreshes would
 *   look like token reuse to the api.
 */
export function createApiClient(options: ApiClientOptions) {
  const doFetch = options.fetch ?? ((...args: Parameters<typeof fetch>) => fetch(...args));
  let accessToken: string | null = null;
  let inflight: Promise<AuthSessionResponse | null> | null = null;

  const setSession = (session: AuthSessionResponse | null) => {
    accessToken = session?.accessToken ?? null;
    options.onSession?.(session);
  };

  async function refreshOnce(): Promise<AuthSessionResponse | null> {
    const run = async () => {
      const res = await doFetch(options.refreshPath, {
        method: "POST",
        credentials: "same-origin",
      });
      if (res.status === 401) return null;
      if (!res.ok) throw await ApiError.fromResponse(res);
      return authSessionResponseSchema.parse(await res.json());
    };
    const locks = typeof navigator !== "undefined" ? navigator.locks : undefined;
    const session = locks
      ? await locks.request(`mockprep:${options.refreshPath}`, run)
      : await run();
    setSession(session);
    return session;
  }

  /** Refreshes the session (deduplicated). Resolves null when signed out. */
  function refresh(): Promise<AuthSessionResponse | null> {
    inflight ??= refreshOnce().finally(() => {
      inflight = null;
    });
    return inflight;
  }

  async function request<S extends z.ZodType = z.ZodUnknown>(
    path: string,
    { method = "GET", body, schema, auth = true, signal }: RequestOptions<S> = {},
  ): Promise<z.infer<S>> {
    const send = () => {
      const headers: Record<string, string> = { accept: "application/json" };
      if (body !== undefined) headers["content-type"] = "application/json";
      if (auth && accessToken) headers.authorization = `Bearer ${accessToken}`;
      return doFetch(path, {
        method,
        headers,
        credentials: "same-origin",
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        ...(signal ? { signal } : {}),
      });
    };

    let res = await send();
    if (res.status === 401 && auth) {
      const session = await refresh();
      if (session) res = await send();
    }
    if (!res.ok) throw await ApiError.fromResponse(res);
    if (res.status === 204 || !schema) return undefined as z.infer<S>;
    return schema.parse(await res.json()) as z.infer<S>;
  }

  async function signOut() {
    try {
      await doFetch(options.logoutPath, { method: "POST", credentials: "same-origin" });
    } finally {
      setSession(null);
    }
  }

  return {
    request,
    refresh,
    signOut,
    /** Call with the response of a sign-in endpoint. */
    setSession,
    getAccessToken: () => accessToken,
  };
}

export type ApiClient = ReturnType<typeof createApiClient>;
