"use client";

import { duplicateGroupsResponseSchema } from "@mockprep/types";
import { Alert, Badge, Card, CardContent } from "@mockprep/ui";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { formatIst, snippet } from "@/lib/format";
import { useApiQuery } from "@/lib/use-api-query";

export default function DuplicatesPage() {
  const { data, error } = useApiQuery(
    "/api/admin/questions/duplicates",
    duplicateGroupsResponseSchema,
  );
  return (
    <>
      <PageHeader
        title="Duplicate questions"
        description="Questions with the same text and options (ignoring case, spacing and option order)."
      />
      {error && <Alert>{error}</Alert>}
      {data?.groups.length === 0 && (
        <p className="text-sm text-muted-foreground">No duplicates found.</p>
      )}
      <div className="flex flex-col gap-3">
        {data?.groups.map((group) => (
          <Card key={group.hash}>
            <CardContent className="flex flex-col gap-2">
              <p className="text-sm font-medium">{snippet(group.questions[0]?.stem ?? "", 160)}</p>
              <ul className="flex flex-col gap-1 text-sm">
                {group.questions.map((q) => (
                  <li key={q.id} className="flex flex-wrap items-center gap-2">
                    <Link href={`/questions/${q.id}`} className="hover:underline">
                      {q.examKey} · {q.section}
                    </Link>
                    <Badge variant={q.status === "approved" ? "success" : "secondary"}>
                      {q.status}
                    </Badge>
                    <span className="text-muted-foreground">added {formatIst(q.createdAt)}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        ))}
      </div>
    </>
  );
}
