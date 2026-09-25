"use client";

import { useAuth } from "@mockprep/api-client";
import { TEST_TYPE_LABELS, testListResponseSchema } from "@mockprep/types";
import { Alert, Badge, Button, Card, TBody, TD, TH, THead, TR, Table } from "@mockprep/ui";
import { Plus } from "lucide-react";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { formatIst } from "@/lib/format";
import { canEditContent } from "@/lib/roles";
import { useApiQuery } from "@/lib/use-api-query";

export default function TestsPage() {
  const { state } = useAuth();
  const { data, error } = useApiQuery("/api/admin/tests", testListResponseSchema);
  return (
    <>
      <PageHeader
        title="Tests"
        description="Build tests from the question bank. Published tests appear on the exam page."
        action={
          canEditContent(state.user?.role) && (
            <Button asChild>
              <Link href="/tests/new">
                <Plus /> New test
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
              <TH>Test</TH>
              <TH>Exam</TH>
              <TH className="text-right">Questions</TH>
              <TH>Status</TH>
              <TH>Updated</TH>
            </TR>
          </THead>
          <TBody>
            {data?.tests.map((t) => (
              <TR key={t.id}>
                <TD>
                  <Link href={`/tests/${t.id}`} className="font-medium hover:underline">
                    {t.title}
                  </Link>
                  <div className="mt-1 flex gap-1">
                    <Badge variant="outline">{TEST_TYPE_LABELS[t.type]}</Badge>
                    {t.isFree && <Badge variant="outline">Free</Badge>}
                  </div>
                </TD>
                <TD className="text-muted-foreground">
                  {t.examKey} · {t.templateName}
                </TD>
                <TD
                  className={`text-right tabular-nums ${t.questionCount === t.expectedCount ? "" : "text-destructive"}`}
                >
                  {t.questionCount}/{t.expectedCount}
                </TD>
                <TD>
                  <Badge variant={t.status === "published" ? "success" : "secondary"}>
                    {t.status}
                  </Badge>
                  {t.status === "published" &&
                    t.publishAt &&
                    new Date(t.publishAt) > new Date() && (
                      <div className="mt-1 text-xs text-muted-foreground">
                        visible {formatIst(t.publishAt)}
                      </div>
                    )}
                </TD>
                <TD className="whitespace-nowrap text-muted-foreground">
                  {formatIst(t.updatedAt)}
                </TD>
              </TR>
            ))}
            {data?.tests.length === 0 && (
              <TR>
                <TD colSpan={5} className="py-8 text-center text-muted-foreground">
                  No tests yet.
                </TD>
              </TR>
            )}
            {!data && !error && (
              <TR>
                <TD colSpan={5} className="py-8 text-center text-muted-foreground">
                  Loading…
                </TD>
              </TR>
            )}
          </TBody>
        </Table>
      </Card>
    </>
  );
}
