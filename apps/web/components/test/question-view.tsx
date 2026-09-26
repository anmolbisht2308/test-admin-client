"use client";

import {
  OPTION_LETTERS,
  type AttemptResponse,
  type Marking,
  type StudentQuestion,
} from "@mockprep/types";
import { cn } from "@mockprep/ui";
import { QuestionRenderer } from "@mockprep/ui/question-renderer";
import { useRef } from "react";

const pick = (en: string, hi: string, lang: "en" | "hi") => (lang === "hi" && hi.trim() ? hi : en);

/** NTA-style on-screen keypad for integer / numeric answers (no phone keyboard popping up). */
export function Keypad({
  value,
  allowDecimal,
  onChange,
}: {
  value: string;
  allowDecimal: boolean;
  onChange: (v: string) => void;
}) {
  const keys = ["7", "8", "9", "4", "5", "6", "1", "2", "3", "-", "0", "."];
  return (
    <div className="flex w-full max-w-64 flex-col gap-2">
      <output
        aria-label="Your answer"
        className="flex h-12 items-center rounded-md border-2 bg-background px-3 font-mono text-lg"
      >
        {value || <span className="text-muted-foreground">Enter your answer</span>}
      </output>
      <div className="grid grid-cols-3 gap-2">
        {keys.map((k) => (
          <button
            key={k}
            type="button"
            disabled={(k === "." && !allowDecimal) || (k === "-" && value.length > 0)}
            onClick={() => onChange(value + k)}
            className="h-11 rounded-md border bg-muted text-base font-semibold active:bg-muted-foreground/20 disabled:opacity-40"
          >
            {k}
          </button>
        ))}
        <button
          type="button"
          onClick={() => onChange(value.slice(0, -1))}
          className="col-span-2 h-11 rounded-md border bg-muted text-sm font-medium"
        >
          Backspace
        </button>
        <button
          type="button"
          onClick={() => onChange("")}
          className="h-11 rounded-md border bg-muted text-sm font-medium"
        >
          Clear All
        </button>
      </div>
    </div>
  );
}

export function QuestionView({
  q,
  number,
  response,
  language,
  marking,
  onChoose,
  onType,
  onSwipe,
}: {
  q: StudentQuestion;
  number: number;
  response: AttemptResponse;
  language: "en" | "hi";
  marking: Marking;
  onChoose: (index: number) => void;
  onType: (value: string) => void;
  onSwipe: (dir: 1 | -1) => void;
}) {
  const touch = useRef<{ x: number; y: number } | null>(null);
  const passage = pick(q.passage, q.passageHi, language);
  const stem = pick(q.stem, q.stemHi, language);
  const chosen = Array.isArray(response) ? response : [];
  const numeric = q.type === "integer" || q.type === "numeric";
  const multi = q.type === "mcq_multi";

  const body = (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-2 text-sm">
        <span className="font-semibold">Question No. {number}</span>
        <span className="text-muted-foreground">
          Marks: <span className="text-[#2e9e4f]">+{marking.correct}</span>{" "}
          <span className="text-[#d7412f]">{marking.wrong}</span>
          {multi && " · one or more correct"}
          {numeric && " · type your answer"}
        </span>
      </div>
      <QuestionRenderer content={stem} lang={language} className="text-base leading-relaxed" />
      {q.figureUrl && (
        // eslint-disable-next-line @next/next/no-img-element -- uploaded figure (local or S3)
        <img
          src={q.figureUrl}
          alt="Figure for this question"
          className="max-h-80 max-w-full self-start rounded border bg-white object-contain"
        />
      )}
      {numeric ? (
        <Keypad
          value={typeof response === "string" ? response : ""}
          allowDecimal={q.type === "numeric"}
          onChange={onType}
        />
      ) : (
        <ul
          className="flex flex-col gap-2"
          role={multi ? "group" : "radiogroup"}
          aria-label="Options"
        >
          {q.options.map((opt, i) => {
            const on = chosen.includes(i);
            return (
              <li key={i}>
                <button
                  type="button"
                  role={multi ? "checkbox" : "radio"}
                  aria-checked={on}
                  onClick={() => onChoose(i)}
                  className={cn(
                    "flex min-h-11 w-full items-start gap-3 rounded-md border p-3 text-left text-base",
                    on ? "border-[var(--tx-primary)] bg-[var(--tx-primary)]/10" : "hover:bg-muted",
                  )}
                >
                  <span
                    className={cn(
                      "mt-0.5 inline-flex size-6 shrink-0 items-center justify-center border-2 text-xs font-bold",
                      multi ? "rounded" : "rounded-full",
                      on
                        ? "border-[var(--tx-primary)] bg-[var(--tx-primary)] text-white"
                        : "border-neutral-400",
                    )}
                  >
                    {OPTION_LETTERS[i]}
                  </span>
                  <QuestionRenderer
                    content={pick(opt, q.optionsHi[i] ?? "", language)}
                    lang={language}
                    className="min-w-0 flex-1"
                  />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );

  return (
    <div
      className={cn("min-h-0 flex-1", passage.trim() && "lg:grid lg:grid-cols-2 lg:divide-x")}
      onTouchStart={(e) => {
        const t = e.touches[0];
        touch.current = t ? { x: t.clientX, y: t.clientY } : null;
      }}
      onTouchEnd={(e) => {
        const start = touch.current;
        const t = e.changedTouches[0];
        touch.current = null;
        if (!start || !t) return;
        const dx = t.clientX - start.x;
        // A clear horizontal swipe (not a scroll) moves to the next / previous question.
        if (Math.abs(dx) > 70 && Math.abs(dx) > 2 * Math.abs(t.clientY - start.y))
          onSwipe(dx < 0 ? 1 : -1);
      }}
    >
      {passage.trim() && (
        <details
          open
          className="border-b p-4 lg:h-full lg:overflow-y-auto lg:border-b-0 [&[open]>summary]:mb-2"
        >
          <summary className="cursor-pointer text-sm font-semibold lg:hidden">
            Passage / Directions
          </summary>
          <QuestionRenderer content={passage} lang={language} className="text-sm leading-relaxed" />
        </details>
      )}
      <div className="p-4 lg:h-full lg:overflow-y-auto">{body}</div>
    </div>
  );
}
