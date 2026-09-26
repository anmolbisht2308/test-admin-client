"use client";

import { errorMessage, useAuth } from "@mockprep/api-client";
import { attemptClockSchema } from "@mockprep/types";
import { cn } from "@mockprep/ui";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import {
  canOpenSection,
  currentQuestion,
  locked,
  markingFor,
  nextPosition,
  paletteCounts,
  previousPosition,
  shownResponse,
  unsynced,
} from "@/lib/test-engine/engine";
import { useTestStore, type SyncStatus } from "@/lib/test-engine/store";
import { PaletteGrid, PaletteLegend } from "./palette";
import { QuestionView } from "./question-view";
import { SKINS, skinStyle } from "./skins";
import { SubmitDialog } from "./submit-dialog";
import { Timer } from "./timer";
import { useAnswerSync } from "./use-answer-sync";

const SYNC_TEXT: Record<SyncStatus, string> = {
  saved: "Saved",
  saving: "Saving…",
  offline: "Offline — answers kept on device",
  error: "Not saved — retrying",
};

function SyncBadge() {
  const sync = useTestStore((st) => st.sync);
  return (
    <span
      role="status"
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs whitespace-nowrap",
        sync === "offline" || sync === "error" ? "bg-amber-400 text-black" : "bg-white/15",
      )}
    >
      <span
        className={cn(
          "size-2 rounded-full",
          sync === "saved" && "bg-[#4ade80]",
          sync === "saving" && "animate-pulse bg-white",
          (sync === "offline" || sync === "error") && "bg-red-600",
        )}
        aria-hidden
      />
      {SYNC_TEXT[sync]}
    </span>
  );
}

