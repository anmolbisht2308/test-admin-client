"use client";

import type { PublicTestDetail, QuestionType } from "@mockprep/types";
import { Button } from "@mockprep/ui";
import { useState } from "react";
import { STATE_LABELS, StateMark } from "./palette";
import { SKINS, skinStyle } from "./skins";

const TYPE_NAMES: Record<QuestionType, string> = {
  mcq_single: "single-correct",
  mcq_multi: "multiple-correct",
  integer: "integer-answer",
  numeric: "numerical-answer",
};

const minutes = (sec: number) => `${Math.round(sec / 60)} min`;

/** General instructions, built only from the test's template. */
export function Instructions({
  test,
  busy,
  error,
  onBegin,
}: {
  test: PublicTestDetail;
  busy: boolean;
  error: string | null;
  onBegin: () => void;
}) {
  const [agreed, setAgreed] = useState(false);
  const t = test.template;
  const skin = SKINS[t.skin];
  const locked = t.sectionSwitching === "locked_sequential";
  return (
    <div style={skinStyle(skin)} className="flex min-h-dvh flex-col">
      <header className="bg-[var(--tx-header)] px-4 py-3 text-[var(--tx-header-fg)]">
        <h1 className="text-lg font-semibold">{test.title}</h1>
        <p className="text-sm opacity-80">General instructions: please read carefully</p>
      </header>
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-5 p-4 text-sm leading-relaxed">
        <ol className="flex list-decimal flex-col gap-2 pl-5">
          <li>
            The test has {test.questionCount} questions in {test.sectionCount} section
            {test.sectionCount > 1 ? "s" : ""} and lasts {minutes(t.totalTimeSec)}. The clock is
            kept by the server and shown at the top; the test is submitted automatically when it
            reaches zero.
          </li>
          <li>
            {locked
              ? "Each section has its own time limit and opens in order. When a section's time ends you move to the next one and can't go back."
              : "You can switch between sections at any time."}
          </li>
          <li>
            Each correct answer gets +{t.marking.correct} mark{t.marking.correct === 1 ? "" : "s"}
            {t.marking.wrong < 0
              ? `; each wrong answer ${t.marking.wrong}`
              : "; there is no negative marking"}
            . Unanswered questions get 0.
            {Object.entries(t.markingByType ?? {}).map(([type, m]) => (
              <span key={type}>
                {" "}
                For {TYPE_NAMES[type as QuestionType]} questions: +{m.correct} / {m.wrong}.
              </span>
            ))}
            {t.multiPartial &&
              " Multiple-correct questions give partial marks for each correct option chosen."}
          </li>
          {t.qualifyingPercent !== undefined && (
            <li>This paper is qualifying: you need {t.qualifyingPercent}% of the maximum marks.</li>
          )}
          <li>
            Choosing an option does not save it. Click <b>{skin.labels.save}</b> to save it and go
            to the next question, or <b>{skin.labels.mark}</b> to save it and mark it for review.{" "}
            <b>{skin.labels.clear}</b> removes your answer.
          </li>
          <li>
            Your answers are saved on this device and sent to the server every few seconds, so a
            lost connection or a refresh won&apos;t lose them.
          </li>
        </ol>

        <table className="w-full text-left">
          <thead>
            <tr className="border-b text-muted-foreground">
              <th className="py-1 font-medium">Section</th>
              <th className="py-1 text-right font-medium">Questions</th>
              {locked && <th className="py-1 text-right font-medium">Time</th>}
            </tr>
          </thead>
          <tbody>
            {test.sections.map((s) => (
              <tr key={s.name} className="border-b">
                <td className="py-1">{s.name}</td>
                <td className="py-1 text-right tabular-nums">{s.questionCount}</td>
                {locked && (
                  <td className="py-1 text-right tabular-nums">
                    {s.timeSec ? minutes(s.timeSec) : "–"}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>

        <section aria-labelledby="legend">
          <h2 id="legend" className="mb-2 font-semibold">
            Question palette
          </h2>
          <ul className="flex flex-col gap-2">
            {(Object.keys(STATE_LABELS) as (keyof typeof STATE_LABELS)[]).map((state) => (
              <li key={state} className="flex items-center gap-3">
                <StateMark state={state} className="size-8 shrink-0">
                  1
                </StateMark>
                {STATE_LABELS[state]}
              </li>
            ))}
          </ul>
        </section>

        <label className="flex min-h-11 items-start gap-3 rounded-md border p-3">
          <input
            type="checkbox"
            className="mt-1 size-5 shrink-0"
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
          />
          <span>
            I have read and understood the instructions. I will not use unfair means during the
            test.
          </span>
        </label>
        {error && (
          <p role="alert" className="text-destructive">
            {error}
          </p>
        )}
        <Button
          size="lg"
          disabled={!agreed || busy}
          onClick={onBegin}
          className="self-end bg-[var(--tx-primary)] text-white hover:bg-[var(--tx-primary)]/90"
        >
          {busy ? "Starting…" : "I am ready to begin"}
        </Button>
      </main>
    </div>
  );
}
