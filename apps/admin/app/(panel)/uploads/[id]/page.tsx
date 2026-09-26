"use client";

import { errorMessage, useAuth } from "@mockprep/api-client";
import {
  FLAG_LABELS,
  UPLOAD_STEPS,
  uploadSchema,
  type Upload,
  type ValidationFlag,
} from "@mockprep/types";
import { Alert, Badge, Button, Card, CardContent, CardHeader, CardTitle, cn } from "@mockprep/ui";
import { Check, Eye, ListChecks, RotateCcw } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/page-header";
import { formatIst } from "@/lib/format";
import { canEditContent } from "@/lib/roles";

const STEP_LABELS: Record<(typeof UPLOAD_STEPS)[number], string> = {
  queued: "Queued",
  extracting: "Extracting",
  answer_key: "Answer key",
  validating: "Checking",
  ready: "Ready",
};

const POLL_MS = 1500;
const done = (u: Upload | null) => u?.status === "ready" || u?.status === "failed";

export default function UploadProgressPage() {
  const { id } = useParams<{ id: string }>();
  const { api, state } = useAuth();
  const [upload, setUpload] = useState<Upload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [retrying, setRetrying] = useState(false);
  const [tick, setTick] = useState(0);

  // Poll every 1.5 s until the pipeline finishes.
  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const load = async () => {
      try {
        const next = await api.request(`/api/admin/uploads/${id}`, { schema: uploadSchema });
        if (cancelled) return;
        setUpload(next);
        setError(null);
        if (!done(next)) timer = setTimeout(() => void load(), POLL_MS);
      } catch (e) {
        if (cancelled) return;
        setError(errorMessage(e));
        timer = setTimeout(() => void load(), POLL_MS * 2);
      }
    };
    void load();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [api, id, tick]);

  async function retry() {
    setRetrying(true);
    try {
      setUpload(
        await api.request(`/api/admin/uploads/${id}/retry`, {
          method: "POST",
          schema: uploadSchema,
        }),
      );
      setTick((t) => t + 1);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setRetrying(false);
    }
  }

  const failed = upload?.status === "failed";
  const stepIndex = upload
    ? failed
      ? -1
      : UPLOAD_STEPS.indexOf(upload.status as (typeof UPLOAD_STEPS)[number])
    : 0;
  const stats = upload?.stats;
  const flags = Object.entries(stats?.flagCounts ?? {}) as [ValidationFlag, number][];

  return (
    <>
      <PageHeader
        title={upload?.title ?? "Upload"}
        description={upload ? `Uploaded ${formatIst(upload.createdAt)}` : undefined}
      />
      <div className="flex max-w-4xl flex-col gap-6">
        {error && <Alert>{error}</Alert>}
        <Card>
          <CardContent className="flex flex-col gap-5">
            <ol className="grid grid-cols-5 gap-2" aria-label="Progress">
              {UPLOAD_STEPS.map((step, i) => {
                const complete = upload?.status === "ready" || i < stepIndex;
                const current = i === stepIndex && upload?.status !== "ready";
                return (
                  <li key={step} className="flex flex-col items-center gap-1 text-center text-xs">
                    <span
                      className={cn(
                        "inline-flex size-8 items-center justify-center rounded-full border text-sm font-medium",
                        complete && "border-success bg-success text-success-foreground",
                        current && "border-primary text-primary",
                      )}
                      aria-current={current ? "step" : undefined}
                    >
                      {complete ? <Check className="size-4" /> : i + 1}
                    </span>
                    <span className={cn(!complete && !current && "text-muted-foreground")}>
                      {STEP_LABELS[step]}
                    </span>
                  </li>
                );
              })}
            </ol>
            <div
              className="h-2 overflow-hidden rounded-full bg-muted"
              role="progressbar"
              aria-valuenow={upload?.progress ?? 0}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <div
                className={cn("h-full transition-all", failed ? "bg-destructive" : "bg-primary")}
                style={{ width: `${failed ? 100 : (upload?.progress ?? 0)}%` }}
              />
            </div>
            <p className={cn("text-sm", failed && "text-destructive")}>
              {upload?.message ?? "Loading…"}
            </p>

            {upload?.status === "ready" && stats && upload.testId && (
              <div className="flex flex-col gap-4">
                <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {[
                    ["Found", `${stats.found} of ${stats.expected}`],
                    ["Auto-approved", String(stats.autoApproved)],
                    ["To review", String(stats.toReview)],
                    ["Time taken", `${Math.max(1, Math.round(stats.durationMs / 1000))} s`],
                  ].map(([label, value]) => (
                    <div key={label} className="rounded-md border p-3">
                      <dt className="text-xs text-muted-foreground">{label}</dt>
                      <dd className="text-lg font-semibold tabular-nums">{value}</dd>
                    </div>
                  ))}
                </dl>
                {flags.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {flags.map(([flag, count]) => (
                      <Badge key={flag} variant="outline">
                        {FLAG_LABELS[flag]}: {count}
                      </Badge>
                    ))}
                  </div>
                )}
                <p className="text-xs text-muted-foreground">
                  Read with the {stats.extractor === "ai" ? "AI extractor" : "text parser"} ·{" "}
                  {stats.pages} pages
                </p>
                <div className="flex flex-wrap justify-end gap-3">
                  <Button asChild variant="outline">
                    <Link href={`/tests/${upload.testId}/preview`}>
                      <Eye /> Preview
                    </Link>
                  </Button>
                  <Button asChild>
                    <Link href={`/tests/${upload.testId}/review`}>
                      <ListChecks /> Review {stats.toReview > 0 ? `${stats.toReview} flagged` : ""}
                    </Link>
                  </Button>
                </div>
              </div>
            )}

            {failed && canEditContent(state.user?.role) && (
              <div className="flex justify-end">
                <Button onClick={() => void retry()} disabled={retrying}>
                  <RotateCcw /> {retrying ? "Retrying…" : "Retry"}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Log</CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="flex max-h-80 flex-col gap-1 overflow-y-auto font-mono text-xs">
              {upload?.log.map((l, i) => (
                <li
                  key={i}
                  className={cn(
                    l.level === "error" && "text-destructive",
                    l.level === "warn" && "text-amber-600 dark:text-amber-400",
                  )}
                >
                  <span className="text-muted-foreground">
                    {new Date(l.at).toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata" })}
                  </span>{" "}
                  {l.message}
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
