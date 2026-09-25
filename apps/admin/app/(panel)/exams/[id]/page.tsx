"use client";

import { examSchema } from "@mockprep/types";
import { Alert } from "@mockprep/ui";
import { useParams } from "next/navigation";
import { z } from "zod";
import { ExamForm } from "@/components/exam-form";
import { PageHeader } from "@/components/page-header";
import { useApiQuery } from "@/lib/use-api-query";

const schema = z.object({ exam: examSchema });

export default function EditExamPage() {
  const { id } = useParams<{ id: string }>();
  const { data, error } = useApiQuery(`/api/admin/exams/${id}`, schema);
  return (
    <>
      <PageHeader title={data?.exam.name ?? "Exam"} />
      {error && <Alert>{error}</Alert>}
      {data && <ExamForm key={data.exam.id} exam={data.exam} />}
    </>
  );
}
