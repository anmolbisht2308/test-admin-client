"use client";

import { errorMessage, useAuth } from "@mockprep/api-client";
import { OPTION_LETTERS, solutionsResponseSchema, type SolutionsResponse } from "@mockprep/types";
import { Alert, Badge, Button, cn } from "@mockprep/ui";
import { QuestionRenderer } from "@mockprep/ui/question-renderer";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ReportDialog } from "@/components/results/report-dialog";
import { filterSolutions, formatMarks, responseLabel, type SolutionFilter } from "@/lib/results";
import { useRequireStudent } from "@/lib/use-require-student";

const FILTERS: { key: SolutionFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "wrong", label: "Wrong" },
  { key: "skipped", label: "Skipped" },
  { key: "marked", label: "Marked" },
];

const OUTCOME = {
  correct: { label: "Correct", variant: "success" },
  wrong: { label: "Wrong", variant: "destructive" },
  partial: { label: "Partly correct", variant: "secondary" },
  skipped: { label: "Skipped", variant: "outline" },
} as const;

/** One question at a time: your answer vs the key, the explanation, and how others did. */
export default function SolutionsPage() {
  const { attemptId } = useParams<{ attemptId: string }>();
  const user = useRequireStudent();
  const { api } = useAuth();
  const [data, setData] = useState<SolutionsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<SolutionFilter>("all");
  const [index, setIndex] = useState(0);
  const [lang, setLang] = useState<"en" | "hi">("en");
  const [reporting, setReporting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    api
      .request(`/api/attempts/${attemptId}/solutions`, { schema: solutionsResponseSchema })
      .then(setData)
      .catch((e: unknown) => setError(errorMessage(e)));
  }, [api, attemptId, user]);

  const items = useMemo(() => (data ? filterSolutions(data.items, filter) : []), [data, filter]);
  const item = items[Math.min(index, Math.max(0, items.length - 1))];

  async function toggleBookmark() {
    if (!item || !data) return;
    const next = !item.bookmarked;
    setData({
      ...data,
      items: data.items.map((i) =>
        i.questionId === item.questionId ? { ...i, bookmarked: next } : i,
      ),
    });
    try {
      if (next) {
        await api.request("/api/bookmarks", {
          method: "POST",
          body: { questionId: item.questionId, attemptId },
        });
      } else {
        await api.request(`/api/bookmarks/${item.questionId}`, { method: "DELETE" });
      }
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  if (error) return <Alert>{error}</Alert>;
  if (!data) return <p className="text-sm text-muted-foreground">Loading…</p>;
  const pick = (en: string, hi: string) => (lang === "hi" && hi.trim() ? hi : en);

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <Link
            href={`/results/${attemptId}`}
            className="text-sm text-muted-foreground hover:underline"
          >
            ← Result
          </Link>
          <h1 className="text-xl font-bold tracking-tight">Solutions · {data.title}</h1>
        </div>
        <select
          aria-label="Language"
          value={lang}
          onChange={(e) => setLang(e.target.value === "hi" ? "hi" : "en")}
          className="h-10 rounded-md border bg-background px-2 text-sm"
        >
          <option value="en">English</option>
          <option value="hi">हिन्दी</option>
        </select>
      </header>

      <div role="tablist" aria-label="Show" className="flex gap-1 overflow-x-auto">
        {FILTERS.map((f) => {
          const count = filterSolutions(data.items, f.key).length;
          return (
            <button
              key={f.key}
              type="button"
              role="tab"
              aria-selected={filter === f.key}
              onClick={() => {
                setFilter(f.key);
                setIndex(0);
              }}
              className={cn(
                "h-10 shrink-0 rounded-md px-3 text-sm",
                filter === f.key ? "bg-primary text-primary-foreground" : "border hover:bg-muted",
              )}
            >
              {f.label} ({count})
            </button>
          );
        })}
      </div>

      {notice && <Alert variant="success">{notice}</Alert>}

      {!item ? (
        <p className="text-sm text-muted-foreground">No questions here.</p>
      ) : (
        <article className="flex flex-col gap-4 rounded-xl border p-4">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="font-semibold">
              {item.section} · Q{item.number}
            </span>
            <Badge variant={OUTCOME[item.outcome].variant}>{OUTCOME[item.outcome].label}</Badge>
            <span className="text-muted-foreground">
              {formatMarks(item.marks)} marks · {Math.round(item.timeMs / 1000)} s
            </span>
            {item.correctPercent !== null && (
              <span className="text-muted-foreground">
                · {Math.round(item.correctPercent)}% got it right
              </span>
            )}
            <span className="ml-auto flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => void toggleBookmark()}
                aria-pressed={item.bookmarked}
              >
                {item.bookmarked ? "★ Saved" : "☆ Save for revision"}
              </Button>
            </span>
          </div>

          {pick(item.passage, item.passageHi).trim() && (
            <div className="max-h-64 overflow-y-auto rounded-md bg-muted/50 p-3 text-sm">
              <QuestionRenderer content={pick(item.passage, item.passageHi)} lang={lang} />
            </div>
          )}
          <QuestionRenderer
            content={pick(item.stem, item.stemHi)}
            lang={lang}
            className="text-base"
          />
          {item.figureUrl && (
            // eslint-disable-next-line @next/next/no-img-element -- uploaded figure
            <img
              src={item.figureUrl}
              alt="Figure for this question"
              className="max-h-72 max-w-full self-start rounded border bg-white object-contain"
            />
          )}

          {item.options.length > 0 ? (
            <ul className="flex flex-col gap-2">
              {item.options.map((opt, i) => {
                const isKey = item.correct.includes(i);
                const chosen = Array.isArray(item.yourResponse) && item.yourResponse.includes(i);
                return (
                  <li
                    key={i}
                    className={cn(
                      "flex items-start gap-3 rounded-md border p-3",
                      isKey && "border-[#1f9d55] bg-[#1f9d55]/10",
                      chosen && !isKey && "border-[#e05545] bg-[#e05545]/10",
                    )}
                  >
                    <span className="font-semibold">{OPTION_LETTERS[i]}</span>
                    <QuestionRenderer
                      content={pick(opt, item.optionsHi[i] ?? "")}
                      lang={lang}
                      className="min-w-0 flex-1"
                    />
                    {isKey && <span className="text-xs font-semibold text-[#1f9d55]">Correct</span>}
                    {chosen && <span className="text-xs text-muted-foreground">Your answer</span>}
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-sm">
              Your answer: <b>{responseLabel(item.yourResponse)}</b> · Correct:{" "}
              <b>
                {item.numAnswer
                  ? item.numAnswer.min === item.numAnswer.max
                    ? item.numAnswer.min
                    : `${item.numAnswer.min} to ${item.numAnswer.max}`
                  : "–"}
              </b>
            </p>
          )}
          {item.options.length > 0 && (
            <p className="text-sm text-muted-foreground">
              Your answer: {responseLabel(item.yourResponse)}
            </p>
          )}

          {pick(item.solution, item.solutionHi).trim() && (
            <div className="rounded-md border border-dashed p-3">
              <p className="mb-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">
                Explanation
              </p>
              <QuestionRenderer content={pick(item.solution, item.solutionHi)} lang={lang} />
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => setReporting(true)}
              className="text-sm text-muted-foreground underline-offset-4 hover:underline"
            >
              Report an error
            </button>
            <div className="flex gap-2">
              <Button
                variant="outline"
                disabled={index === 0}
                onClick={() => setIndex((i) => i - 1)}
              >
                Previous
              </Button>
              <span className="self-center text-sm text-muted-foreground tabular-nums">
                {Math.min(index, items.length - 1) + 1}/{items.length}
              </span>
              <Button disabled={index >= items.length - 1} onClick={() => setIndex((i) => i + 1)}>
                Next
              </Button>
            </div>
          </div>
        </article>
      )}

      {reporting && item && (
        <ReportDialog
          questionId={item.questionId}
          attemptId={attemptId}
          onClose={(sent) => {
            setReporting(false);
            if (sent) setNotice("Thanks! We'll check this question.");
          }}
        />
      )}
    </div>
  );
}
