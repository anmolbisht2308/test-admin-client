"use client";

import { useAuth } from "@mockprep/api-client";
import {
  EXAM_FAMILY_LABELS,
  examTemplateListResponseSchema,
  templateQuestionCount,
} from "@mockprep/types";
import { Alert, Badge, Button, Card, TBody, TD, TH, THead, TR, Table } from "@mockprep/ui";
import { Plus } from "lucide-react";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { canEditContent } from "@/lib/roles";
import { useApiQuery } from "@/lib/use-api-query";

const fmt = (n: number) => (n > 0 ? `+${n}` : `${n}`);

export default function TemplatesPage() {
  const { state } = useAuth();
  const { data, error } = useApiQuery("/api/admin/templates", examTemplateListResponseSchema);

  return (
    <>
      <PageHeader
        title="Exam templates"
        description="Sections, timers, marking and interface for each paper. Tests and scoring read everything from here."
        action={
          canEditContent(state.user?.role) && (
            <Button asChild>
              <Link href="/templates/new">
                <Plus /> New template
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
              <TH>Template</TH>
              <TH>Family</TH>
              <TH className="text-right">Questions</TH>
              <TH className="text-right">Time</TH>
              <TH>Marking</TH>
              <TH>Sections</TH>
            </TR>
          </THead>
          <TBody>
            {data?.templates.map((t) => (
              <TR key={t.id}>
                <TD>
                  <Link href={`/templates/${t.id}`} className="font-medium hover:underline">
                    {t.name}
                  </Link>
                  <div className="text-xs text-muted-foreground">{t.key}</div>
                </TD>
                <TD>{EXAM_FAMILY_LABELS[t.family]}</TD>
                <TD className="text-right tabular-nums">{templateQuestionCount(t)}</TD>
                <TD className="text-right tabular-nums">{t.totalTimeSec / 60} min</TD>
                <TD className="tabular-nums">
                  {fmt(t.marking.correct)} / {fmt(t.marking.wrong)}
                  {t.qualifyingPercent !== undefined && (
                    <Badge variant="outline" className="ml-2">
                      qualifying
                    </Badge>
                  )}
                </TD>
                <TD>
                  <Badge variant="secondary">
                    {t.sectionSwitching === "locked_sequential" ? "locked" : "free"}
                  </Badge>{" "}
                  <span className="text-muted-foreground">{t.sections.length}</span>
                </TD>
              </TR>
            ))}
            {!data && !error && (
              <TR>
                <TD colSpan={6} className="py-8 text-center text-muted-foreground">
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
