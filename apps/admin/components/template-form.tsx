"use client";

import { errorMessage, fieldErrors, isApiError, useAuth } from "@mockprep/api-client";
import {
  EXAM_FAMILY_LABELS,
  examFamilySchema,
  examTemplateInputSchema,
  examTemplateSchema,
  examTemplateUpdateSchema,
  questionTypeSchema,
  sectionSwitchingSchema,
  templateSkinSchema,
  type ExamTemplate,
  type QuestionType,
} from "@mockprep/types";
import {
  Alert,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Field,
  Input,
  Select,
  TBody,
  TD,
  TH,
  THead,
  TR,
  Table,
} from "@mockprep/ui";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState, type FormEvent } from "react";
import { z } from "zod";
import { canEditContent } from "@/lib/roles";

interface SectionRow {
  name: string;
  count: string;
  timeMin: string;
  aliases: string;
}

const SKIN_LABELS = {
  ibps: "Banking (IBPS/SBI)",
  ssc: "SSC",
  upsc: "UPSC",
  nta: "NTA (JEE)",
  generic: "Generic",
} as const;
const TYPE_LABELS: Record<QuestionType, string> = {
  mcq_single: "Single-correct MCQ",
  mcq_multi: "Multi-correct MCQ",
  integer: "Integer answer",
  numeric: "Numeric answer",
};

const toMin = (sec: number | undefined) => (sec === undefined ? "" : String(sec / 60));
const num = (value: string) => (value.trim() === "" ? undefined : Number(value));
const templateResponse = z.object({ template: examTemplateSchema });

function emptySection(index: number): SectionRow {
  return { name: `Section ${index + 1}`, count: "25", timeMin: "", aliases: "" };
}

