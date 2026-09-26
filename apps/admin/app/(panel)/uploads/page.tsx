"use client";

import { useAuth } from "@mockprep/api-client";
import { uploadListResponseSchema } from "@mockprep/types";
import { Alert, Badge, Button, Card, TBody, TD, TH, THead, TR, Table } from "@mockprep/ui";
import { Upload } from "lucide-react";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { formatIst } from "@/lib/format";
import { canEditContent } from "@/lib/roles";
import { useApiQuery } from "@/lib/use-api-query";

export default function UploadsPage() {
  const { state } = useAuth();
  const { data, error } = useApiQuery("/api/admin/uploads", uploadListResponseSchema);
  return (
    <>
      <PageHeader
        title="Paper uploads"
        description="Question-paper PDFs turned into draft tests."
        action={
          canEditContent(state.user?.role) && (
            <Button asChild>
              <Link href="/uploads/new">
                <Upload /> Upload a paper
              </Link>
            </Button>
          )
        }
      />
      {error && <Alert>{error}</Alert>}
      <Card>
        <Table>
          <THead>
            <TR>
              <TH>Paper</TH>
              <TH>Exam</TH>
              <TH>Status</TH>
              <TH className="text-right">Found</TH>
              <TH className="text-right">To review</TH>
              <TH>Uploaded</TH>
            </TR>
          </THead>
          <TBody>
            {data?.uploads.map((u) => (
              <TR key={u.id}>
                <TD>
                  <Link href={`/uploads/${u.id}`} className="font-medium hover:underline">
                    {u.title}
                  </Link>
                  <div className="text-xs text-muted-foreground">{u.files.paper.name}</div>
                </TD>
                <TD className="text-muted-foreground">{u.examKey}</TD>
                <TD>
                  <Badge
                    variant={
                      u.status === "ready"
                        ? "success"
                        : u.status === "failed"
                          ? "destructive"
                          : "secondary"
                    }
                  >
                    {u.status === "ready" || u.status === "failed"
                      ? u.status
                      : `${u.status} ${u.progress}%`}
                  </Badge>
                </TD>
                <TD className="text-right tabular-nums">
                  {u.stats ? `${u.stats.found}/${u.stats.expected}` : "–"}
                </TD>
                <TD className="text-right tabular-nums">
                  {u.stats && u.testId ? (
                    <Link href={`/tests/${u.testId}/review`} className="hover:underline">
                      {u.stats.toReview}
                    </Link>
                  ) : (
                    "–"
                  )}
                </TD>
                <TD className="whitespace-nowrap text-muted-foreground">
                  {formatIst(u.createdAt)}
                </TD>
              </TR>
            ))}
            {data?.uploads.length === 0 && (
              <TR>
                <TD colSpan={6} className="py-8 text-center text-muted-foreground">
                  No uploads yet.
                </TD>
              </TR>
            )}
          </TBody>
        </Table>
      </Card>
    </>
  );
}
