"use client";

import type { AttemptStartResponse } from "@mockprep/types";
import { create } from "zustand";
import {
  applyClock,
  choose,
  clearResponse,
  goTo,
  initialState,
  markAndNext,
  markSynced,
  saveAndNext,
  typeNumeric,
  type Clock,
  type EngineState,
  type Position,
} from "./engine";
import { idbDelete, idbGet, idbSet } from "./idb";
import type { AnswerEntry } from "@mockprep/types";

export type SyncStatus = "saved" | "saving" | "offline" | "error";

/** What is kept on the device between reloads. */
export type LocalCopy = Pick<
  EngineState,
  "answers" | "position" | "language" | "instructionsAccepted"
>;

const key = (attemptId: string) => `attempt:${attemptId}`;

interface TestStore {
  s: EngineState | null;
  sync: SyncStatus;
  lastSavedAt: number | null;
  load(start: AttemptStartResponse): Promise<void>;
  choose(option: number): void;
  typeNumeric(value: string): void;
  saveAndNext(): void;
  markAndNext(): void;
  clear(): void;
  goTo(p: Position): void;
  setLanguage(lang: "en" | "hi"): void;
  applyClock(clock: Clock): void;
  markSynced(sent: AnswerEntry[]): void;
  setSync(status: SyncStatus): void;
  forget(): Promise<void>;
}

export const useTestStore = create<TestStore>((set, get) => {
  const update = (fn: (s: EngineState) => EngineState) => {
    const s = get().s;
    if (s) set({ s: fn(s) });
  };
  return {
    s: null,
    sync: "saved",
    lastSavedAt: null,
    async load(start) {
      const local = await idbGet<LocalCopy>(key(start.attempt.id));
      set({ s: initialState(start, local ?? null), sync: "saved" });
    },
    choose: (option) => update((s) => choose(s, option)),
    typeNumeric: (value) => update((s) => typeNumeric(s, value)),
    saveAndNext: () => update((s) => saveAndNext(s)),
    markAndNext: () => update((s) => markAndNext(s)),
    clear: () => update((s) => clearResponse(s)),
    goTo: (p) => update((s) => goTo(s, p)),
    setLanguage: (language) => update((s) => ({ ...s, language })),
    applyClock: (clock) => update((s) => applyClock(s, clock)),
    markSynced: (sent) => {
      update((s) => markSynced(s, sent));
      set({ lastSavedAt: Date.now() });
    },
    setSync: (sync) => set({ sync }),
    async forget() {
      const s = get().s;
      if (s) await idbDelete(key(s.attemptId));
    },
  };
});

// Mirror every change to IndexedDB (answers, position, language).
let lastWritten: LocalCopy | null = null;
useTestStore.subscribe(({ s }) => {
  if (!s) return;
  const copy: LocalCopy = {
    answers: s.answers,
    position: s.position,
    language: s.language,
    instructionsAccepted: s.instructionsAccepted,
  };
  if (
    lastWritten &&
    lastWritten.answers === copy.answers &&
    lastWritten.position === copy.position &&
    lastWritten.language === copy.language
  ) {
    return;
  }
  lastWritten = copy;
  void idbSet(key(s.attemptId), copy);
});
