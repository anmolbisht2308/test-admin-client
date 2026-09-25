"use client";

import { examTemplateSchema } from "@mockprep/types";
import { Alert } from "@mockprep/ui";
import { useParams } from "next/navigation";
import { z } from "zod";
import { PageHeader } from "@/components/page-header";
import { TemplateForm } from "@/components/template-form";
import { useApiQuery } from "@/lib/use-api-query";

const schema = z.object({
  template: examTemplateSchema,
  usedBy: z.array(z.object({ id: z.string(), slug: z.string(), name: z.string() })),
});

export default function EditTemplatePage() {
  const { id } = useParams<{ id: string }>();
  const { data, error } = useApiQuery(`/api/admin/templates/${id}`, schema);
  return (
    <>
      <PageHeader title={data?.template.name ?? "Template"} />
      {error && <Alert>{error}</Alert>}
      {data && (
        <TemplateForm key={data.template.id} template={data.template} usedBy={data.usedBy} />
      )}
    </>
  );
}
