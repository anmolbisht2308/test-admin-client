"use client";

import { OPTION_LETTERS, questionStatsResponseSchema } from "@mockprep/types";
import { Card, CardContent, CardHeader, CardTitle } from "@mockprep/ui";
import { formatIst } from "@/lib/format";
import { useApiQuery } from "@/lib/use-api-query";

/** Nightly statistics for a question (attempts, accuracy, time, option split, discrimination). */
export function QuestionStatsCard({
  questionId,
  correct,
}: {
  questionId: string;
  correct: number[];
}) {
  const { data } = useApiQuery(
    `/api/admin/questions/${questionId}/stats`,
    questionStatsResponseSchema,
  );
  const s = data?.stats;
  if (!s) return null;
  const max = Math.max(1, ...s.optionSplit);
  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle className="text-base">How students did</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 text-sm">
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          {[
            ["Attempts", String(s.attempts)],
            ["Accuracy", `${s.accuracy}%`],
            ["Avg time", `${Math.round(s.avgTimeMs / 1000)} s`],
            ["Skipped", String(s.skipped)],
            ["Discrimination", s.discrimination === null ? "–" : s.discrimination.toFixed(2)],
          ].map(([k, v]) => (
            <div key={k} className="rounded-md border p-2">
              <dt className="text-xs text-muted-foreground">{k}</dt>
              <dd className="font-semibold tabular-nums">{v}</dd>
            </div>
          ))}
        </dl>
        {s.optionSplit.length > 0 && (
          <ul className="flex flex-col gap-1" aria-label="Option split">
            {s.optionSplit.map((n, i) => (
              <li key={i} className="flex items-center gap-2">
                <span className="w-4 font-semibold">{OPTION_LETTERS[i]}</span>
                <span
                  className="h-3 rounded bg-primary/70"
                  style={{ width: `${(n / max) * 60}%`, opacity: correct.includes(i) ? 1 : 0.45 }}
                />
                <span className="tabular-nums text-muted-foreground">
                  {n}
                  {correct.includes(i) ? " (key)" : ""}
                </span>
              </li>
            ))}
          </ul>
        )}
        <p className="text-xs text-muted-foreground">
          Updated {formatIst(s.computedAt)} (every night).
        </p>
      </CardContent>
    </Card>
  );
}
