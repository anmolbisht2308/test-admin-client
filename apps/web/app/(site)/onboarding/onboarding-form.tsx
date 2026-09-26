"use client";

import { errorMessage, fieldErrors, isApiError, useAuth } from "@mockprep/api-client";
import {
  EXAM_FAMILY_LABELS,
  examListResponseSchema,
  onboardingInputSchema,
  userSchema,
  type Exam,
  type Language,
} from "@mockprep/types";
import { Alert, Button, Field, Input, cn } from "@mockprep/ui";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { z } from "zod";
import { useRequireStudent } from "@/lib/use-require-student";

const LANGUAGES: { value: Language; label: string }[] = [
  { value: "en", label: "English" },
  { value: "hi", label: "हिन्दी (Hindi)" },
];

export function OnboardingForm() {
  const user = useRequireStudent({ allowNotOnboarded: true });
  const { api, setUser } = useAuth();
  const router = useRouter();
  const [exams, setExams] = useState<Exam[] | null>(null);
  const [name, setName] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [language, setLanguage] = useState<Language>("en");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!user) return;
    setName((n) => n || user.name || "");
    setSelected((s) => (s.length ? s : user.targetExamSlugs));
    setLanguage(user.language);
  }, [user]);

  useEffect(() => {
    api
      .request("/api/exams", { auth: false, schema: examListResponseSchema })
      .then((res) => setExams(res.exams))
      .catch((e: unknown) => setFormError(errorMessage(e)));
  }, [api]);

  if (!user) return <p className="text-sm text-muted-foreground">Loading…</p>;

  const toggle = (slug: string) =>
    setSelected((current) =>
      current.includes(slug) ? current.filter((s) => s !== slug) : [...current, slug],
    );

  async function submit(event: FormEvent) {
    event.preventDefault();
    setFormError(null);
    const input = { name, targetExamSlugs: selected, language };
    const parsed = onboardingInputSchema.safeParse(input);
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error.issues));
      return;
    }
    setErrors({});
    setBusy(true);
    try {
      const res = await api.request("/api/me/onboarding", {
        method: "PATCH",
        body: parsed.data,
        schema: z.object({ user: userSchema }),
      });
      setUser(res.user);
      router.replace("/home");
    } catch (e) {
      if (isApiError(e) && e.status === 400) setErrors(fieldErrors(e.details));
      setFormError(errorMessage(e));
      setBusy(false);
    }
  }

  const families = exams
    ? (Object.keys(EXAM_FAMILY_LABELS) as (keyof typeof EXAM_FAMILY_LABELS)[])
        .map((family) => ({ family, exams: exams.filter((e) => e.family === family) }))
        .filter((g) => g.exams.length > 0)
    : [];

  return (
    <form onSubmit={submit} className="flex flex-col gap-6" noValidate>
      <Field label="Your name" htmlFor="name" error={errors.name}>
        <Input
          id="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoComplete="name"
          aria-invalid={errors.name ? true : undefined}
        />
      </Field>

      <fieldset className="flex flex-col gap-3">
        <legend className="mb-2 text-sm font-medium">Which exams are you preparing for?</legend>
        {exams === null && !formError && (
          <p className="text-sm text-muted-foreground">Loading exams…</p>
        )}
        {families.map((group) => (
          <div key={group.family} className="flex flex-col gap-2">
            <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              {EXAM_FAMILY_LABELS[group.family]}
            </span>
            <div className="flex flex-wrap gap-2">
              {group.exams.map((exam) => {
                const on = selected.includes(exam.slug);
                return (
                  <button
                    key={exam.slug}
                    type="button"
                    aria-pressed={on}
                    onClick={() => toggle(exam.slug)}
                    className={cn(
                      "inline-flex h-11 items-center rounded-full border px-4 text-sm transition-colors",
                      on ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted",
                    )}
                  >
                    {exam.shortName}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
        {errors.targetExamSlugs && (
          <p className="text-sm text-destructive">{errors.targetExamSlugs}</p>
        )}
      </fieldset>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-sm font-medium">Preferred language for questions</legend>
        <div className="flex flex-wrap gap-2">
          {LANGUAGES.map((l) => (
            <label
              key={l.value}
              className={cn(
                "inline-flex h-11 cursor-pointer items-center gap-2 rounded-md border px-4 text-sm",
                language === l.value && "border-primary ring-1 ring-primary",
              )}
            >
              <input
                type="radio"
                name="language"
                value={l.value}
                checked={language === l.value}
                onChange={() => setLanguage(l.value)}
                className="accent-[var(--primary)]"
              />
              {l.label}
            </label>
          ))}
        </div>
      </fieldset>

      {formError && <Alert>{formError}</Alert>}
      <Button type="submit" size="lg" disabled={busy}>
        {busy ? "Saving…" : "Continue"}
      </Button>
    </form>
  );
}
