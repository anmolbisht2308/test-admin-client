"use client";

import { errorMessage, fieldErrors, isApiError, useAuth } from "@mockprep/api-client";
import {
  MAX_OPTIONS,
  difficultySchema,
  examListResponseSchema,
  examTemplateListResponseSchema,
  isNumericType,
  questionInputSchema,
  questionSaveResponseSchema,
  questionTypeSchema,
  taxonomyListResponseSchema,
  type Question,
  type QuestionInput,
  type QuestionType,
} from "@mockprep/types";
import {
  Alert,
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Field,
  Input,
  Select,
  Textarea,
  cn,
} from "@mockprep/ui";
import { ImagePlus, Plus, Trash2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState, type FormEvent } from "react";
import { QuestionPreview } from "@/components/question-preview";
import { letter } from "@/lib/format";
import { canEditContent } from "@/lib/roles";
import { uploadFigure } from "@/lib/upload";
import { useApiQuery } from "@/lib/use-api-query";

const TYPE_LABELS: Record<QuestionType, string> = {
  mcq_single: "Single-correct MCQ",
  mcq_multi: "Multi-correct MCQ",
  integer: "Integer answer",
  numeric: "Numeric answer (range)",
};

type Draft = Required<
  Omit<QuestionInput, "numAnswer" | "number" | "sourcePage" | "figureUrl" | "uploadId">
> & {
  numMin: string;
  numMax: string;
  number: string;
  figureUrl: string | null;
};

function toDraft(q?: Question): Draft {
  return {
    examKey: q?.examKey ?? "",
    section: q?.section ?? "",
    order: q?.order ?? 0,
    type: q?.type ?? "mcq_single",
    passage: q?.passage ?? "",
    passageHi: q?.passageHi ?? "",
    stem: q?.stem ?? "",
    options: q?.options ?? ["", "", "", ""],
    stemHi: q?.stemHi ?? "",
    optionsHi: q?.optionsHi ?? [],
    correct: q?.correct ?? [],
    numMin: q?.numAnswer ? String(q.numAnswer.min) : "",
    numMax: q?.numAnswer ? String(q.numAnswer.max) : "",
    answerSource: q?.answerSource ?? "manual",
    solution: q?.solution ?? "",
    solutionHi: q?.solutionHi ?? "",
    subject: q?.subject ?? "",
    topic: q?.topic ?? "",
    taxonomyIds: q?.taxonomyIds ?? [],
    difficulty: q?.difficulty ?? "medium",
    hasFigure: q?.hasFigure ?? false,
    figureUrl: q?.figureUrl ?? null,
    confidence: q?.confidence ?? 1,
    status: q?.status ?? "approved",
    number: q?.number ? String(q.number) : "",
  };
}

