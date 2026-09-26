"use client";

import { adminTestResponseSchema } from "@mockprep/types";
import { Alert, Badge, Button } from "@mockprep/ui";
import Link from "next/link";
import { useParams } from "next/navigation";
import { CutoffsCard } from "@/components/cutoffs-card";
import { PageHeader } from "@/components/page-header";
import { TestBuilder } from "@/components/test-builder";
import { useApiQuery } from "@/lib/use-api-query";

export default function TestBuilderPage() {
  const { id } = useParams<{ id: string }>();
  const { data, error } = useApiQuery(`/api/admin/tests/${id}`, adminTestResponseSchema);
  return (
    <>
      <PageHeader
        title={data?.test.title ?? "Test"}
        description={
          data && (
            <Badge variant={data.test.status === "published" ? "success" : "secondary"}>
              {data.test.status}
            </Badge>
          )
        }
        action={
          data?.test.status === "published" && (
            <Button asChild variant="outline">
              <Link href={`/tests/${id}/answer-key`}>Change answer key & re-score</Link>
            </Button>
          )
        }
      />
      {error && <Alert>{error}</Alert>}
      {data && (
        <div className="flex flex-col gap-6">
          <TestBuilder key={data.test.id} initial={data} />
          <CutoffsCard key={`cut-${data.test.id}`} test={data.test} />
        </div>
      )}
    </>
  );
}
