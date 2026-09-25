"use client";

import { errorMessage, fieldErrors, isApiError, useAuth } from "@mockprep/api-client";
import {
  EXAM_FAMILY_LABELS,
  examFamilySchema,
  examInputSchema,
  examSchema,
  examTemplateListResponseSchema,
  type Exam,
  type ExamFamily,
  type ExamStatus,
} from "@mockprep/types";
import { Alert, Button, Card, CardContent, Field, Input, Select, Textarea, cn } from "@mockprep/ui";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { z } from "zod";
import { canEditContent } from "@/lib/roles";
import { useApiQuery } from "@/lib/use-api-query";

const slugify = (value: string) =>
  value
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);

const examResponse = z.object({ exam: examSchema });

export function ExamForm({ exam }: { exam?: Exam }) {
  const { api, state } = useAuth();
  const router = useRouter();
  const templates = useApiQuery("/api/admin/templates", examTemplateListResponseSchema);
  const readOnly = !canEditContent(state.user?.role);

  const [name, setName] = useState(exam?.name ?? "");
  const [slug, setSlug] = useState(exam?.slug ?? "");
  const [slugTouched, setSlugTouched] = useState(Boolean(exam));
  const [shortName, setShortName] = useState(exam?.shortName ?? "");
  const [family, setFamily] = useState<ExamFamily>(exam?.family ?? "banking");
  const [description, setDescription] = useState(exam?.description ?? "");
  const [templateKeys, setTemplateKeys] = useState<string[]>(exam?.templateKeys ?? []);
  const [status, setStatus] = useState<ExamStatus>(exam?.status ?? "draft");
  const [sortOrder, setSortOrder] = useState(String(exam?.sortOrder ?? 100));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  const available = templates.data?.templates ?? [];
  const toggleTemplate = (key: string) =>
    setTemplateKeys((keys) =>
      keys.includes(key) ? keys.filter((k) => k !== key) : [...keys, key],
    );

  async function submit(event: FormEvent) {
    event.preventDefault();
    setFormError(null);
    setSaved(false);
    const parsed = examInputSchema.safeParse({
      name,
      slug,
      shortName,
      family,
      description,
      templateKeys,
      status,
      sortOrder: Number(sortOrder),
    });
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error.issues));
      return;
    }
    setErrors({});
    setBusy(true);
    try {
      const res = await api.request(exam ? `/api/admin/exams/${exam.id}` : "/api/admin/exams", {
        method: exam ? "PATCH" : "POST",
        body: parsed.data,
        schema: examResponse,
      });
      if (exam) setSaved(true);
      else router.replace(`/exams/${res.exam.id}`);
    } catch (e) {
      if (isApiError(e) && e.status === 409)
        setErrors({ slug: "Another exam already uses this slug" });
      else if (isApiError(e) && e.status === 400) setErrors(fieldErrors(e.details));
      setFormError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!exam || !window.confirm(`Delete “${exam.name}”? Students will no longer see it.`)) return;
    try {
      await api.request(`/api/admin/exams/${exam.id}`, { method: "DELETE" });
      router.replace("/exams");
    } catch (e) {
      setFormError(errorMessage(e));
    }
  }

  return (
    <form onSubmit={submit} noValidate>
      <fieldset disabled={readOnly || busy} className="flex flex-col gap-6">
        <Card>
          <CardContent className="grid gap-5 md:grid-cols-2">
            <Field label="Name" htmlFor="name" error={errors.name} className="md:col-span-2">
              <Input
                id="name"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (!slugTouched) setSlug(slugify(e.target.value));
                }}
                placeholder="SBI Probationary Officer (PO)"
              />
            </Field>
            <Field
              label="Short name"
              htmlFor="shortName"
              error={errors.shortName}
              hint="Shown on cards, e.g. “SBI PO”."
            >
              <Input
                id="shortName"
                value={shortName}
                onChange={(e) => setShortName(e.target.value)}
              />
            </Field>
            <Field
              label="URL slug"
              htmlFor="slug"
              error={errors.slug}
              hint={`Student page: /exams/${slug || "…"}`}
            >
              <Input
                id="slug"
                value={slug}
                onChange={(e) => {
                  setSlugTouched(true);
                  setSlug(e.target.value);
                }}
              />
            </Field>
            <Field label="Exam family" htmlFor="family" error={errors.family}>
              <Select
                id="family"
                value={family}
                onChange={(e) => setFamily(examFamilySchema.parse(e.target.value))}
              >
                {examFamilySchema.options.map((f) => (
                  <option key={f} value={f}>
                    {EXAM_FAMILY_LABELS[f]}
                  </option>
                ))}
              </Select>
            </Field>
            <Field
              label="Sort order"
              htmlFor="sortOrder"
              error={errors.sortOrder}
              hint="Lower comes first within the family."
            >
              <Input
                id="sortOrder"
                type="number"
                min={0}
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value)}
              />
            </Field>
            <Field
              label="Description"
              htmlFor="description"
              error={errors.description}
              className="md:col-span-2"
            >
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
              />
            </Field>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex flex-col gap-3">
            <div>
              <h2 className="text-sm font-medium">Papers</h2>
              <p className="text-sm text-muted-foreground">
                Pick the exam templates in this exam, in order (e.g. GS Paper I, then CSAT).
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {available.map((t) => {
                const index = templateKeys.indexOf(t.key);
                return (
                  <button
                    key={t.key}
                    type="button"
                    aria-pressed={index >= 0}
                    onClick={() => toggleTemplate(t.key)}
                    className={cn(
                      "inline-flex h-9 items-center gap-2 rounded-full border px-3 text-sm",
                      index >= 0 ? "border-primary bg-primary/10 text-primary" : "hover:bg-muted",
                    )}
                  >
                    {index >= 0 && (
                      <span className="text-xs font-semibold tabular-nums">{index + 1}</span>
                    )}
                    {t.name}
                  </button>
                );
              })}
            </div>
            {errors.templateKeys && (
              <p className="text-sm text-destructive">{errors.templateKeys}</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex flex-wrap items-center justify-between gap-4">
            <label className="flex items-center gap-3 text-sm">
              <input
                type="checkbox"
                className="size-4 accent-[var(--primary)]"
                checked={status === "published"}
                onChange={(e) => setStatus(e.target.checked ? "published" : "draft")}
              />
              Published (visible to students)
            </label>
            <div className="flex items-center gap-2">
              {exam && !readOnly && (
                <Button type="button" variant="ghost" onClick={() => void remove()}>
                  Delete
                </Button>
              )}
              {!readOnly && (
                <Button type="submit">
                  {busy ? "Saving…" : exam ? "Save changes" : "Create exam"}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
        {formError && <Alert>{formError}</Alert>}
        {saved && <Alert variant="success">Saved. The student site updates within a minute.</Alert>}
        {readOnly && <Alert variant="info">Your role can view exams but not change them.</Alert>}
      </fieldset>
    </form>
  );
}
