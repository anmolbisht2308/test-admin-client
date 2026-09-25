"use client";

import { useAuth } from "@mockprep/api-client";
import { EXAM_FAMILY_LABELS, examListResponseSchema } from "@mockprep/types";
import { Alert, Badge, Button, Card, TBody, TD, TH, THead, TR, Table } from "@mockprep/ui";
import { Plus } from "lucide-react";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { canEditContent } from "@/lib/roles";
import { useApiQuery } from "@/lib/use-api-query";

export default function ExamsPage() {
  const { state } = useAuth();
  const { data, error } = useApiQuery("/api/admin/exams", examListResponseSchema);
  const canEdit = canEditContent(state.user?.role);

  return (
    <>
      <PageHeader
        title="Exams"
        description="Published exams appear on the student site within a minute."
        action={
          canEdit && (
            <Button asChild>
              <Link href="/exams/new">
                <Plus /> New exam
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
              <TH>Exam</TH>
              <TH>Family</TH>
              <TH>Papers (templates)</TH>
              <TH>Status</TH>
              <TH className="text-right">Order</TH>
            </TR>
          </THead>
          <TBody>
            {data?.exams.map((exam) => (
              <TR key={exam.id}>
                <TD>
                  <Link href={`/exams/${exam.id}`} className="font-medium hover:underline">
                    {exam.name}
                  </Link>
                  <div className="text-xs text-muted-foreground">/{exam.slug}</div>
                </TD>
                <TD>{EXAM_FAMILY_LABELS[exam.family]}</TD>
                <TD className="text-muted-foreground">{exam.templateKeys.join(", ")}</TD>
                <TD>
                  <Badge variant={exam.status === "published" ? "success" : "secondary"}>
                    {exam.status}
                  </Badge>
                </TD>
                <TD className="text-right tabular-nums">{exam.sortOrder}</TD>
              </TR>
            ))}
            {data?.exams.length === 0 && (
              <TR>
                <TD colSpan={5} className="py-8 text-center text-muted-foreground">
                  No exams yet.
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
