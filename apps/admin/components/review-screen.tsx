"use client";

import { errorMessage, isApiError, useAuth } from "@mockprep/api-client";
import {
  FLAG_LABELS,
  MAX_OPTIONS,
  adminTestResponseSchema,
  approveAnsweredResponseSchema,
  difficultySchema,
  isNumericType,
  questionInputSchema,
  questionSaveResponseSchema,
  questionTypeSchema,
  uploadSchema,
  validationFlagSchema,
  type AdminTestResponse,
  type AnswerSource,
  type Question,
  type Upload,
} from "@mockprep/types";
import { Alert, Badge, Button, Field, Input, Select, Textarea, cn } from "@mockprep/ui";
import {
  ArrowLeft,
  Check,
  CheckCheck,
  ChevronDown,
  ChevronUp,
  Eye,
  FileText,
  ImagePlus,
  Plus,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { QuestionPreview } from "@/components/question-preview";
import { letter, snippet } from "@/lib/format";
import { canEditContent } from "@/lib/roles";
import { toInput, toggleAnswer } from "@/lib/review";
import { uploadFigure } from "@/lib/upload";

const SOURCE_LABELS: Record<
  AnswerSource,
  { label: string; tone: "success" | "secondary" | "destructive" | "outline" }
> = {
  key: { label: "Answer: key", tone: "success" },
  document: { label: "Answer: paper", tone: "success" },
  ai: { label: "Answer: AI · verify", tone: "destructive" },
  manual: { label: "Answer: you", tone: "secondary" },
  none: { label: "No answer", tone: "destructive" },
};

const TYPE_LABELS = {
  mcq_single: "Single correct",
  mcq_multi: "Multi correct",
  integer: "Integer",
  numeric: "Numeric",
} as const;

const typingTarget = (el: EventTarget | null) =>
  el instanceof HTMLElement &&
  (el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName));

type Notice = { kind: "error" | "success" | "info"; text: string } | null;

