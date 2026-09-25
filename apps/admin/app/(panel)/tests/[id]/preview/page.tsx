"use client";

import { studentPaperSchema } from "@mockprep/types";
import { Alert, Button, Card, CardContent, Select, cn } from "@mockprep/ui";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { PageHeader } from "@/components/page-header";
import { QuestionPreview } from "@/components/question-preview";
import { useApiQuery } from "@/lib/use-api-query";

/** Read-only render of exactly what students receive (no answers). The real exam UI is Phase 5. */
export default function TestPreviewPage() {
  const { id } = useParams<{ id: string }>();
  const { data, error } = useApiQuery(`/api/admin/tests/${id}/preview`, studentPaperSchema);
  const [sectionIndex, setSectionIndex] = useState(0);
  const [lang, setLang] = useState<"en" | "hi">("en");
  const section = data?.sections[sectionIndex];
  const offset =
    data?.sections.slice(0, sectionIndex).reduce((acc, s) => acc + s.questions.length, 0) ?? 0;

  return (
    <>
      <PageHeader
        title={data ? `Preview: ${data.title}` : "Preview"}
        description="Exactly what students receive (answers and solutions are never sent)."
        action={
          <Button asChild variant="outline">
            <Link href={`/tests/${id}`}>
              <ArrowLeft /> Back to builder
            </Link>
          </Button>
        }
      />
      {error && <Alert>{error}</Alert>}
      {data && (
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div role="tablist" className="flex flex-wrap gap-1">
              {data.sections.map((s, i) => (
                <button
                  key={s.name}
                  role="tab"
                  aria-selected={i === sectionIndex}
                  onClick={() => setSectionIndex(i)}
                  className={cn(
                    "h-9 rounded-md px-3 text-sm",
                    i === sectionIndex
                      ? "bg-primary text-primary-foreground"
                      : "bg-card text-muted-foreground hover:bg-muted",
                  )}
                >
                  {s.name} ({s.questions.length})
                </button>
              ))}
            </div>
            <Select
              aria-label="Language"
              className="h-9 w-32"
              value={lang}
              onChange={(e) => setLang(e.target.value === "hi" ? "hi" : "en")}
            >
              <option value="en">English</option>
              <option value="hi">हिन्दी</option>
            </Select>
          </div>
          {section?.questions.map((q, i) => (
            <Card key={q.id}>
              <CardContent className="flex flex-col gap-2">
                <p className="text-xs font-medium text-muted-foreground">
                  Question {offset + i + 1}
                </p>
                <QuestionPreview question={q} language={lang} />
              </CardContent>
            </Card>
          ))}
          {section?.questions.length === 0 && (
            <p className="text-sm text-muted-foreground">This section has no questions.</p>
          )}
        </div>
      )}
    </>
  );
}
