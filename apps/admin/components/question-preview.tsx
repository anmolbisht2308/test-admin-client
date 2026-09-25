"use client";

import { isNumericType, type QuestionInput } from "@mockprep/types";
import { cn } from "@mockprep/ui";
import { QuestionRenderer } from "@mockprep/ui/question-renderer";
import { letter } from "@/lib/format";

export interface PreviewQuestion {
  type: QuestionInput["type"];
  passage?: string | undefined;
  passageHi?: string | undefined;
  stem?: string | undefined;
  stemHi?: string | undefined;
  options?: string[] | undefined;
  optionsHi?: string[] | undefined;
  figureUrl?: string | null | undefined;
  hasFigure?: boolean | undefined;
  correct?: number[] | undefined;
  numAnswer?: { min: number; max: number } | null | undefined;
  solution?: string | undefined;
  solutionHi?: string | undefined;
}

/**
 * The question as a student sees it. With `showAnswer`, marks the correct option(s) and shows
 * the solution (admin preview only). `onOptionClick` lets editors click an option to mark it correct.
 */
export function QuestionPreview({
  question,
  language = "en",
  showAnswer = false,
  onOptionClick,
}: {
  question: PreviewQuestion;
  language?: "en" | "hi";
  showAnswer?: boolean;
  onOptionClick?: (index: number) => void;
}) {
  const hi = language === "hi";
  const pick = (en = "", hin = "") => (hi && hin.trim() ? hin : en);
  const passage = pick(question.passage, question.passageHi);
  const stem = pick(question.stem, question.stemHi);
  const options = (question.options ?? []).map((o, i) => pick(o, question.optionsHi?.[i]));
  const correct = new Set(question.correct ?? []);
  const lang = hi ? "hi" : "en";

  return (
    <div className="flex flex-col gap-4">
      {passage.trim() && (
        <div className="max-h-64 overflow-y-auto rounded-md border bg-muted/40 p-3 text-sm">
          <QuestionRenderer content={passage} lang={lang} />
        </div>
      )}
      {stem.trim() ? (
        <QuestionRenderer content={stem} lang={lang} />
      ) : (
        <p className="text-sm text-muted-foreground italic">No question text yet.</p>
      )}
      {question.figureUrl && (
        // eslint-disable-next-line @next/next/no-img-element -- user-uploaded figure (local or S3)
        <img
          src={question.figureUrl}
          alt="Question figure"
          className="max-h-72 max-w-full self-start rounded border bg-white object-contain"
        />
      )}
      {question.hasFigure && !question.figureUrl && (
        <p className="text-sm text-destructive">Figure missing: upload it before approving.</p>
      )}

      {isNumericType(question.type) ? (
        <div className="flex items-center gap-2 text-sm">
          <span className="inline-flex h-11 w-40 items-center rounded-md border px-3 text-muted-foreground">
            Enter your answer
          </span>
          {showAnswer && question.numAnswer && (
            <span className="text-success">
              Answer:{" "}
              {question.numAnswer.min === question.numAnswer.max
                ? question.numAnswer.min
                : `${question.numAnswer.min} to ${question.numAnswer.max}`}
            </span>
          )}
        </div>
      ) : (
        <ol className="flex flex-col gap-2">
          {options.map((option, i) => {
            const isCorrect = showAnswer && correct.has(i);
            const content = (
              <>
                <span
                  className={cn(
                    "inline-flex size-7 shrink-0 items-center justify-center rounded-full border text-xs font-semibold",
                    isCorrect && "border-success bg-success text-success-foreground",
                  )}
                >
                  {letter(i)}
                </span>
                <span className="min-w-0 flex-1 text-left">
                  {option.trim() ? (
                    <QuestionRenderer content={option} lang={lang} />
                  ) : (
                    <span className="text-muted-foreground italic">empty</span>
                  )}
                </span>
              </>
            );
            const className = cn(
              "flex min-h-11 w-full items-start gap-3 rounded-md border p-2 text-sm",
              isCorrect && "border-success bg-success/10",
            );
            return (
              <li key={i}>
                {onOptionClick ? (
                  <button
                    type="button"
                    onClick={() => onOptionClick(i)}
                    className={cn(className, "hover:bg-muted")}
                    aria-pressed={correct.has(i)}
                    title="Click to mark as correct"
                  >
                    {content}
                  </button>
                ) : (
                  <div className={className}>{content}</div>
                )}
              </li>
            );
          })}
        </ol>
      )}

      {showAnswer && pick(question.solution, question.solutionHi).trim() && (
        <div className="rounded-md border border-dashed p-3 text-sm">
          <p className="mb-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">
            Solution
          </p>
          <QuestionRenderer content={pick(question.solution, question.solutionHi)} lang={lang} />
        </div>
      )}
    </div>
  );
}