export function ReviewScreen({ testId }: { testId: string }) {
  const { api, state } = useAuth();
  const canEdit = canEditContent(state.user?.role);
  const [data, setData] = useState<AdminTestResponse | null>(null);
  const [upload, setUpload] = useState<Upload | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [filter, setFilter] = useState<"review" | "all">("review");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Question | null>(null);
  const [lang, setLang] = useState<"en" | "hi">("en");
  const [showPdf, setShowPdf] = useState(true);
  const [notice, setNotice] = useState<Notice>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [meta, setMeta] = useState({ title: "", isFree: true });
  const figureInput = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    try {
      const res = await api.request(`/api/admin/tests/${testId}`, {
        schema: adminTestResponseSchema,
      });
      setData(res);
      setMeta({ title: res.test.title, isFree: res.test.isFree });
      if (res.test.uploadId) {
        setUpload(
          await api.request(`/api/admin/uploads/${res.test.uploadId}`, { schema: uploadSchema }),
        );
      }
      return res;
    } catch (e) {
      setLoadError(errorMessage(e));
      return null;
    }
  }, [api, testId]);

  useEffect(() => {
    void load().then((res) => {
      if (!res) return;
      const ids = res.test.sections.flatMap((s) => s.questionIds);
      const first = ids.find((id) => res.questions[id]?.status === "draft") ?? ids[0] ?? null;
      setSelectedId(first);
      setFilter(ids.some((id) => res.questions[id]?.status === "draft") ? "review" : "all");
    });
  }, [load]);

  const test = data?.test;
  const published = test?.status === "published";
  const readOnly = !canEdit || published;

  /** Question ids per section, filtered by the To review / All toggle. */
  const groups = useMemo(() => {
    if (!data) return [];
    return data.test.sections.map((s) => ({
      name: s.name,
      ids: s.questionIds.filter(
        (id) => filter === "all" || data.questions[id]?.status === "draft" || id === selectedId,
      ),
    }));
  }, [data, filter, selectedId]);
  const visible = useMemo(() => groups.flatMap((g) => g.ids), [groups]);
  const toReview = data
    ? data.test.sections
        .flatMap((s) => s.questionIds)
        .filter((id) => data.questions[id]?.status === "draft").length
    : 0;

  const saved = selectedId ? (data?.questions[selectedId] ?? null) : null;
  useEffect(() => setDraft(saved), [saved]);
  const dirty = draft !== null && saved !== null && JSON.stringify(draft) !== JSON.stringify(saved);

  const replaceQuestion = (oldId: string, q: Question) =>
    setData((d) => {
      if (!d) return d;
      const questions = { ...d.questions, [q.id]: q };
      const sections = d.test.sections.map((s) => ({
        ...s,
        questionIds: s.questionIds.map((id) => (id === oldId ? q.id : id)),
      }));
      return { ...d, questions, test: { ...d.test, sections } };
    });

  /** Saves the current edits. Returns the saved question, or null on failure. */
  const save = useCallback(async (): Promise<Question | null> => {
    if (!draft || !saved) return null;
    if (!dirty) return saved;
    const parsed = questionInputSchema.safeParse({ ...toInput(draft), status: "draft" });
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      setNotice({
        kind: "error",
        text: `${issue?.path.join(".") ?? ""}: ${issue?.message ?? "invalid"}`,
      });
      return null;
    }
    setBusy("save");
    try {
      const res = await api.request(`/api/admin/questions/${saved.id}`, {
        method: "PUT",
        body: parsed.data,
        schema: questionSaveResponseSchema,
      });
      replaceQuestion(saved.id, res.question);
      if (res.question.id !== saved.id) setSelectedId(res.question.id);
      setNotice({ kind: "success", text: "Saved." });
      return res.question;
    } catch (e) {
      setNotice({ kind: "error", text: errorMessage(e) });
      return null;
    } finally {
      setBusy(null);
    }
  }, [api, draft, saved, dirty]);

  /** Moves to another question, saving unsaved edits first. */
  const go = useCallback(
    async (id: string | null | undefined) => {
      if (!id || id === selectedId) return;
      if (dirty && !(await save())) return;
      setNotice(null);
      setSelectedId(id);
    },
    [dirty, save, selectedId],
  );
  const step = (delta: number) => {
    const i = selectedId ? visible.indexOf(selectedId) : -1;
    void go(visible[Math.min(visible.length - 1, Math.max(0, i + delta))]);
  };

  async function approveAndNext() {
    if (!saved || readOnly) return;
    const current = await save();
    if (!current) return;
    const i = visible.indexOf(selectedId ?? "");
    const next =
      visible.slice(i + 1).find((id) => data?.questions[id]?.status === "draft") ??
      visible.find((id) => id !== current.id && data?.questions[id]?.status === "draft");
    setBusy("approve");
    try {
      const res = await api.request(`/api/admin/questions/${current.id}/approve`, {
        method: "POST",
        schema: questionSaveResponseSchema,
      });
      replaceQuestion(current.id, res.question);
      setNotice({ kind: "success", text: `Q${current.number ?? ""} approved.` });
      if (next) setSelectedId(next);
    } catch (e) {
      setNotice({ kind: "error", text: errorMessage(e) });
    } finally {
      setBusy(null);
    }
  }

  async function approveAnswered() {
    if (dirty && !(await save())) return;
    setBusy("approveAll");
    try {
      const res = await api.request(`/api/admin/tests/${testId}/approve-answered`, {
        method: "POST",
        schema: approveAnsweredResponseSchema,
      });
      await load();
      setNotice({
        kind: "success",
        text: `${res.approved} approved.${res.remaining ? ` ${res.remaining} still need you (no text, no answer or a missing figure).` : ""}`,
      });
    } catch (e) {
      setNotice({ kind: "error", text: errorMessage(e) });
    } finally {
      setBusy(null);
    }
  }

  async function saveMeta(next: { title: string; isFree: boolean }) {
    if (!test || readOnly || next.title.trim().length < 2) return;
    if (next.title === test.title && next.isFree === test.isFree) return;
    try {
      const res = await api.request(`/api/admin/tests/${testId}`, {
        method: "PUT",
        body: {
          title: next.title.trim(),
          type: test.type,
          isFree: next.isFree,
          publishAt: test.publishAt,
          sections: test.sections.map((s) => ({ name: s.name, questionIds: s.questionIds })),
        },
        schema: adminTestResponseSchema,
      });
      setData((d) => (d ? { ...d, test: res.test, checks: res.checks } : d));
    } catch (e) {
      setNotice({ kind: "error", text: errorMessage(e) });
    }
  }

  /** Moves the selected question to another section of the test (and tags it with that section). */
  async function moveToSection(name: string) {
    if (!test || !draft || !selectedId || readOnly) return;
    const sections = test.sections.map((s) => ({
      name: s.name,
      questionIds:
        s.name === name
          ? [...s.questionIds.filter((id) => id !== selectedId), selectedId]
          : s.questionIds.filter((id) => id !== selectedId),
    }));
    setDraft({ ...draft, section: name });
    try {
      const res = await api.request(`/api/admin/tests/${testId}`, {
        method: "PUT",
        body: {
          title: test.title,
          type: test.type,
          isFree: test.isFree,
          publishAt: test.publishAt,
          sections,
        },
        schema: adminTestResponseSchema,
      });
      setData((d) => (d ? { ...d, test: res.test, checks: res.checks } : d));
    } catch (e) {
      setNotice({ kind: "error", text: errorMessage(e) });
    }
  }

  async function publish(force = false) {
    if (dirty && !(await save())) return;
    setBusy("publish");
    try {
      const res = await api.request(`/api/admin/tests/${testId}/publish`, {
        method: "POST",
        body: { force },
        schema: adminTestResponseSchema,
      });
      setData(res);
      setNotice({ kind: "success", text: "Published. It shows on the exam page within a minute." });
    } catch (e) {
      const details = isApiError(e) ? (e.details as { canForce?: boolean } | undefined) : undefined;
      if (isApiError(e) && e.status === 409 && details?.canForce && !force) {
        setBusy(null);
        if (window.confirm(`${e.message}. Publish anyway?`)) await publish(true);
        return;
      }
      setNotice({ kind: "error", text: errorMessage(e) });
    } finally {
      setBusy(null);
    }
  }

  async function onFigure(file: File | undefined) {
    if (!file || !draft) return;
    setBusy("figure");
    try {
      const url = await uploadFigure(api, file);
      setDraft((d) => (d ? { ...d, figureUrl: url, hasFigure: true } : d));
    } catch (e) {
      setNotice({ kind: "error", text: errorMessage(e) });
    } finally {
      setBusy(null);
      if (figureInput.current) figureInput.current.value = "";
    }
  }

  // Keyboard: J/K next/prev, A–E or 1–5 answer, Enter approve & next, Ctrl+S save, P toggle PDF.
  const keys = useRef<(e: KeyboardEvent) => void>(() => undefined);
  keys.current = (e: KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
      e.preventDefault();
      if (!readOnly) void save();
      return;
    }
    if (e.ctrlKey || e.metaKey || e.altKey || typingTarget(e.target) || busy) return;
    const key = e.key.toLowerCase();
    if (key === "j") step(1);
    else if (key === "k") step(-1);
    else if (key === "p") setShowPdf((v) => !v);
    else if (key === "enter" && !(e.target instanceof HTMLButtonElement)) {
      e.preventDefault();
      void approveAndNext();
    } else if (!readOnly && draft) {
      const index = /^[a-f]$/.test(key)
        ? key.charCodeAt(0) - 97
        : /^[1-6]$/.test(key)
          ? Number(key) - 1
          : -1;
      if (index >= 0) setDraft(toggleAnswer(draft, index));
    }
  };
  useEffect(() => {
    const handler = (e: KeyboardEvent) => keys.current(e);
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  if (loadError) {
    return (
      <div className="p-6">
        <Alert>{loadError}</Alert>
      </div>
    );
  }
  if (!data || !test) {
    return (
      <div className="grid min-h-dvh place-items-center text-sm text-muted-foreground">
        Loading…
      </div>
    );
  }

  const q = draft;
  const numeric = q ? isNumericType(q.type) : false;
  const hi = lang === "hi";
  const set = <K extends keyof Question>(key: K, value: Question[K]) =>
    setDraft((d) => (d ? { ...d, [key]: value } : d));
  const setOption = (i: number, value: string) =>
    setDraft((d) => {
      if (!d) return d;
      if (hi) {
        const next = d.options.map((_, j) => d.optionsHi[j] ?? "");
        next[i] = value;
        return { ...d, optionsHi: next.every((o) => !o.trim()) ? [] : next };
      }
      const next = [...d.options];
      next[i] = value;
      return { ...d, options: next };
    });
  const pdfUrl = upload?.files.paper.url;
  const page = q?.sourcePage ?? 1;
  const flags = (q ? (data.questions[q.id]?.flags ?? []) : []).flatMap((f) => {
    const parsed = validationFlagSchema.safeParse(f);
    return parsed.success ? [parsed.data] : [];
  });

  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-background">
      {/* Top bar */}
      <header className="flex flex-wrap items-center gap-3 border-b px-4 py-2">
        <Button asChild variant="ghost" size="icon" aria-label="Back to tests">
          <Link href={upload ? `/uploads/${upload.id}` : `/tests/${testId}`}>
            <ArrowLeft />
          </Link>
        </Button>
        <Input
          aria-label="Test title"
          className="h-9 max-w-sm min-w-40 flex-1 font-medium"
          value={meta.title}
          disabled={readOnly}
          onChange={(e) => setMeta((m) => ({ ...m, title: e.target.value }))}
          onBlur={() => void saveMeta(meta)}
        />
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            className="size-4 accent-[var(--primary)]"
            checked={meta.isFree}
            disabled={readOnly}
            onChange={(e) => {
              const next = { ...meta, isFree: e.target.checked };
              setMeta(next);
              void saveMeta(next);
            }}
          />
          Free
        </label>
        <Badge variant={published ? "success" : "secondary"}>{test.status}</Badge>
        <span className="text-sm text-muted-foreground tabular-nums">
          {toReview} to review · {data.checks.questionCount.actual}/
          {data.checks.questionCount.expected}
        </span>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          {!readOnly && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => void approveAnswered()}
              disabled={busy !== null}
            >
              <CheckCheck /> Approve all answered
            </Button>
          )}
          <Button asChild variant="outline" size="sm">
            <Link href={`/tests/${testId}/preview`}>
              <Eye /> Preview
            </Link>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowPdf((v) => !v)}
            aria-pressed={showPdf}
          >
            <FileText /> PDF
          </Button>
          {!readOnly && (
            <Button size="sm" onClick={() => void publish()} disabled={busy !== null}>
              {busy === "publish" ? "Publishing…" : "Publish"}
            </Button>
          )}
        </div>
      </header>

      {test.testFlags.length > 0 && (
        <div className="border-b bg-amber-50 px-4 py-2 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-100">
          {test.testFlags.join(" ")}
        </div>
      )}
      {notice && (
        <Alert variant={notice.kind} className="mx-4 mt-2">
          {notice.text}
        </Alert>
      )}

      <div
        className={cn(
          "grid min-h-0 flex-1 grid-cols-1",
          showPdf && pdfUrl
            ? "lg:grid-cols-[260px_minmax(0,1fr)_minmax(0,40%)]"
            : "lg:grid-cols-[260px_minmax(0,1fr)]",
        )}
      >
        {/* Question list */}
        <nav
          className="flex max-h-48 min-h-0 flex-col border-b lg:max-h-none lg:border-r lg:border-b-0"
          aria-label="Questions"
        >
          <div className="grid grid-cols-2 gap-1 border-b p-2" role="tablist">
            {(["review", "all"] as const).map((f) => (
              <button
                key={f}
                type="button"
                role="tab"
                aria-selected={filter === f}
                onClick={() => setFilter(f)}
                className={cn(
                  "h-8 rounded text-sm",
                  filter === f
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted",
                )}
              >
                {f === "review" ? `To review (${toReview})` : "All"}
              </button>
            ))}
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-2">
            {groups.map((g) => (
              <div key={g.name} className="mb-3">
                <p className="px-2 py-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">
                  {g.name}
                </p>
                {g.ids.length === 0 && (
                  <p className="px-2 text-xs text-muted-foreground">Nothing to review.</p>
                )}
                {g.ids.map((id) => {
                  const item = data.questions[id];
                  if (!item) return null;
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => void go(id)}
                      aria-current={id === selectedId ? "true" : undefined}
                      className={cn(
                        "flex w-full flex-col gap-1 rounded-md px-2 py-1.5 text-left text-sm",
                        id === selectedId ? "bg-primary/10" : "hover:bg-muted",
                      )}
                    >
                      <span className="flex items-center gap-2">
                        {item.status === "approved" ? (
                          <Check className="size-3.5 shrink-0 text-success" aria-label="approved" />
                        ) : (
                          <span
                            className="size-2 shrink-0 rounded-full bg-amber-500"
                            aria-label="to review"
                          />
                        )}
                        <span className="font-medium tabular-nums">
                          Q{item.number ?? item.order + 1}
                        </span>
                        <span className="truncate text-muted-foreground">
                          {snippet(item.stem || item.stemHi, 40)}
                        </span>
                      </span>
                      {item.flags.length > 0 && (
                        <span className="flex flex-wrap gap-1">
                          {item.flags.map((f) => {
                            const parsed = validationFlagSchema.safeParse(f);
                            return (
                              <Badge key={f} variant="outline" className="px-1.5 py-0 text-[10px]">
                                {parsed.success ? FLAG_LABELS[parsed.data] : f}
                              </Badge>
                            );
                          })}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </nav>

        {/* Student view + editor */}
        <main className="min-h-0 overflow-y-auto p-4">
          {!q ? (
            <p className="text-sm text-muted-foreground">No questions in this test.</p>
          ) : (
            <div className="mx-auto flex max-w-3xl flex-col gap-4">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg font-semibold">Q{q.number ?? q.order + 1}</h2>
                <Badge variant={q.status === "approved" ? "success" : "secondary"}>
                  {q.status}
                </Badge>
                <Badge variant={SOURCE_LABELS[q.answerSource].tone}>
                  {SOURCE_LABELS[q.answerSource].label}
                </Badge>
                <span
                  className={cn(
                    "text-xs",
                    q.confidence < 0.7 ? "text-destructive" : "text-muted-foreground",
                  )}
                >
                  confidence {Math.round(q.confidence * 100)}%
                </span>
                {q.sourcePage && (
                  <span className="text-xs text-muted-foreground">page {q.sourcePage}</span>
                )}
                {flags.map((f) => (
                  <Badge key={f} variant="outline">
                    {FLAG_LABELS[f]}
                  </Badge>
                ))}
                <Select
                  aria-label="Language"
                  className="ml-auto h-8 w-28"
                  value={lang}
                  onChange={(e) => setLang(e.target.value === "hi" ? "hi" : "en")}
                >
                  <option value="en">English</option>
                  <option value="hi">हिन्दी</option>
                </Select>
              </div>

              <section className="rounded-lg border p-4" aria-label="Student view">
                <p className="mb-3 text-xs font-medium tracking-wide text-muted-foreground uppercase">
                  Student view {readOnly || numeric ? "" : "· click an option to mark it correct"}
                </p>
                <QuestionPreview
                  question={q}
                  language={lang}
                  showAnswer
                  onOptionClick={
                    readOnly || numeric ? undefined : (i) => setDraft(toggleAnswer(q, i))
                  }
                />
              </section>

              {!readOnly && (
                <div className="flex flex-wrap items-center justify-end gap-2">
                  <span className="mr-auto text-xs text-muted-foreground">
                    J/K next/prev · A–E answer · Enter approve &amp; next · Ctrl+S save · P PDF
                  </span>
                  <Button
                    variant="outline"
                    onClick={() => void save()}
                    disabled={!dirty || busy !== null}
                  >
                    {busy === "save" ? "Saving…" : dirty ? "Save" : "Saved"}
                  </Button>
                  <Button onClick={() => void approveAndNext()} disabled={busy !== null}>
                    <Check /> {q.status === "approved" ? "Next" : "Approve & next"}
                  </Button>
                </div>
              )}

              <fieldset disabled={readOnly} className="flex flex-col gap-4 rounded-lg border p-4">
                <legend className="px-1 text-sm font-medium">Edit {hi ? "(Hindi)" : ""}</legend>
                <div className="grid gap-3 sm:grid-cols-3">
                  <Field label="Section" htmlFor="r-section">
                    <Select
                      id="r-section"
                      value={q.section}
                      onChange={(e) => void moveToSection(e.target.value)}
                    >
                      {test.sections.map((s) => (
                        <option key={s.name} value={s.name}>
                          {s.name}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Field label="Type" htmlFor="r-type">
                    <Select
                      id="r-type"
                      value={q.type}
                      onChange={(e) => {
                        const type = questionTypeSchema.parse(e.target.value);
                        setDraft({
                          ...q,
                          type,
                          options: isNumericType(type)
                            ? []
                            : q.options.length
                              ? q.options
                              : ["", "", "", ""],
                          optionsHi: isNumericType(type) ? [] : q.optionsHi,
                          correct: isNumericType(type)
                            ? []
                            : type === "mcq_single"
                              ? q.correct.slice(0, 1)
                              : q.correct,
                          numAnswer: isNumericType(type) ? q.numAnswer : null,
                        });
                      }}
                    >
                      {questionTypeSchema.options.map((t) => (
                        <option key={t} value={t}>
                          {TYPE_LABELS[t]}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Field label="Difficulty" htmlFor="r-difficulty">
                    <Select
                      id="r-difficulty"
                      value={q.difficulty}
                      onChange={(e) => set("difficulty", difficultySchema.parse(e.target.value))}
                    >
                      {difficultySchema.options.map((d) => (
                        <option key={d} value={d}>
                          {d}
                        </option>
                      ))}
                    </Select>
                  </Field>
                </div>
                <Field label="Passage" htmlFor="r-passage">
                  <Textarea
                    id="r-passage"
                    rows={2}
                    lang={lang}
                    value={hi ? q.passageHi : q.passage}
                    onChange={(e) => set(hi ? "passageHi" : "passage", e.target.value)}
                  />
                </Field>
                <Field label="Question" htmlFor="r-stem">
                  <Textarea
                    id="r-stem"
                    rows={3}
                    lang={lang}
                    value={hi ? q.stemHi : q.stem}
                    onChange={(e) => set(hi ? "stemHi" : "stem", e.target.value)}
                  />
                </Field>
                {numeric ? (
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Answer (min)" htmlFor="r-min">
                      <Input
                        id="r-min"
                        type="number"
                        step="any"
                        value={q.numAnswer?.min ?? ""}
                        onChange={(e) => {
                          const v = e.target.value;
                          setDraft({
                            ...q,
                            answerSource: "manual",
                            numAnswer:
                              v === ""
                                ? null
                                : {
                                    min: Number(v),
                                    max: Math.max(Number(v), q.numAnswer?.max ?? Number(v)),
                                  },
                          });
                        }}
                      />
                    </Field>
                    <Field label="Answer (max)" htmlFor="r-max">
                      <Input
                        id="r-max"
                        type="number"
                        step="any"
                        value={q.numAnswer?.max ?? ""}
                        onChange={(e) => {
                          const v = e.target.value;
                          if (!q.numAnswer) return;
                          setDraft({
                            ...q,
                            answerSource: "manual",
                            numAnswer: {
                              min: q.numAnswer.min,
                              max: v === "" ? q.numAnswer.min : Number(v),
                            },
                          });
                        }}
                      />
                    </Field>
                  </div>
                ) : (
                  <div className="flex flex-col gap-2">
                    <p className="text-sm font-medium">Options</p>
                    {q.options.map((option, i) => (
                      <div key={i} className="flex items-start gap-2">
                        <button
                          type="button"
                          onClick={() => setDraft(toggleAnswer(q, i))}
                          aria-pressed={q.correct.includes(i)}
                          aria-label={`Mark option ${letter(i)} correct`}
                          className={cn(
                            "inline-flex size-9 shrink-0 items-center justify-center rounded-md border text-sm font-semibold",
                            q.correct.includes(i)
                              ? "border-success bg-success text-success-foreground"
                              : "hover:bg-muted",
                          )}
                        >
                          {letter(i)}
                        </button>
                        <Textarea
                          rows={1}
                          className="min-h-9"
                          lang={lang}
                          aria-label={`Option ${letter(i)}`}
                          value={hi ? (q.optionsHi[i] ?? "") : option}
                          onChange={(e) => setOption(i, e.target.value)}
                        />
                        {!hi && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="size-9"
                            aria-label={`Remove option ${letter(i)}`}
                            disabled={q.options.length <= 2}
                            onClick={() =>
                              setDraft({
                                ...q,
                                options: q.options.filter((_, j) => j !== i),
                                optionsHi: q.optionsHi.filter((_, j) => j !== i),
                                correct: q.correct
                                  .filter((c) => c !== i)
                                  .map((c) => (c > i ? c - 1 : c)),
                              })
                            }
                          >
                            <Trash2 />
                          </Button>
                        )}
                      </div>
                    ))}
                    {!hi && q.options.length < MAX_OPTIONS && (
                      <div>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            setDraft({
                              ...q,
                              options: [...q.options, ""],
                              optionsHi: q.optionsHi.length ? [...q.optionsHi, ""] : [],
                            })
                          }
                        >
                          <Plus /> Add option
                        </Button>
                      </div>
                    )}
                  </div>
                )}
                <Field label="Solution" htmlFor="r-solution">
                  <Textarea
                    id="r-solution"
                    rows={2}
                    lang={lang}
                    value={hi ? q.solutionHi : q.solution}
                    onChange={(e) => set(hi ? "solutionHi" : "solution", e.target.value)}
                  />
                </Field>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Topic" htmlFor="r-topic">
                    <Input
                      id="r-topic"
                      value={q.topic}
                      onChange={(e) => set("topic", e.target.value)}
                    />
                  </Field>
                  <div className="flex flex-wrap items-end gap-3">
                    <input
                      ref={figureInput}
                      type="file"
                      accept="image/png,image/jpeg,image/webp,image/gif"
                      className="hidden"
                      onChange={(e) => void onFigure(e.target.files?.[0])}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => figureInput.current?.click()}
                      disabled={busy === "figure"}
                    >
                      <ImagePlus />{" "}
                      {busy === "figure"
                        ? "Uploading…"
                        : q.figureUrl
                          ? "Replace figure"
                          : "Upload figure"}
                    </Button>
                    <label className="flex h-11 items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        className="size-4 accent-[var(--primary)]"
                        checked={q.hasFigure}
                        onChange={(e) => set("hasFigure", e.target.checked)}
                      />
                      Needs a figure
                    </label>
                  </div>
                </div>
              </fieldset>
              <div className="flex justify-center gap-2 pb-6">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => step(-1)}
                  aria-label="Previous question (K)"
                >
                  <ChevronUp /> Prev
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => step(1)}
                  aria-label="Next question (J)"
                >
                  <ChevronDown /> Next
                </Button>
              </div>
            </div>
          )}
        </main>

        {/* Original paper */}
        {showPdf && pdfUrl && (
          <aside className="hidden min-h-0 border-l lg:block" aria-label="Original paper">
            <iframe
              // Remount on page change: PDF viewers ignore a changed #page on the same document.
              key={page}
              title="Original paper"
              src={`${pdfUrl}#page=${page}`}
              className="size-full"
            />
          </aside>
        )}
      </div>
    </div>
  );
}
