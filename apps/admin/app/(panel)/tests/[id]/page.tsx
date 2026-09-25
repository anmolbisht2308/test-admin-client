"use client";

import { adminTestResponseSchema } from "@mockprep/types";
import { Alert, Badge } from "@mockprep/ui";
import { useParams } from "next/navigation";
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
      />
      {error && <Alert>{error}</Alert>}
      {data && <TestBuilder key={data.test.id} initial={data} />}
    </>
  );
}
