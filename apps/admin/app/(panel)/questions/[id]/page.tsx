"use client";

import { questionSchema } from "@mockprep/types";
import { Alert, Badge } from "@mockprep/ui";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { z } from "zod";
import { PageHeader } from "@/components/page-header";
import { QuestionEditor } from "@/components/question-editor";
import { QuestionStatsCard } from "@/components/question-stats";
import { formatIst } from "@/lib/format";
import { useApiQuery } from "@/lib/use-api-query";

const schema = z.object({
  question: questionSchema,
  versions: z.array(
    z.object({
      id: z.string(),
      version: z.number(),
      isLatest: z.boolean(),
      updatedAt: z.string(),
      usedIn: z.array(z.object({ id: z.string(), title: z.string(), status: z.string() })),
    }),
  ),
});

function EditQuestion() {
  const { id } = useParams<{ id: string }>();
  const versioned = useSearchParams().get("versioned");
  const { data, error } = useApiQuery(`/api/admin/questions/${id}`, schema);

  return (
    <>
      <PageHeader
        title={
          data ? `Question${data.question.number ? ` ${data.question.number}` : ""}` : "Question"
        }
        description={
          data &&
          `${data.question.examKey} · ${data.question.section} · version ${data.question.version}`
        }
      />
      {versioned && (
        <Alert variant="info" className="mb-4">
          Saved as version {versioned}. Published tests keep the previous version; draft tests now
          use this one.
        </Alert>
      )}
      {error && <Alert>{error}</Alert>}
      {data && <QuestionEditor key={data.question.id} question={data.question} />}
      {data && <QuestionStatsCard questionId={data.question.id} correct={data.question.correct} />}
      {data && data.versions.length > 0 && (
        <section className="mt-8 flex flex-col gap-2 text-sm">
          <h2 className="font-medium">Versions and usage</h2>
          <ul className="flex flex-col gap-1">
            {data.versions.map((v) => (
              <li key={v.id} className="flex flex-wrap items-center gap-2">
                <Link href={`/questions/${v.id}`} className="hover:underline">
                  Version {v.version}
                </Link>
                {v.isLatest && <Badge variant="success">latest</Badge>}
                <span className="text-muted-foreground">{formatIst(v.updatedAt)}</span>
                {v.usedIn.map((t) => (
                  <Link key={t.id} href={`/tests/${t.id}`}>
                    <Badge variant={t.status === "published" ? "default" : "secondary"}>
                      {t.title}
                    </Badge>
                  </Link>
                ))}
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}

export default function EditQuestionPage() {
  return (
    <Suspense>
      <EditQuestion />
    </Suspense>
  );
}
