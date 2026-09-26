"use client";

import type { QuestionState } from "@mockprep/types";
import { cn } from "@mockprep/ui";
import type { ReactNode } from "react";
import { paletteCounts, stateOf, type EngineState, type Position } from "@/lib/test-engine/engine";

export const STATE_LABELS: Record<QuestionState, string> = {
  not_visited: "Not Visited",
  not_answered: "Not Answered",
  answered: "Answered",
  marked: "Marked for Review",
  answered_marked: "Answered & Marked for Review (will be evaluated)",
};

/** The standard CBT palette marks: grey, red, green, purple, purple with a green tick. */
export function StateMark({
  state,
  children,
  className,
}: {
  state: QuestionState;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "relative inline-flex items-center justify-center text-sm font-semibold tabular-nums",
        state === "not_visited" &&
          "rounded-md border border-neutral-300 bg-neutral-100 text-neutral-800",
        state === "not_answered" && "rounded-t-md rounded-b-2xl bg-[#d7412f] text-white",
        state === "answered" && "rounded-t-2xl rounded-b-md bg-[#2e9e4f] text-white",
        (state === "marked" || state === "answered_marked") &&
          "rounded-full bg-[#6b3fa0] text-white",
        className,
      )}
    >
      {children}
      {state === "answered_marked" && (
        <span className="absolute -right-1 -bottom-1 inline-flex size-4 items-center justify-center rounded-full bg-[#2e9e4f] ring-2 ring-background">
          <svg
            viewBox="0 0 24 24"
            className="size-3"
            fill="none"
            stroke="white"
            strokeWidth="4"
            aria-hidden
          >
            <path d="M5 12l5 5 9-10" />
          </svg>
        </span>
      )}
    </span>
  );
}

export function PaletteLegend({ s, section }: { s: EngineState; section: number }) {
  const counts = paletteCounts(s, section);
  return (
    <ul className="grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
      {(Object.keys(STATE_LABELS) as QuestionState[]).map((state) => (
        <li
          key={state}
          className={cn("flex items-center gap-2", state === "answered_marked" && "col-span-2")}
        >
          <StateMark state={state} className="size-8 shrink-0">
            {counts[state]}
          </StateMark>
          <span>{STATE_LABELS[state]}</span>
        </li>
      ))}
    </ul>
  );
}

/** Question numbers of one section, coloured by state. */
export function PaletteGrid({
  s,
  section,
  onPick,
}: {
  s: EngineState;
  section: number;
  onPick: (p: Position) => void;
}) {
  const questions = s.paper.sections[section]?.questions ?? [];
  return (
    <ol className="grid grid-cols-5 gap-2" aria-label="Question palette">
      {questions.map((q, index) => {
        const state = stateOf(s, q.id);
        const current = s.position.section === section && s.position.index === index;
        return (
          <li key={q.id}>
            <button
              type="button"
              onClick={() => onPick({ section, index })}
              aria-label={`Question ${index + 1}: ${STATE_LABELS[state]}`}
              aria-current={current ? "step" : undefined}
              className={cn(
                "block size-11 rounded-md",
                current && "ring-2 ring-[var(--tx-primary)] ring-offset-2",
              )}
            >
              <StateMark state={state} className="size-11">
                {index + 1}
              </StateMark>
            </button>
          </li>
        );
      })}
    </ol>
  );
}
