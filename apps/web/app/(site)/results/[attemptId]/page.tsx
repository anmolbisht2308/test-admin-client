"use client";

import { errorMessage, useAuth } from "@mockprep/api-client";
import {
  attemptAnalysisSchema,
  attemptResultResponseSchema,
  practiceResponseSchema,
  type AttemptAnalysis,
  type AttemptResultResponse,
} from "@mockprep/types";
import { Alert, Button, Card, CardContent, TBody, TD, TH, THead, TR, Table } from "@mockprep/ui";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { formatDuration, formatMarks } from "@/lib/results";
import { useRequireStudent } from "@/lib/use-require-student";

// Charts (Recharts) load after the numbers, only on this page.
const AnalysisCharts = dynamic(() => import("@/components/results/analysis-charts"), {
  ssr: false,
  loading: () => <p className="text-sm text-muted-foreground">Loading charts…</p>,
});

function BigNumber({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="flex flex-col items-center rounded-xl border p-4 text-center">
      <span className="text-xs tracking-wide text-muted-foreground uppercase">{label}</span>
      <span className="text-3xl font-bold tabular-nums sm:text-4xl">{value}</span>
      {sub && <span className="text-sm text-muted-foreground">{sub}</span>}
    </div>
  );
}

export default function ResultPage() {
  const { attemptId } = useParams<{ attemptId: string }>();
  const user = useRequireStudent();
  const { api } = useAuth();
  const router = useRouter();
  const [data, setData] = useState<AttemptResultResponse | null>(null);
  const [analysis, setAnalysis] = useState<AttemptAnalysis | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [practiceBusy, setPracticeBusy] = useState(false);

  // Scoring runs in the background: poll until done, then load the analysis.
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
        if (res.status !== "scored") {
          timer = setTimeout(() => void load(), 1500);
          return;
        }
        const a = await api.request(`/api/attempts/${attemptId}/analysis`, {
          schema: attemptAnalysisSchema,
        });
        if (!cancelled) setAnalysis(a);
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

  async function practise() {
    setPracticeBusy(true);
    try {
      const res = await api.request(`/api/attempts/${attemptId}/practice`, {
        method: "POST",
        body: { include: "wrong" },
        schema: practiceResponseSchema,
      });
      router.push(`/test/${res.attemptId}`);
    } catch (e) {
      setError(errorMessage(e));
      setPracticeBusy(false);
    }
  }

  if (error) return <Alert>{error}</Alert>;
  if (!data) return <p className="text-sm text-muted-foreground">Loading…</p>;
  const r = data.result;

  return (
    <div className="flex flex-col gap-6">
      <header>
        <p className="text-sm text-muted-foreground">
          {data.practice ? "Practice result" : "Result"}
        </p>
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
          <section className="grid grid-cols-3 gap-2 sm:gap-4" aria-label="Summary">
            <BigNumber
              label="Score"
              value={formatMarks(r.score)}
              sub={`of ${formatMarks(r.maxScore)}`}
            />
            <BigNumber
              label="Rank"
              value={data.rank ? String(data.rank.rank) : "–"}
              sub={data.rank ? `of ${data.rank.total}` : data.practice ? "practice" : "re-attempt"}
            />
            <BigNumber
              label="Percentile"
              value={data.rank ? formatMarks(data.rank.percentile) : "–"}
              sub={data.rank ? "scored below you" : "not ranked"}
            />
          </section>

          {analysis && (
            <p
              className="rounded-xl border-l-4 border-primary bg-primary/5 p-4 text-base"
              role="note"
            >
              {analysis.advice}
            </p>
          )}

          <div className="flex flex-wrap gap-3">
            <Button asChild>
              <Link href={`/results/${attemptId}/solutions`}>View solutions</Link>
            </Button>
            {r.wrong + r.partial > 0 && (
              <Button variant="outline" onClick={() => void practise()} disabled={practiceBusy}>
                {practiceBusy
                  ? "Creating…"
                  : `Re-attempt ${r.wrong + r.partial} wrong question${r.wrong + r.partial === 1 ? "" : "s"}`}
              </Button>
            )}
          </div>

          <Card>
            <CardContent className="grid grid-cols-2 gap-3 py-4 text-center sm:grid-cols-5">
              {[
                ["Correct", String(r.correct)],
                ["Wrong", String(r.wrong + r.partial)],
                ["Skipped", String(r.skipped)],
                ["Accuracy", `${formatMarks(r.accuracy)}%`],
                ["Time", formatDuration(r.timeTakenSec)],
              ].map(([label, value]) => (
                <div key={label}>
                  <p className="text-xs text-muted-foreground">{label}</p>
                  <p className="text-lg font-semibold tabular-nums">{value}</p>
                </div>
              ))}
            </CardContent>
          </Card>

          {analysis && analysis.cutoff.cleared !== null && (
            <Alert variant={analysis.cutoff.cleared ? "success" : "error"}>
              {analysis.cutoff.cleared
                ? "You cleared the expected cut-off."
                : "You didn't clear the expected cut-off yet."}
              {analysis.cutoff.overall !== null &&
                ` Overall cut-off: ${formatMarks(analysis.cutoff.overall)}.`}
            </Alert>
          )}

          {analysis && (analysis.weak.length > 0 || analysis.strong.length > 0) && (
            <div className="grid gap-3 sm:grid-cols-2">
              <Card>
                <CardContent className="py-4">
                  <p className="text-sm font-semibold">Strong topics</p>
                  <p className="text-sm text-muted-foreground">
                    {analysis.strong.join(", ") || "None yet"}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="py-4">
                  <p className="text-sm font-semibold">Weak topics</p>
                  <p className="text-sm text-muted-foreground">
                    {analysis.weak.join(", ") || "None: well done"}
                  </p>
                </CardContent>
              </Card>
            </div>
          )}

          {analysis && <AnalysisCharts a={analysis} />}

          {analysis && (
            <Card>
              <CardContent className="px-3 py-4 sm:px-5">
                <Table className="[&_td]:px-2 [&_th]:px-2">
                  <THead>
                    <TR>
                      <TH>Section</TH>
                      <TH className="text-right">Score</TH>
                      <TH className="text-right">Accuracy</TH>
                      <TH className="text-right">Lost to −ve</TH>
                      <TH className="text-right">Time</TH>
                    </TR>
                  </THead>
                  <TBody>
                    {analysis.sections.map((s) => (
                      <TR key={s.name}>
                        <TD>{s.name}</TD>
                        <TD className="text-right tabular-nums">
                          {formatMarks(s.score)}/{formatMarks(s.maxScore)}
                          {s.cutoff !== null && (
                            <span className="text-xs text-muted-foreground">
                              {" "}
                              (cut-off {formatMarks(s.cutoff)})
                            </span>
                          )}
                        </TD>
                        <TD className="text-right tabular-nums">{formatMarks(s.accuracy)}%</TD>
                        <TD className="text-right tabular-nums">{formatMarks(s.negativeMarks)}</TD>
                        <TD className="text-right whitespace-nowrap tabular-nums">
                          {formatDuration(s.timeMs / 1000)}
                        </TD>
                      </TR>
                    ))}
                  </TBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
