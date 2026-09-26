"use client";

import { errorMessage, useAuth } from "@mockprep/api-client";
import { attemptResultResponseSchema, type AttemptResultResponse } from "@mockprep/types";
import {
  Alert,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  TBody,
  TD,
  TH,
  THead,
  TR,
  Table,
} from "@mockprep/ui";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useRequireStudent } from "@/lib/use-require-student";

const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(2));
const duration = (sec: number) => {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  return h ? `${h} h ${m} min` : `${m} min ${sec % 60} s`;
};

/** Basic result (full analysis, solutions and rank come in Phase 6). */
export default function ResultPage() {
  const { attemptId } = useParams<{ attemptId: string }>();
  const user = useRequireStudent();
  const { api } = useAuth();
  const [data, setData] = useState<AttemptResultResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Scoring runs in the background: poll until it's done.
  useEffect(() => {
    if (!user) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let cancelled = false;
    const load = async () => {
      try {
        const res = await api.request(`/api/attempts/${attemptId}/result`, {
          schema: attemptResultResponseSchema,
        });
        if (cancelled) return;
        setData(res);
        if (res.status !== "scored") timer = setTimeout(() => void load(), 1500);
      } catch (e) {
        if (!cancelled) setError(errorMessage(e));
      }
    };
    void load();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [api, attemptId, user]);

  if (error) return <Alert>{error}</Alert>;
  if (!data) return <p className="text-sm text-muted-foreground">Loading…</p>;
  const r = data.result;

  return (
    <div className="flex flex-col gap-6">
      <header>
        <p className="text-sm text-muted-foreground">Result</p>
        <h1 className="text-2xl font-bold tracking-tight">{data.title}</h1>
        {data.submitReason === "timeout" && (
          <p className="mt-1 text-sm text-muted-foreground">
            Submitted automatically when the time ran out.
          </p>
        )}
      </header>
      {!r ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            Calculating your score…
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardContent className="flex flex-col gap-4 py-6">
              <p className="text-center">
                <span className="text-4xl font-bold tabular-nums">{fmt(r.score)}</span>
                <span className="text-xl text-muted-foreground"> / {fmt(r.maxScore)}</span>
              </p>
              {r.qualifying && (
                <p
                  className={`text-center text-sm font-medium ${r.qualifying.passed ? "text-success" : "text-destructive"}`}
                >
                  {r.qualifying.passed ? "Qualified" : "Not qualified"} (needs{" "}
                  {r.qualifying.percent}%)
                </p>
              )}
              <dl className="grid grid-cols-2 gap-3 text-center sm:grid-cols-5">
                {[
                  ["Correct", r.correct],
                  ["Wrong", r.wrong],
                  ...(r.partial ? [["Partial", r.partial] as const] : []),
                  ["Skipped", r.skipped],
                  ["Accuracy", `${fmt(r.accuracy)}%`],
                  ["Time taken", duration(r.timeTakenSec)],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-md border p-3">
                    <dt className="text-xs text-muted-foreground">{label}</dt>
                    <dd className="text-lg font-semibold tabular-nums">{value}</dd>
                  </div>
                ))}
              </dl>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Sections</CardTitle>
            </CardHeader>
            <CardContent className="px-3 sm:px-5">
              <Table className="[&_td]:px-2 [&_th]:px-2">
                <THead>
                  <TR>
                    <TH>Section</TH>
                    <TH className="text-right">Score</TH>
                    <TH className="text-right">✓</TH>
                    <TH className="text-right">✗</TH>
                    <TH className="text-right">Skipped</TH>
                  </TR>
                </THead>
                <TBody>
                  {r.sections.map((s) => (
                    <TR key={s.name}>
                      <TD>{s.name}</TD>
                      <TD className="text-right tabular-nums">
                        {fmt(s.score)}/{fmt(s.maxScore)}
                      </TD>
                      <TD className="text-right tabular-nums">{s.correct}</TD>
                      <TD className="text-right tabular-nums">{s.wrong}</TD>
                      <TD className="text-right tabular-nums">{s.skipped}</TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            </CardContent>
          </Card>
          <p className="text-sm text-muted-foreground">
            Solutions, rank and detailed analysis are coming soon.
          </p>
        </>
      )}
    </div>
  );
}