/** The full-screen CBT interface. */
export function ExamScreen() {
  const { api } = useAuth();
  const router = useRouter();
  const s = useTestStore((st) => st.s);
  const store = useTestStore.getState();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [submitting, setSubmitting] = useState<"manual" | "timeout" | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const attemptId = s?.attemptId;
  const toResult = useCallback(() => {
    if (!attemptId) return;
    void useTestStore.getState().forget();
    router.replace(`/results/${attemptId}`);
  }, [attemptId, router]);

  const sync = useAnswerSync(toResult);

  /** Sends the last answers with the submit. Retries while offline when the time is up. */
  const submit = useCallback(
    async (reason: "manual" | "timeout") => {
      const current = useTestStore.getState().s;
      if (!current) return;
      setSubmitting(reason);
      setSubmitError(null);
      for (;;) {
        try {
          await api.request(`/api/attempts/${current.attemptId}/submit`, {
            method: "POST",
            body: { answers: unsynced(useTestStore.getState().s ?? current) },
            schema: attemptClockSchema,
          });
          toResult();
          return;
        } catch (e) {
          setSubmitError(errorMessage(e));
          if (reason === "manual") {
            setSubmitting(null);
            return;
          }
          await new Promise((r) => setTimeout(r, 5000));
        }
      }
    },
    [api, toResult],
  );

  // Warn before leaving with answers that haven't reached the server yet.
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      const current = useTestStore.getState().s;
      if (current && unsynced(current).length > 0) e.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, []);

  if (!s) return null;
  const q = currentQuestion(s);
  const skin = SKINS[s.paper.template.skin];
  const section = s.position.section;
  const isLocked = locked(s);
  const counts = paletteCounts(s, section);
  const move = (dir: 1 | -1) => {
    const p = dir === 1 ? nextPosition(s) : previousPosition(s);
    if (p) store.goTo(p);
  };

  const paletteBody = (
    <div className="flex flex-col gap-4">
      <PaletteLegend s={s} section={section} />
      <div>
        <p className="mb-2 rounded bg-[var(--tx-header)] px-2 py-1 text-sm font-medium text-[var(--tx-header-fg)]">
          {s.paper.sections[section]?.name}
        </p>
        <PaletteGrid
          s={s}
          section={section}
          onPick={(p) => {
            store.goTo(p);
            setPaletteOpen(false);
          }}
        />
      </div>
      <button
        type="button"
        onClick={() => {
          setPaletteOpen(false);
          setConfirming(true);
        }}
        className="h-11 rounded-md bg-[var(--tx-primary)] font-semibold text-white"
      >
        {skin.labels.submit}
      </button>
    </div>
  );

  return (
    <div
      style={skinStyle(skin)}
      className="fixed inset-0 flex flex-col bg-background text-foreground"
    >
      <header className="flex items-center gap-2 bg-[var(--tx-header)] px-3 py-2 text-[var(--tx-header-fg)]">
        <h1 className="min-w-0 flex-1 truncate text-sm font-semibold sm:text-base">
          {s.paper.title}
        </h1>
        <span className="hidden sm:inline">
          <SyncBadge />
        </span>
        <select
          aria-label="Question language"
          value={s.language}
          onChange={(e) => store.setLanguage(e.target.value === "hi" ? "hi" : "en")}
          className="h-9 rounded bg-white/15 px-2 text-sm text-[var(--tx-header-fg)] [&>option]:text-black"
        >
          <option value="en">English</option>
          <option value="hi">हिन्दी</option>
        </select>
        <Timer onSectionEnd={() => void sync(true)} onTimeUp={() => void submit("timeout")} />
      </header>
      <div className="border-b px-3 py-1 sm:hidden">
        <SyncBadge />
      </div>

      <nav
        aria-label="Sections"
        className="flex gap-1 overflow-x-auto border-b bg-muted/40 px-2 py-1"
      >
        {s.paper.sections.map((sec, i) => {
          const open = canOpenSection(s, i);
          const c = paletteCounts(s, i);
          return (
            <button
              key={sec.name}
              type="button"
              disabled={!open}
              aria-current={i === section ? "true" : undefined}
              onClick={() => store.goTo({ section: i, index: 0 })}
              title={open ? undefined : isLocked ? "This section is locked" : undefined}
              className={cn(
                "h-10 shrink-0 rounded-md px-3 text-sm whitespace-nowrap",
                i === section
                  ? "bg-[var(--tx-primary)] font-semibold text-white"
                  : "hover:bg-muted",
                !open && "cursor-not-allowed opacity-50",
              )}
            >
              {sec.name}
              <span className="ml-1 text-xs opacity-80">
                ({c.answered + c.answered_marked}/{sec.questions.length})
              </span>
            </button>
          );
        })}
      </nav>

      <div className="flex min-h-0 flex-1">
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
            {q ? (
              <QuestionView
                key={q.id}
                q={q}
                number={s.position.index + 1}
                response={shownResponse(s)}
                language={s.language}
                marking={markingFor(s.paper.template, q.type)}
                onChoose={store.choose}
                onType={store.typeNumeric}
                onSwipe={move}
              />
            ) : (
              <p className="p-4 text-sm text-muted-foreground">This section has no questions.</p>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2 border-t bg-muted/40 p-2 sm:flex sm:flex-wrap sm:items-center">
            <button
              type="button"
              onClick={store.markAndNext}
              className="h-11 rounded-md bg-[var(--tx-mark)] px-3 text-sm font-semibold text-white"
            >
              {skin.labels.mark}
            </button>
            <button
              type="button"
              onClick={store.clear}
              className="h-11 rounded-md border bg-background px-3 text-sm font-medium"
            >
              {skin.labels.clear}
            </button>
            <button
              type="button"
              onClick={() => move(-1)}
              disabled={!previousPosition(s)}
              className="h-11 rounded-md border bg-background px-3 text-sm font-medium disabled:opacity-40 sm:ml-auto"
            >
              {skin.labels.previous}
            </button>
            <button
              type="button"
              onClick={store.saveAndNext}
              className="h-11 rounded-md bg-[var(--tx-primary)] px-4 text-sm font-semibold text-white"
            >
              {skin.labels.save}
            </button>
            <button
              type="button"
              onClick={() => setPaletteOpen(true)}
              className="col-span-2 h-11 rounded-md border bg-background text-sm font-medium lg:hidden"
            >
              Question palette · {counts.answered + counts.answered_marked} answered ·{" "}
              {skin.labels.submit}
            </button>
          </div>
        </div>
        <aside
          className="hidden w-80 shrink-0 overflow-y-auto border-l p-4 lg:block"
          aria-label="Question palette"
        >
          {paletteBody}
        </aside>
      </div>

      {paletteOpen && (
        <div
          className="fixed inset-0 z-40 flex items-end bg-black/40 lg:hidden"
          onClick={() => setPaletteOpen(false)}
        >
          <div
            role="dialog"
            aria-label="Question palette"
            className="max-h-[80dvh] w-full overflow-y-auto rounded-t-xl bg-background p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-muted-foreground/30"
              aria-hidden
            />
            {paletteBody}
          </div>
        </div>
      )}

      {confirming && (
        <SubmitDialog
          s={s}
          busy={submitting !== null}
          error={submitError}
          onCancel={() => setConfirming(false)}
          onConfirm={() => void submit("manual")}
        />
      )}
      {submitting === "timeout" && (
        <div
          role="alertdialog"
          aria-live="assertive"
          className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4"
        >
          <div className="max-w-sm rounded-xl bg-background p-6 text-center">
            <p className="text-lg font-semibold">Time is up</p>
            <p className="mt-2 text-sm text-muted-foreground">
              {submitError
                ? `Submitting as soon as you are back online… (${submitError})`
                : "Submitting your answers…"}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