export function QuestionEditor({ question }: { question?: Question }) {
  const { api, state } = useAuth();
  const router = useRouter();
  const readOnly = !canEditContent(state.user?.role) || question?.isLatest === false;
  const exams = useApiQuery("/api/admin/exams", examListResponseSchema);
  const templates = useApiQuery("/api/admin/templates", examTemplateListResponseSchema);
  const [d, setD] = useState<Draft>(() => toDraft(question));
  const [lang, setLang] = useState<"en" | "hi">("en");
  const [previewLang, setPreviewLang] = useState<"en" | "hi">("en");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<{
    kind: "error" | "success" | "info";
    text: string;
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) =>
    setD((current) => ({ ...current, [key]: value }));
  const exam = exams.data?.exams.find((e) => e.slug === d.examKey);
  const family = exam?.family;
  const taxonomy = useApiQuery(
    family ? `/api/admin/taxonomy?examFamily=${family}` : null,
    taxonomyListResponseSchema,
  );
  const sectionNames = useMemo(() => {
    const keys = new Set(exam?.templateKeys ?? []);
    return [
      ...new Set(
        (templates.data?.templates ?? [])
          .filter((t) => keys.has(t.key))
          .flatMap((t) => t.sections.map((s) => s.name)),
      ),
    ];
  }, [exam, templates.data]);
  const numeric = isNumericType(d.type);
  const hiOptions = d.options.map((_, i) => d.optionsHi[i] ?? "");

  const input: QuestionInput = {
    ...d,
    number: d.number ? Number(d.number) : null,
    options: numeric ? [] : d.options,
    optionsHi: numeric || hiOptions.every((o) => !o.trim()) ? [] : hiOptions,
    correct: numeric ? [] : d.correct,
    numAnswer:
      numeric && d.numMin !== ""
        ? { min: Number(d.numMin), max: Number(d.numMax === "" ? d.numMin : d.numMax) }
        : null,
    uploadId: question?.uploadId ?? null,
    sourcePage: question?.sourcePage ?? null,
  };

  function toggleCorrect(index: number) {
    if (readOnly) return;
    setD((current) => {
      if (current.type === "mcq_multi") {
        const has = current.correct.includes(index);
        return {
          ...current,
          correct: has
            ? current.correct.filter((c) => c !== index)
            : [...current.correct, index].sort(),
        };
      }
      return { ...current, correct: current.correct[0] === index ? [] : [index] };
    });
  }

  function setOption(index: number, value: string, hindi: boolean) {
    setD((current) => {
      if (hindi) {
        const next = current.options.map((_, i) => current.optionsHi[i] ?? "");
        next[index] = value;
        return { ...current, optionsHi: next };
      }
      const next = [...current.options];
      next[index] = value;
      return { ...current, options: next };
    });
  }

  function removeOption(index: number) {
    setD((current) => ({
      ...current,
      options: current.options.filter((_, i) => i !== index),
      optionsHi: current.optionsHi.filter((_, i) => i !== index),
      correct: current.correct.filter((c) => c !== index).map((c) => (c > index ? c - 1 : c)),
    }));
  }

  async function onFile(file: File | undefined) {
    if (!file) return;
    setUploading(true);
    setMessage(null);
    try {
      const url = await uploadFigure(api, file);
      setD((current) => ({ ...current, figureUrl: url, hasFigure: true }));
    } catch (e) {
      setMessage({ kind: "error", text: errorMessage(e) });
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setMessage(null);
    const parsed = questionInputSchema.safeParse(input);
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error.issues));
      setMessage({ kind: "error", text: "Fix the highlighted fields." });
      return;
    }
    setErrors({});
    setBusy(true);
    try {
      const res = await api.request(
        question ? `/api/admin/questions/${question.id}` : "/api/admin/questions",
        {
          method: question ? "PUT" : "POST",
          body: parsed.data,
          schema: questionSaveResponseSchema,
        },
      );
      if (!question) {
        router.replace(`/questions/${res.question.id}`);
        return;
      }
      if (res.versioned) {
        router.replace(`/questions/${res.question.id}?versioned=${res.question.version}`);
        return;
      }
      setMessage({ kind: "success", text: "Saved." });
    } catch (e) {
      if (isApiError(e) && e.status === 400) setErrors(fieldErrors(e.details));
      setMessage({ kind: "error", text: errorMessage(e) });
    } finally {
      setBusy(false);
    }
  }

  const err = (path: string) => errors[path];
  const hindi = lang === "hi";

  return (
    <form
      onSubmit={submit}
      noValidate
      className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,420px)]"
    >
      <fieldset disabled={readOnly || busy} className="flex min-w-0 flex-col gap-6">
        <Card>
          <CardContent className="grid gap-4 md:grid-cols-3">
            <Field label="Exam" htmlFor="examKey" error={err("examKey")}>
              <Select
                id="examKey"
                value={d.examKey}
                onChange={(e) => set("examKey", e.target.value)}
              >
                <option value="">Choose…</option>
                {exams.data?.exams.map((e) => (
                  <option key={e.slug} value={e.slug}>
                    {e.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Section" htmlFor="section" error={err("section")}>
              <Input
                id="section"
                list="section-names"
                value={d.section}
                onChange={(e) => set("section", e.target.value)}
              />
              <datalist id="section-names">
                {sectionNames.map((n) => (
                  <option key={n} value={n} />
                ))}
              </datalist>
            </Field>
            <Field label="Question type" htmlFor="type">
              <Select
                id="type"
                value={d.type}
                onChange={(e) => {
                  const type = questionTypeSchema.parse(e.target.value);
                  setD((c) => ({
                    ...c,
                    type,
                    correct: type === "mcq_single" ? c.correct.slice(0, 1) : c.correct,
                    options: isNumericType(type)
                      ? c.options
                      : c.options.length
                        ? c.options
                        : ["", "", "", ""],
                  }));
                }}
              >
                {questionTypeSchema.options.map((t) => (
                  <option key={t} value={t}>
                    {TYPE_LABELS[t]}
                  </option>
                ))}
              </Select>
            </Field>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="text-base">Content</CardTitle>
            <div role="tablist" className="flex rounded-md border p-0.5">
              {(["en", "hi"] as const).map((l) => (
                <button
                  key={l}
                  type="button"
                  role="tab"
                  aria-selected={lang === l}
                  onClick={() => setLang(l)}
                  className={cn(
                    "h-8 rounded px-3 text-sm",
                    lang === l ? "bg-primary text-primary-foreground" : "text-muted-foreground",
                  )}
                >
                  {l === "en" ? "English" : "हिन्दी"}
                </button>
              ))}
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <p className="text-xs text-muted-foreground">
              Markdown supported. Maths in $…$ (inline) or $$…$$ (display). Tables as Markdown
              tables.
            </p>
            <Field
              label={
                hindi
                  ? "Passage (Hindi, optional)"
                  : "Passage (optional, shared by RC/DI questions)"
              }
              htmlFor="passage"
            >
              <Textarea
                id="passage"
                rows={3}
                value={hindi ? d.passageHi : d.passage}
                onChange={(e) => set(hindi ? "passageHi" : "passage", e.target.value)}
                lang={lang}
              />
            </Field>
            <Field
              label={hindi ? "Question (Hindi)" : "Question"}
              htmlFor="stem"
              error={err(hindi ? "stemHi" : "stem")}
            >
              <Textarea
                id="stem"
                rows={4}
                value={hindi ? d.stemHi : d.stem}
                onChange={(e) => set(hindi ? "stemHi" : "stem", e.target.value)}
                lang={lang}
                aria-invalid={err("stem") ? true : undefined}
              />
            </Field>

            {numeric ? (
              <div className="grid grid-cols-2 gap-4">
                <Field
                  label="Answer (min)"
                  htmlFor="numMin"
                  error={err("numAnswer") ?? err("numAnswer.min")}
                >
                  <Input
                    id="numMin"
                    type="number"
                    step="any"
                    value={d.numMin}
                    onChange={(e) => set("numMin", e.target.value)}
                  />
                </Field>
                <Field
                  label="Answer (max, optional)"
                  htmlFor="numMax"
                  error={err("numAnswer.max")}
                  hint="Leave empty for an exact answer."
                >
                  <Input
                    id="numMax"
                    type="number"
                    step="any"
                    value={d.numMax}
                    onChange={(e) => set("numMax", e.target.value)}
                  />
                </Field>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                <p className="text-sm font-medium">
                  Options{" "}
                  <span className="font-normal text-muted-foreground">
                    — click a letter to mark it correct
                    {d.type === "mcq_multi" ? " (several allowed)" : ""}
                  </span>
                </p>
                {d.options.map((option, i) => {
                  const correct = d.correct.includes(i);
                  return (
                    <div key={i} className="flex items-start gap-2">
                      <button
                        type="button"
                        onClick={() => toggleCorrect(i)}
                        aria-pressed={correct}
                        aria-label={`Mark option ${letter(i)} correct`}
                        className={cn(
                          "inline-flex size-11 shrink-0 items-center justify-center rounded-md border text-sm font-semibold",
                          correct
                            ? "border-success bg-success text-success-foreground"
                            : "hover:bg-muted",
                        )}
                      >
                        {letter(i)}
                      </button>
                      <Textarea
                        rows={1}
                        className="min-h-11"
                        aria-label={`Option ${letter(i)}${hindi ? " (Hindi)" : ""}`}
                        value={hindi ? (hiOptions[i] ?? "") : option}
                        onChange={(e) => setOption(i, e.target.value, hindi)}
                        lang={lang}
                        aria-invalid={err(`options.${i}`) ? true : undefined}
                      />
                      {!hindi && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          aria-label={`Remove option ${letter(i)}`}
                          onClick={() => removeOption(i)}
                          disabled={d.options.length <= 2}
                        >
                          <Trash2 />
                        </Button>
                      )}
                    </div>
                  );
                })}
                {!hindi && d.options.length < MAX_OPTIONS && (
                  <div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => set("options", [...d.options, ""])}
                    >
                      <Plus /> Add option
                    </Button>
                  </div>
                )}
                {(err("correct") ?? err("options") ?? err("optionsHi")) && (
                  <p className="text-sm text-destructive">
                    {err("correct") ?? err("options") ?? err("optionsHi")}
                  </p>
                )}
              </div>
            )}

            <Field label={hindi ? "Solution (Hindi)" : "Solution"} htmlFor="solution">
              <Textarea
                id="solution"
                rows={3}
                value={hindi ? d.solutionHi : d.solution}
                onChange={(e) => set(hindi ? "solutionHi" : "solution", e.target.value)}
                lang={lang}
              />
            </Field>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Figure</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center gap-3">
            <input
              ref={fileInput}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              className="hidden"
              onChange={(e) => void onFile(e.target.files?.[0])}
            />
            <Button
              type="button"
              variant="outline"
              onClick={() => fileInput.current?.click()}
              disabled={uploading}
            >
              <ImagePlus />{" "}
              {uploading ? "Uploading…" : d.figureUrl ? "Replace image" : "Upload image"}
            </Button>
            {d.figureUrl && (
              <Button
                type="button"
                variant="ghost"
                onClick={() => setD((c) => ({ ...c, figureUrl: null, hasFigure: false }))}
              >
                <X /> Remove
              </Button>
            )}
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="size-4 accent-[var(--primary)]"
                checked={d.hasFigure}
                onChange={(e) => set("hasFigure", e.target.checked)}
              />
              Question needs a figure
            </label>
            {err("figureUrl") && (
              <p className="w-full text-sm text-destructive">{err("figureUrl")}</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Tags</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-3">
            <Field label="Subject" htmlFor="subject">
              <Input
                id="subject"
                value={d.subject}
                onChange={(e) => set("subject", e.target.value)}
              />
            </Field>
            <Field label="Topic" htmlFor="topic">
              <Input id="topic" value={d.topic} onChange={(e) => set("topic", e.target.value)} />
            </Field>
            <Field label="Difficulty" htmlFor="difficulty">
              <Select
                id="difficulty"
                value={d.difficulty}
                onChange={(e) => set("difficulty", difficultySchema.parse(e.target.value))}
              >
                {difficultySchema.options.map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </Select>
            </Field>
            <Field
              label="Taxonomy"
              htmlFor="taxonomy"
              className="md:col-span-2"
              hint={family ? undefined : "Pick an exam to load its taxonomy."}
            >
              <Select
                id="taxonomy"
                value=""
                onChange={(e) => {
                  const node = taxonomy.data?.nodes.find((n) => n.id === e.target.value);
                  if (!node) return;
                  const byId = new Map(taxonomy.data?.nodes.map((n) => [n.id, n]));
                  const chain = node.path
                    .split("/")
                    .filter(Boolean)
                    .map((id) => byId.get(id)?.name ?? "");
                  setD((c) => ({
                    ...c,
                    taxonomyIds: [...new Set([...c.taxonomyIds, node.id])],
                    subject: c.subject || (chain[0] ?? ""),
                    topic: c.topic || (chain[1] ?? ""),
                  }));
                }}
              >
                <option value="">Add a subject / topic…</option>
                {taxonomy.data?.nodes.map((n) => (
                  <option
                    key={n.id}
                    value={n.id}
                  >{`${"  ".repeat(n.path.split("/").filter(Boolean).length - 1)}${n.name}`}</option>
                ))}
              </Select>
              <div className="flex flex-wrap gap-1">
                {d.taxonomyIds.map((id) => (
                  <Badge key={id} variant="secondary" className="gap-1">
                    {taxonomy.data?.nodes.find((n) => n.id === id)?.name ?? "…"}
                    <button
                      type="button"
                      aria-label="Remove tag"
                      onClick={() =>
                        set(
                          "taxonomyIds",
                          d.taxonomyIds.filter((t) => t !== id),
                        )
                      }
                    >
                      <X className="size-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            </Field>
            <Field label="Number (as printed)" htmlFor="number">
              <Input
                id="number"
                type="number"
                min={1}
                value={d.number}
                onChange={(e) => set("number", e.target.value)}
              />
            </Field>
          </CardContent>
        </Card>

        {message && <Alert variant={message.kind}>{message.text}</Alert>}
        {question?.isLatest === false && (
          <Alert variant="info">
            This is an old version kept for published tests. It can&apos;t be edited.
          </Alert>
        )}
        {!readOnly && (
          <div className="flex flex-wrap items-center justify-end gap-3">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="size-4 accent-[var(--primary)]"
                checked={d.status === "approved"}
                onChange={(e) => set("status", e.target.checked ? "approved" : "draft")}
              />
              Approved (usable in tests)
            </label>
            <Button type="submit">
              {busy ? "Saving…" : question ? "Save question" : "Create question"}
            </Button>
          </div>
        )}
      </fieldset>

      <aside className="xl:sticky xl:top-6 xl:self-start">
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="text-base">Student view</CardTitle>
            <Select
              aria-label="Preview language"
              className="h-8 w-28"
              value={previewLang}
              onChange={(e) => setPreviewLang(e.target.value === "hi" ? "hi" : "en")}
            >
              <option value="en">English</option>
              <option value="hi">हिन्दी</option>
            </Select>
          </CardHeader>
          <CardContent>
            <QuestionPreview
              question={input}
              language={previewLang}
              showAnswer
              onOptionClick={readOnly || numeric ? undefined : toggleCorrect}
            />
          </CardContent>
        </Card>
      </aside>
    </form>
  );
}
