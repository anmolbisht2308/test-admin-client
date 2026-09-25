"use client";

import { errorMessage, useAuth } from "@mockprep/api-client";
import {
  TEST_TYPE_LABELS,
  adminTestResponseSchema,
  examListResponseSchema,
  examTemplateListResponseSchema,
  templateQuestionCount,
  testTypeSchema,
  type TestType,
} from "@mockprep/types";
import { Alert, Button, Card, CardContent, Field, Input, Select } from "@mockprep/ui";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { PageHeader } from "@/components/page-header";
import { useApiQuery } from "@/lib/use-api-query";

export default function NewTestPage() {
  const { api } = useAuth();
  const router = useRouter();
  const exams = useApiQuery("/api/admin/exams", examListResponseSchema);
  const templates = useApiQuery("/api/admin/templates", examTemplateListResponseSchema);
  const [examKey, setExamKey] = useState("");
  const [templateKey, setTemplateKey] = useState("");
  const [title, setTitle] = useState("");
  const [type, setType] = useState<TestType>("full");
  const [isFree, setIsFree] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const exam = exams.data?.exams.find((e) => e.slug === examKey);
  const options = (templates.data?.templates ?? []).filter((t) =>
    exam?.templateKeys.includes(t.key),
  );
  const template = options.find((t) => t.key === templateKey);

  useEffect(() => {
    if (exam && !exam.templateKeys.includes(templateKey))
      setTemplateKey(exam.templateKeys[0] ?? "");
  }, [exam, templateKey]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await api.request("/api/admin/tests", {
        method: "POST",
        body: { title, examKey, templateKey, type, isFree },
        schema: adminTestResponseSchema,
      });
      router.replace(`/tests/${res.test.id}`);
    } catch (e) {
      setError(errorMessage(e));
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader
        title="New test"
        description="Sections, timers and marking are copied from the exam template."
      />
      <form onSubmit={submit} className="max-w-xl" noValidate>
        <Card>
          <CardContent className="flex flex-col gap-4">
            <Field label="Exam" htmlFor="exam">
              <Select
                id="exam"
                value={examKey}
                onChange={(e) => setExamKey(e.target.value)}
                required
              >
                <option value="">Choose…</option>
                {exams.data?.exams.map((e) => (
                  <option key={e.slug} value={e.slug}>
                    {e.name}
                  </option>
                ))}
              </Select>
            </Field>
            {options.length > 1 && (
              <Field label="Paper" htmlFor="template">
                <Select
                  id="template"
                  value={templateKey}
                  onChange={(e) => setTemplateKey(e.target.value)}
                >
                  {options.map((t) => (
                    <option key={t.key} value={t.key}>
                      {t.name}
                    </option>
                  ))}
                </Select>
              </Field>
            )}
            {template && (
              <p className="text-sm text-muted-foreground">
                {template.name}: {templateQuestionCount(template)} questions in{" "}
                {template.sections.length} section(s), {template.totalTimeSec / 60} min.
              </p>
            )}
            <Field label="Title" htmlFor="title">
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={exam ? `${exam.shortName} Mock 1` : "SBI PO Mock 1"}
              />
            </Field>
            <Field label="Type" htmlFor="type">
              <Select
                id="type"
                value={type}
                onChange={(e) => setType(testTypeSchema.parse(e.target.value))}
              >
                {testTypeSchema.options.map((t) => (
                  <option key={t} value={t}>
                    {TEST_TYPE_LABELS[t]}
                  </option>
                ))}
              </Select>
            </Field>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="size-4 accent-[var(--primary)]"
                checked={isFree}
                onChange={(e) => setIsFree(e.target.checked)}
              />
              Free test
            </label>
            {error && <Alert>{error}</Alert>}
            <div className="flex justify-end">
              <Button
                type="submit"
                disabled={busy || !examKey || !templateKey || title.trim().length < 2}
              >
                {busy ? "Creating…" : "Create and build"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </form>
    </>
  );
}
