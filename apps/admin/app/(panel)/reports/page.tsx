"use client";

import { errorMessage, useAuth } from "@mockprep/api-client";
import { REPORT_REASON_LABELS, reportListResponseSchema, type ReportReason } from "@mockprep/types";
import { Alert, Badge, Button, Card, CardContent } from "@mockprep/ui";
import Link from "next/link";
import { useState } from "react";
import { PageHeader } from "@/components/page-header";
import { formatIst, snippet } from "@/lib/format";
import { canEditContent } from "@/lib/roles";
import { useApiQuery } from "@/lib/use-api-query";

/** Students' "Report an error", most reported first. */
export default function ReportsPage() {
  const { api, state } = useAuth();
  const { data, error, reload } = useApiQuery("/api/admin/reports", reportListResponseSchema);
  const [notice, setNotice] = useState<{ kind: "success" | "error"; text: string } | null>(null);
  const canEdit = canEditContent(state.user?.role);

  async function resolve(questionId: string, action: "fix" | "dismiss") {
    setNotice(null);
    try {
      await api.request(`/api/admin/reports/${questionId}/resolve`, {
        method: "POST",
        body: { action },
      });
      setNotice({
        kind: "success",
        text:
          action === "fix"
            ? "Marked fixed. The question is back in new papers."
            : "Dismissed. The question is back in new papers.",
      });
      reload();
    } catch (e) {
      setNotice({ kind: "error", text: errorMessage(e) });
    }
  }

  return (
    <>
      <PageHeader
        title="Reports"
        description="Errors reported by students. A question with 3 reports is left out of new attempts until you resolve it."
      />
      {error && <Alert>{error}</Alert>}
      {notice && (
        <Alert variant={notice.kind} className="mb-4">
          {notice.text}
        </Alert>
      )}
      {data?.groups.length === 0 && (
        <p className="text-sm text-muted-foreground">No open reports.</p>
      )}
      <div className="flex flex-col gap-3">
        {data?.groups.map((g) => (
          <Card key={g.questionId}>
            <CardContent className="flex flex-col gap-3 py-4">
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <Badge variant="destructive">
                  {g.count} report{g.count === 1 ? "" : "s"}
                </Badge>
                {g.unpublished && <Badge variant="secondary">Pulled from new attempts</Badge>}
                <span className="text-muted-foreground">
                  {g.examKey} · {g.section} · last {formatIst(g.lastAt)}
                </span>
              </div>
              <p className="text-sm">{snippet(g.stem, 220)}</p>
              <ul className="flex flex-wrap gap-1">
                {Object.entries(g.reasons).map(([reason, n]) => (
                  <li key={reason}>
                    <Badge variant="outline">
                      {REPORT_REASON_LABELS[reason as ReportReason]}: {n}
                    </Badge>
                  </li>
                ))}
              </ul>
              {g.notes.length > 0 && (
                <ul className="flex flex-col gap-1 border-l-2 pl-3 text-sm text-muted-foreground">
                  {g.notes.slice(0, 5).map((n, i) => (
                    <li key={i}>&ldquo;{n.note}&rdquo;</li>
                  ))}
                </ul>
              )}
              <div className="flex flex-wrap gap-2">
                <Button asChild size="sm" variant="outline">
                  <Link href={`/questions/${g.questionId}`}>Open question</Link>
                </Button>
                {canEdit && (
                  <>
                    <Button size="sm" onClick={() => void resolve(g.questionId, "fix")}>
                      Fixed
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => void resolve(g.questionId, "dismiss")}
                    >
                      Dismiss
                    </Button>
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </>
  );
}
