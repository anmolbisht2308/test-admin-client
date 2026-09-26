"use client";

import { useAuth } from "@mockprep/api-client";
import { accessResponseSchema, type AccessResponse } from "@mockprep/types";
import { useEffect } from "react";
import { create } from "zustand";

/*
 * What the signed-in student can open, shared by every test card, the start page and checkout.
 * A purchase updates it in place (and other tabs through a BroadcastChannel), so locked mocks
 * unlock without a page refresh.
 */
interface AccessState {
  access: AccessResponse | null;
  userId: string | null;
  loading: boolean;
  set: (access: AccessResponse, broadcast?: boolean) => void;
}

const channel =
  typeof window !== "undefined" && "BroadcastChannel" in window
    ? new BroadcastChannel("mockprep:access")
    : null;

export const useAccessStore = create<AccessState>((set) => ({
  access: null,
  userId: null,
  loading: false,
  set: (access, broadcast = true) => {
    set({ access });
    if (broadcast) channel?.postMessage(access);
  },
}));

channel?.addEventListener("message", (e: MessageEvent) => {
  const parsed = accessResponseSchema.safeParse(e.data);
  if (parsed.success) useAccessStore.getState().set(parsed.data, false);
});

/** Loads access once per signed-in student; null while loading or when signed out. */
export function useAccess(): AccessResponse | null {
  const { api, state } = useAuth();
  const access = useAccessStore((s) => s.access);
  const userId =
    state.status === "signed_in" && state.user.role === "student" ? state.user.id : null;

  useEffect(() => {
    const store = useAccessStore.getState();
    if (!userId) {
      if (store.userId) useAccessStore.setState({ access: null, userId: null });
      return;
    }
    if (store.userId === userId && (store.access || store.loading)) return;
    useAccessStore.setState({ userId, loading: true, access: null });
    api
      .request("/api/me/access", { schema: accessResponseSchema })
      .then((a) => useAccessStore.setState({ access: a }))
      .catch(() => useAccessStore.setState({ userId: null }))
      .finally(() => useAccessStore.setState({ loading: false }));
  }, [api, userId]);

  return userId ? access : null;
}