export function TemplateForm({
  template,
  usedBy = [],
}: {
  template?: ExamTemplate;
  usedBy?: { name: string }[];
}) {
  const { api, state } = useAuth();
  const router = useRouter();
  const readOnly = !canEditContent(state.user?.role);

  const [key, setKey] = useState(template?.key ?? "");
  const [name, setName] = useState(template?.name ?? "");
  const [family, setFamily] = useState(template?.family ?? "banking");
  const [skin, setSkin] = useState(template?.skin ?? "generic");
  const [totalMin, setTotalMin] = useState(toMin(template?.totalTimeSec ?? 3600));
  const [optionCount, setOptionCount] = useState(String(template?.optionCount ?? 4));
  const [switching, setSwitching] = useState(template?.sectionSwitching ?? "free");
  const [sections, setSections] = useState<SectionRow[]>(
    template?.sections.map((s) => ({
      name: s.name,
      count: String(s.count),
      timeMin: toMin(s.timeSec),
      aliases: s.aliases.join(", "),
    })) ?? [emptySection(0)],
  );
  const [correct, setCorrect] = useState(String(template?.marking.correct ?? 1));
  const [wrong, setWrong] = useState(String(template?.marking.wrong ?? 0));
  const [byType, setByType] = useState<
    Partial<Record<QuestionType, { correct: string; wrong: string }>>
  >(
    Object.fromEntries(
      Object.entries(template?.markingByType ?? {}).map(([k, m]) => [
        k,
        { correct: String(m.correct), wrong: String(m.wrong) },
      ]),
    ),
  );
  const [qualifying, setQualifying] = useState(
    template?.qualifyingPercent === undefined ? "" : String(template.qualifyingPercent),
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  // Live errors appear only after the first save attempt, then update as you type.
  const [submitted, setSubmitted] = useState(false);

  const input = useMemo(
    () => ({
      key,
      name,
      family,
      skin,
      totalTimeSec: Math.round((num(totalMin) ?? 0) * 60),
      optionCount: Number(optionCount),
      sectionSwitching: switching,
      sections: sections.map((s) => {
        const time = num(s.timeMin);
        return {
          name: s.name,
          count: Number(s.count),
          ...(time === undefined ? {} : { timeSec: Math.round(time * 60) }),
          aliases: s.aliases
            .split(",")
            .map((a) => a.trim())
            .filter(Boolean),
        };
      }),
      marking: { correct: Number(correct), wrong: Number(wrong) },
      ...(Object.keys(byType).length
        ? {
            markingByType: Object.fromEntries(
              Object.entries(byType).map(([k, m]) => [
                k,
                { correct: Number(m.correct), wrong: Number(m.wrong) },
              ]),
            ),
          }
        : {}),
      ...(num(qualifying) === undefined ? {} : { qualifyingPercent: num(qualifying) }),
    }),
    [
      key,
      name,
      family,
      skin,
      totalMin,
      optionCount,
      switching,
      sections,
      correct,
      wrong,
      byType,
      qualifying,
    ],
  );

  const totals = useMemo(() => {
    const questions = input.sections.reduce(
      (acc, s) => acc + (Number.isFinite(s.count) ? s.count : 0),
      0,
    );
    const sectionSec = input.sections.reduce((acc, s) => acc + (s.timeSec ?? 0), 0);
    return {
      questions,
      maxMarks: questions * (Number.isFinite(input.marking.correct) ? input.marking.correct : 0),
      sectionMin: sectionSec / 60,
    };
  }, [input]);

  // Live validation with the same schema the api uses.
  const liveIssues = useMemo(() => {
    const result = examTemplateInputSchema.safeParse(input);
    return result.success ? {} : fieldErrors(result.error.issues);
  }, [input]);
  const err = (path: string) => (submitted ? (liveIssues[path] ?? errors[path]) : errors[path]);

  const updateSection = (index: number, patch: Partial<SectionRow>) =>
    setSections((rows) => rows.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  const moveSection = (index: number, delta: number) =>
    setSections((rows) => {
      const next = [...rows];
      const target = index + delta;
      if (target < 0 || target >= rows.length) return rows;
      [next[index], next[target]] = [next[target] as SectionRow, next[index] as SectionRow];
      return next;
    });

  async function submit(event: FormEvent) {
    event.preventDefault();
    setFormError(null);
    setSaved(false);
    setSubmitted(true);
    const parsed = template
      ? examTemplateUpdateSchema.safeParse(input)
      : examTemplateInputSchema.safeParse(input);
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error.issues));
      setFormError("Fix the highlighted fields.");
      return;
    }
    setErrors({});
    setBusy(true);
    try {
      const res = await api.request(
        template ? `/api/admin/templates/${template.id}` : "/api/admin/templates",
        {
          method: template ? "PUT" : "POST",
          body: parsed.data,
          schema: templateResponse,
        },
      );
      if (template) setSaved(true);
      else router.replace(`/templates/${res.template.id}`);
    } catch (e) {
      if (isApiError(e) && e.status === 409)
        setErrors({ key: "Another template already uses this key" });
      else if (isApiError(e) && e.status === 400) setErrors(fieldErrors(e.details));
      setFormError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!template || !window.confirm(`Delete template “${template.name}”?`)) return;
    try {
      await api.request(`/api/admin/templates/${template.id}`, { method: "DELETE" });
      router.replace("/templates");
    } catch (e) {
      setFormError(errorMessage(e));
    }
  }

  const locked = switching === "locked_sequential";

  return (
    <form onSubmit={submit} noValidate>
      <fieldset disabled={readOnly || busy} className="flex flex-col gap-6">
        {usedBy.length > 0 && (
          <Alert variant="info">
            Used by: {usedBy.map((e) => e.name).join(", ")}. Changes show on their exam pages.
          </Alert>
        )}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Basics</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-5 md:grid-cols-2">
            <Field label="Name" htmlFor="name" error={err("name")}>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="SBI PO Prelims"
              />
            </Field>
            <Field
              label="Key"
              htmlFor="key"
              error={err("key")}
              hint={
                template
                  ? "The key can't change after creation."
                  : "Lowercase and hyphens, e.g. sbi-po-prelims."
              }
            >
              <Input
                id="key"
                value={key}
                onChange={(e) => setKey(e.target.value)}
                disabled={Boolean(template)}
              />
            </Field>
            <Field label="Exam family" htmlFor="family">
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
              label="Test screen skin"
              htmlFor="skin"
              hint="Which real exam interface students see."
            >
              <Select
                id="skin"
                value={skin}
                onChange={(e) => setSkin(templateSkinSchema.parse(e.target.value))}
              >
                {templateSkinSchema.options.map((s) => (
                  <option key={s} value={s}>
                    {SKIN_LABELS[s]}
                  </option>
                ))}
              </Select>
            </Field>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Timing and options</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-5 md:grid-cols-3">
            <Field label="Total time (minutes)" htmlFor="totalMin" error={err("totalTimeSec")}>
              <Input
                id="totalMin"
                type="number"
                min={1}
                step="any"
                value={totalMin}
                onChange={(e) => setTotalMin(e.target.value)}
              />
            </Field>
            <Field label="Options per question" htmlFor="optionCount" error={err("optionCount")}>
              <Select
                id="optionCount"
                value={optionCount}
                onChange={(e) => setOptionCount(e.target.value)}
              >
                {[2, 3, 4, 5, 6].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </Select>
            </Field>
            <Field
              label="Section switching"
              htmlFor="switching"
              hint={
                locked
                  ? "Each section has its own timer and locks when it ends."
                  : "Students move between sections freely."
              }
            >
              <Select
                id="switching"
                value={switching}
                onChange={(e) => setSwitching(sectionSwitchingSchema.parse(e.target.value))}
              >
                <option value="free">Free switching</option>
                <option value="locked_sequential">Locked, in order (sectional timers)</option>
              </Select>
            </Field>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Sections</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <Table>
              <THead>
                <TR>
                  <TH className="w-8">#</TH>
                  <TH>Name</TH>
                  <TH className="w-28">Questions</TH>
                  <TH className="w-32">Time (min){locked ? " *" : ""}</TH>
                  <TH>Also called (for PDF import)</TH>
                  <TH className="w-32">
                    <span className="sr-only">Actions</span>
                  </TH>
                </TR>
              </THead>
              <TBody>
                {sections.map((row, i) => (
                  <TR key={i} className="align-top">
                    <TD className="pt-5 text-muted-foreground tabular-nums">{i + 1}</TD>
                    <TD>
                      <Input
                        aria-label={`Section ${i + 1} name`}
                        value={row.name}
                        onChange={(e) => updateSection(i, { name: e.target.value })}
                        aria-invalid={err(`sections.${i}.name`) ? true : undefined}
                      />
                      {err(`sections.${i}.name`) && (
                        <p className="mt-1 text-xs text-destructive">{err(`sections.${i}.name`)}</p>
                      )}
                    </TD>
                    <TD>
                      <Input
                        aria-label={`Section ${i + 1} questions`}
                        type="number"
                        min={1}
                        value={row.count}
                        onChange={(e) => updateSection(i, { count: e.target.value })}
                        aria-invalid={err(`sections.${i}.count`) ? true : undefined}
                      />
                    </TD>
                    <TD>
                      <Input
                        aria-label={`Section ${i + 1} time in minutes`}
                        type="number"
                        min={1}
                        step="any"
                        value={row.timeMin}
                        placeholder={locked ? "required" : "–"}
                        onChange={(e) => updateSection(i, { timeMin: e.target.value })}
                        aria-invalid={err(`sections.${i}.timeSec`) ? true : undefined}
                      />
                      {err(`sections.${i}.timeSec`) && (
                        <p className="mt-1 text-xs text-destructive">
                          {err(`sections.${i}.timeSec`)}
                        </p>
                      )}
                    </TD>
                    <TD>
                      <Input
                        aria-label={`Section ${i + 1} aliases`}
                        value={row.aliases}
                        placeholder="Quant, Maths"
                        onChange={(e) => updateSection(i, { aliases: e.target.value })}
                      />
                    </TD>
                    <TD>
                      <div className="flex">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          aria-label="Move up"
                          onClick={() => moveSection(i, -1)}
                          disabled={i === 0}
                        >
                          <ArrowUp />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          aria-label="Move down"
                          onClick={() => moveSection(i, 1)}
                          disabled={i === sections.length - 1}
                        >
                          <ArrowDown />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          aria-label="Remove section"
                          onClick={() => setSections((rows) => rows.filter((_, j) => j !== i))}
                          disabled={sections.length === 1}
                        >
                          <Trash2 />
                        </Button>
                      </div>
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setSections((rows) => [...rows, emptySection(rows.length)])}
              >
                <Plus /> Add section
              </Button>
              <p className="text-sm text-muted-foreground" aria-live="polite">
                {totals.questions} questions · max {totals.maxMarks} marks
                {totals.sectionMin > 0 &&
                  ` · section times ${totals.sectionMin} of ${totalMin || 0} min`}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Marking</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-5">
            <div className="grid gap-5 md:grid-cols-3">
              <Field label="Correct answer" htmlFor="correct" error={err("marking.correct")}>
                <Input
                  id="correct"
                  type="number"
                  step="any"
                  min={0}
                  value={correct}
                  onChange={(e) => setCorrect(e.target.value)}
                />
              </Field>
              <Field
                label="Wrong answer"
                htmlFor="wrong"
                error={err("marking.wrong")}
                hint="Negative marking, e.g. -0.25. Unanswered is 0."
              >
                <Input
                  id="wrong"
                  type="number"
                  step="any"
                  max={0}
                  value={wrong}
                  onChange={(e) => setWrong(e.target.value)}
                />
              </Field>
              <Field
                label="Qualifying % (optional)"
                htmlFor="qualifying"
                error={err("qualifyingPercent")}
                hint="For qualifying papers like CSAT (33)."
              >
                <Input
                  id="qualifying"
                  type="number"
                  min={0}
                  max={100}
                  step="any"
                  value={qualifying}
                  onChange={(e) => setQualifying(e.target.value)}
                />
              </Field>
            </div>
            <div className="flex flex-col gap-2">
              <p className="text-sm font-medium">
                Different marking for some question types (optional)
              </p>
              {questionTypeSchema.options.map((type) => {
                const override = byType[type];
                return (
                  <div key={type} className="flex flex-wrap items-center gap-3 text-sm">
                    <label className="flex w-52 items-center gap-2">
                      <input
                        type="checkbox"
                        className="size-4 accent-[var(--primary)]"
                        checked={Boolean(override)}
                        onChange={(e) =>
                          setByType((current) => {
                            const next = { ...current };
                            if (e.target.checked) next[type] = { correct, wrong };
                            else delete next[type];
                            return next;
                          })
                        }
                      />
                      {TYPE_LABELS[type]}
                    </label>
                    {override && (
                      <>
                        <Input
                          aria-label={`${TYPE_LABELS[type]} correct`}
                          className="h-9 w-24"
                          type="number"
                          step="any"
                          value={override.correct}
                          onChange={(e) =>
                            setByType((c) => ({
                              ...c,
                              [type]: { ...override, correct: e.target.value },
                            }))
                          }
                        />
                        <Input
                          aria-label={`${TYPE_LABELS[type]} wrong`}
                          className="h-9 w-24"
                          type="number"
                          step="any"
                          value={override.wrong}
                          onChange={(e) =>
                            setByType((c) => ({
                              ...c,
                              [type]: { ...override, wrong: e.target.value },
                            }))
                          }
                        />
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {formError && <Alert>{formError}</Alert>}
        {saved && <Alert variant="success">Saved.</Alert>}
        {readOnly && (
          <Alert variant="info">Your role can view templates but not change them.</Alert>
        )}
        {!readOnly && (
          <div className="flex justify-end gap-2">
            {template && usedBy.length === 0 && (
              <Button type="button" variant="ghost" onClick={() => void remove()}>
                Delete
              </Button>
            )}
            <Button type="submit">
              {busy ? "Saving…" : template ? "Save changes" : "Create template"}
            </Button>
          </div>
        )}
      </fieldset>
    </form>
  );
}
