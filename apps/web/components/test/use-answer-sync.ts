"use client";

import { isApiError, useAuth } from "@mockprep/api-client";
import { answerSaveResponseSchema } from "@mockprep/types";
import { useCallback, useEffect, useRef } from "react";
import { clockFrom, unsynced } from "@/lib/test-engine/engine";
import { useTestStore } from "@/lib/test-engine/store";

const EVERY_MS = 5000;

/**
 * Sends changed answers every 5 s, on section change, when the device comes back online and on
 * demand (`sync(true)` also refreshes the clock when nothing changed). Answers stay on the device
 * (IndexedDB) until the server has them.
 */
export function useAnswerSync(onClosed: () => void) {
  const { api } = useAuth();
  const inflight = useRef<Promise<void> | null>(null);

  const run = useCallback(
    async (force: boolean) => {
      const { s, markSynced, applyClock, setSync } = useTestStore.getState();
      if (!s || s.clock.status !== "in_progress") return;
      const entries = unsynced(s);
      if (entries.length === 0 && !force) {
        setSync(typeof navigator !== "undefined" && !navigator.onLine ? "offline" : "saved");
        return;
      }
      setSync("saving");
      try {
        const res = await api.request(`/api/attempts/${s.attemptId}/answers`, {
          method: "PATCH",
          body: { answers: entries },
          schema: answerSaveResponseSchema,
        });
        markSynced(entries);
        applyClock(clockFrom(res));
        setSync("saved");
        if (res.status !== "in_progress") onClosed();
      } catch (e) {
        if (isApiError(e) && e.status === 409) {
          // Submitted elsewhere or time is up: the attempt is closed.
          setSync("saved");
          onClosed();
        } else if (isApiError(e)) {
          setSync("error");
        } else {
          setSync("offline");
        }
      }
    },
    [api, onClosed],
  );

  const sync = useCallback(
    (force = false) => {
      inflight.current ??= run(force).finally(() => {
        inflight.current = null;
      });
      return inflight.current;
    },
    [run],
  );

  useEffect(() => {
    const id = setInterval(() => void sync(), EVERY_MS);
    const online = () => void sync();
    window.addEventListener("online", online);
    window.addEventListener("offline", () => useTestStore.getState().setSync("offline"));
    // Sync right away when the section changes.
    let section = useTestStore.getState().s?.position.section;
    const unsubscribe = useTestStore.subscribe((st) => {
      const next = st.s?.position.section;
      if (next !== section) {
        section = next;
        void sync();
      }
    });
    // Best effort when the tab is hidden (phone locked, app switched).
    const hidden = () => {
      if (document.visibilityState === "hidden") void sync();
    };
    document.addEventListener("visibilitychange", hidden);
    return () => {
      clearInterval(id);
      window.removeEventListener("online", online);
      document.removeEventListener("visibilitychange", hidden);
      unsubscribe();
    };
  }, [sync]);

  return sync;
}
