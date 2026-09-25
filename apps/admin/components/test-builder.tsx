"use client";

import { errorMessage, isApiError, useAuth } from "@mockprep/api-client";
import {
  TEST_TYPE_LABELS,
  adminTestResponseSchema,
  questionListResponseSchema,
  testChecksSchema,
  testFillResponseSchema,
  testTypeSchema,
  type AdminTestResponse,
  type FillReport,
  type SelectionRule,
  type Test,
  type TestChecks,
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
  cn,
} from "@mockprep/ui";
import { ArrowDown, ArrowUp, Eye, Plus, Search, Sparkles, Trash2, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { fromIstInput, snippet, toIstInput } from "@/lib/format";
import { canEditContent } from "@/lib/roles";

type Meta = Pick<Test, "title" | "type" | "isFree" | "publishAt">;
type Mix = { easy: string; medium: string; hard: string };

function problemBadges(id: string, checks: TestChecks) {
  const badges: string[] = [];
  if (checks.missingAnswers.includes(id)) badges.push("no answer");
  if (checks.drafts.includes(id)) badges.push("draft");
  if (checks.duplicates.some((g) => g.includes(id))) badges.push("duplicate");
  if (checks.optionCountMismatch.includes(id)) badges.push("option count");
  if (checks.missing.includes(id)) badges.push("deleted");
  return badges;
}

function ruleFrom(
  count: number,
  mix: Mix,
  topics: string,
  notUsedDays: string,
  mode: "replace" | "append",
): SelectionRule {
  const shares = {
    easy: Number(mix.easy) || 0,
    medium: Number(mix.medium) || 0,
    hard: Number(mix.hard) || 0,
  };
  return {
    count,
    mode,
    topics: topics
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean),
    notUsedInLastDays: Math.max(0, Number(notUsedDays) || 0),
    ...(shares.easy + shares.medium + shares.hard > 0 ? { difficultyMix: shares } : {}),
  };
}

/** Inline bank picker for one section. */
function BankPicker({
  family,
  section,
  exclude,
  onAdd,
  onClose,
}: {
  family: string;
  section: string;
  exclude: string[];
  onAdd: (id: string) => void;
  onClose: () => void;
}) {
  const { api } = useAuth();
  const [q, setQ] = useState("");
  const [results, setResults] = useState<AdminTestResponse["questions"][string][]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const id = setTimeout(() => {
      const params = new URLSearchParams({
        examFamily: family,
        section,
        status: "approved",
        pageSize: "20",
        exclude: exclude.join(","),
      });
      if (q.trim()) params.set("q", q.trim());
      api
        .request(`/api/admin/questions?${params.toString()}`, {
          schema: questionListResponseSchema,
          signal: controller.signal,
        })
        .then((res) => setResults(res.questions))
        .catch((e: unknown) => !controller.signal.aborted && setError(errorMessage(e)));
    }, 250);
    return () => {
      clearTimeout(id);
      controller.abort();
    };
  }, [api, family, section, q, exclude]);

  return (
    <div className="flex flex-col gap-2 rounded-md border bg-muted/30 p-3">
      <div className="flex items-center gap-2">
        <Search className="size-4 text-muted-foreground" aria-hidden />
        <Input
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={`Search approved ${section} questions…`}
          className="h-9"
          aria-label="Search the bank"
        />
        <Button variant="ghost" size="icon" aria-label="Close" onClick={onClose}>
          <X />
        </Button>
      </div>
      {error && <Alert>{error}</Alert>}
      <ul className="flex max-h-80 flex-col divide-y overflow-y-auto rounded-md border bg-card">
        {results.map((r) => (
          <li key={r.id} className="flex items-center gap-2 p-2 text-sm">
            <span className="min-w-0 flex-1">{snippet(r.stem || r.stemHi, 140)}</span>
            <Badge variant="outline">{r.difficulty}</Badge>
            <Button size="sm" variant="outline" onClick={() => onAdd(r.id)}>
              Add
            </Button>
          </li>
        ))}
        {results.length === 0 && (
          <li className="p-3 text-sm text-muted-foreground">No matching approved questions.</li>
        )}
      </ul>
    </div>
  );
}

export function TestBuilder({ initial }: { initial: AdminTestResponse }) {
  const { api, state } = useAuth();
  const router = useRouter();
  const [data, setData] = useState(initial);
  const [meta, setMeta] = useState<Meta>({
    title: initial.test.title,
    type: initial.test.type,
    isFree: initial.test.isFree,
    publishAt: initial.test.publishAt,
  });
  const [mix, setMix] = useState<Mix>({ easy: "30", medium: "50", hard: "20" });
  const [topics, setTopics] = useState("");
  const [notUsedDays, setNotUsedDays] = useState("30");
  const [picker, setPicker] = useState<number | null>(null);
  const [report, setReport] = useState<FillReport[] | null>(null);
  const [notice, setNotice] = useState<{ kind: "error" | "success" | "info"; text: string } | null>(
    null,
  );
  const [busy, setBusy] = useState<string | null>(null);

  const { test, checks, questions } = data;
  const published = test.status === "published";
  const readOnly = published || !canEditContent(state.user?.role);
  const template = test.templateSnapshot;
  const metaDirty =
    meta.title !== test.title ||
    meta.type !== test.type ||
    meta.isFree !== test.isFree ||
    meta.publishAt !== test.publishAt;

  async function run<T>(label: string, action: () => Promise<T>, onDone?: (result: T) => void) {
    setBusy(label);
    setNotice(null);
    try {
      const result = await action();
      onDone?.(result);
    } catch (e) {
      if (isApiError(e) && e.status === 409 && e.details) {
        const parsed = testChecksSchema.safeParse(e.details);
        if (parsed.success) setData((d) => ({ ...d, checks: parsed.data }));
      }
      setNotice({ kind: "error", text: errorMessage(e) });
    } finally {
      setBusy(null);
    }
  }

  const put = (
    sections: Test["sections"],
    nextMeta: Meta = {
      title: test.title,
      type: test.type,
      isFree: test.isFree,
      publishAt: test.publishAt,
    },
  ) =>
    run(
      "save",
      () =>
        api.request(`/api/admin/tests/${test.id}`, {
          method: "PUT",
          body: {
            ...nextMeta,
            sections: sections.map((s) => ({ name: s.name, questionIds: s.questionIds })),
          },
          schema: adminTestResponseSchema,
        }),
      setData,
    );

  const updateSection = (index: number, questionIds: string[]) =>
    void put(test.sections.map((s, i) => (i === index ? { ...s, questionIds } : s)));

  const fill = (sections: { index: number; rule: SelectionRule }[], label: string) =>
    run(
      label,
      () =>
        api.request(`/api/admin/tests/${test.id}/fill`, {
          method: "POST",
          body: { sections },
          schema: testFillResponseSchema,
        }),
      (res) => {
        setData(res);
        setReport(res.report);
      },
    );

  const fillAll = () =>
    void fill(
      template.sections.map((s, index) => ({
        index,
        rule: ruleFrom(s.count, mix, topics, notUsedDays, "replace"),
      })),
      "fillAll",
    );

  const move = (index: number, from: number, delta: number) => {
    const ids = [...(test.sections[index]?.questionIds ?? [])];
    const to = from + delta;
    if (to < 0 || to >= ids.length) return;
    [ids[from], ids[to]] = [ids[to] as string, ids[from] as string];
    updateSection(index, ids);
  };

  const allIds = test.sections.flatMap((s) => s.questionIds);
  const problemsCount =
    checks.missingAnswers.length +
    checks.drafts.length +
    checks.duplicates.length +
    checks.optionCountMismatch.length +
    checks.missing.length;

  return (
    <div className="flex flex-col gap-6">
      {/* Summary + primary action */}
      <Card className="sticky top-0 z-10 lg:top-2">
        <CardContent className="flex flex-wrap items-center gap-4">
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <p className="text-sm">
              <span
                className={cn(
                  "font-semibold tabular-nums",
                  checks.questionCount.actual !== checks.questionCount.expected &&
                    "text-destructive",
                )}
              >
                {checks.questionCount.actual}/{checks.questionCount.expected}
              </span>{" "}
              questions · {template.name} · {template.totalTimeSec / 60} min ·{" "}
              {template.marking.correct > 0
                ? `+${template.marking.correct}`
                : template.marking.correct}
              /{template.marking.wrong}
            </p>
            <p className={cn("text-sm", checks.ok ? "text-success" : "text-muted-foreground")}>
              {checks.ok
                ? "Ready to publish."
                : problemsCount > 0
                  ? `${problemsCount} problem(s) to fix.`
                  : "Fill every section to its question count."}
            </p>
          </div>
          <Button asChild variant="outline">
            <Link href={`/tests/${test.id}/preview`}>
              <Eye /> Preview as student
            </Link>
          </Button>
          {published
            ? canEditContent(state.user?.role) && (
                <Button
                  variant="outline"
                  disabled={busy !== null}
                  onClick={() =>
                    void run(
                      "unpublish",
                      () =>
                        api.request(`/api/admin/tests/${test.id}/unpublish`, {
                          method: "POST",
                          schema: adminTestResponseSchema,
                        }),
                      setData,
                    )
                  }
                >
                  Unpublish
                </Button>
              )
            : !readOnly && (
                <Button
                  disabled={!checks.ok || busy !== null}
                  onClick={() =>
                    void run(
                      "publish",
                      () =>
                        api.request(`/api/admin/tests/${test.id}/publish`, {
                          method: "POST",
                          schema: adminTestResponseSchema,
                        }),
                      (res) => {
                        setData(res);
                        setNotice({
                          kind: "success",
                          text: "Published. It shows on the exam page within a minute.",
                        });
                      },
                    )
                  }
                >
                  {busy === "publish" ? "Publishing…" : "Publish"}
                </Button>
              )}
        </CardContent>
      </Card>

      {notice && <Alert variant={notice.kind}>{notice.text}</Alert>}
      {published && (
        <Alert variant="info">Published tests are read-only. Unpublish to change questions.</Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Details</CardTitle>
        </CardHeader>
        <CardContent>
          <fieldset disabled={readOnly} className="grid gap-4 md:grid-cols-4">
            <Field label="Title" htmlFor="title" className="md:col-span-2">
              <Input
                id="title"
                value={meta.title}
                onChange={(e) => setMeta((m) => ({ ...m, title: e.target.value }))}
              />
            </Field>
            <Field label="Type" htmlFor="type">
              <Select
                id="type"
                value={meta.type}
                onChange={(e) =>
                  setMeta((m) => ({ ...m, type: testTypeSchema.parse(e.target.value) }))
                }
              >
                {testTypeSchema.options.map((t) => (
                  <option key={t} value={t}>
                    {TEST_TYPE_LABELS[t]}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Visible from (IST, optional)" htmlFor="publishAt">
              <Input
                id="publishAt"
                type="datetime-local"
                value={toIstInput(meta.publishAt)}
                onChange={(e) =>
                  setMeta((m) => ({ ...m, publishAt: fromIstInput(e.target.value) }))
                }
              />
            </Field>
            <label className="flex items-center gap-2 text-sm md:col-span-3">
              <input
                type="checkbox"
                className="size-4 accent-[var(--primary)]"
                checked={meta.isFree}
                onChange={(e) => setMeta((m) => ({ ...m, isFree: e.target.checked }))}
              />
              Free test
            </label>
            <div className="flex justify-end">
              <Button
                variant="outline"
                disabled={!metaDirty || busy !== null || meta.title.trim().length < 2}
                onClick={() => void put(test.sections, meta)}
              >
                Save details
              </Button>
            </div>
          </fieldset>
        </CardContent>
      </Card>

      {!readOnly && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Build by rule</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
              {(["easy", "medium", "hard"] as const).map((d) => (
                <Field key={d} label={`${d[0]?.toUpperCase()}${d.slice(1)} %`} htmlFor={`mix-${d}`}>
                  <Input
                    id={`mix-${d}`}
                    type="number"
                    min={0}
                    value={mix[d]}
                    onChange={(e) => setMix((m) => ({ ...m, [d]: e.target.value }))}
                  />
                </Field>
              ))}
              <Field label="Not used in last (days)" htmlFor="notUsed">
                <Input
                  id="notUsed"
                  type="number"
                  min={0}
                  value={notUsedDays}
                  onChange={(e) => setNotUsedDays(e.target.value)}
                />
              </Field>
              <Field label="Topics (optional)" htmlFor="topics" hint="Comma-separated">
                <Input id="topics" value={topics} onChange={(e) => setTopics(e.target.value)} />
              </Field>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-muted-foreground">
                Replaces every section with approved questions matching the rule, sized to the
                template.
              </p>
              <Button onClick={fillAll} disabled={busy !== null} variant="outline">
                <Sparkles /> {busy === "fillAll" ? "Filling…" : "Fill all sections"}
              </Button>
            </div>
            {report && (
              <ul className="flex flex-wrap gap-2 text-sm">
                {report.map((r) => (
                  <li key={r.index}>
                    <Badge variant={r.shortfall ? "destructive" : "success"}>
                      {r.name}: {r.added}/{r.requested}
                      {r.shortfall ? ` (${r.shortfall} short)` : ""}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      )}

      {test.sections.map((section, index) => {
        const expected = template.sections[index]?.count ?? 0;
        const remaining = expected - section.questionIds.length;
        return (
          <Card key={section.name}>
            <CardHeader className="flex-row flex-wrap items-center justify-between gap-2">
              <CardTitle className="text-base">
                {section.name}{" "}
                <span
                  className={cn(
                    "font-normal tabular-nums",
                    remaining === 0 ? "text-success" : "text-destructive",
                  )}
                >
                  {section.questionIds.length}/{expected}
                </span>
                {section.timeSec && (
                  <span className="font-normal text-muted-foreground">
                    {" "}
                    · {section.timeSec / 60} min
                  </span>
                )}
              </CardTitle>
              {!readOnly && (
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={busy !== null || remaining <= 0}
                    onClick={() =>
                      void fill(
                        [{ index, rule: ruleFrom(remaining, mix, topics, notUsedDays, "append") }],
                        `fill-${index}`,
                      )
                    }
                  >
                    <Sparkles /> Fill {remaining > 0 ? remaining : ""} by rule
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setPicker(picker === index ? null : index)}
                  >
                    <Plus /> Add from bank
                  </Button>
                </div>
              )}
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {picker === index && (
                <BankPicker
                  family={template.family}
                  section={section.name}
                  exclude={allIds}
                  onClose={() => setPicker(null)}
                  onAdd={(id) => updateSection(index, [...section.questionIds, id])}
                />
              )}
              {section.questionIds.length === 0 ? (
                <p className="text-sm text-muted-foreground">No questions yet.</p>
              ) : (
                <ol className="flex flex-col divide-y rounded-md border">
                  {section.questionIds.map((id, i) => {
                    const q = questions[id];
                    const badges = problemBadges(id, checks);
                    return (
                      <li
                        key={`${id}-${i}`}
                        className="flex items-center gap-2 px-2 py-1.5 text-sm"
                      >
                        <span className="w-8 shrink-0 text-right text-muted-foreground tabular-nums">
                          {i + 1}
                        </span>
                        <Link
                          href={`/questions/${id}`}
                          className="min-w-0 flex-1 truncate hover:underline"
                        >
                          {q ? snippet(q.stem || q.stemHi, 160) : "Deleted question"}
                        </Link>
                        {q && (
                          <Badge variant="outline" className="hidden sm:inline-flex">
                            {q.difficulty}
                          </Badge>
                        )}
                        {badges.map((b) => (
                          <Badge key={b} variant="destructive">
                            {b}
                          </Badge>
                        ))}
                        {!readOnly && (
                          <span className="flex">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-8"
                              aria-label="Move up"
                              disabled={i === 0}
                              onClick={() => move(index, i, -1)}
                            >
                              <ArrowUp />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-8"
                              aria-label="Move down"
                              disabled={i === section.questionIds.length - 1}
                              onClick={() => move(index, i, 1)}
                            >
                              <ArrowDown />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-8"
                              aria-label="Remove"
                              onClick={() =>
                                updateSection(
                                  index,
                                  section.questionIds.filter((_, j) => j !== i),
                                )
                              }
                            >
                              <Trash2 />
                            </Button>
                          </span>
                        )}
                      </li>
                    );
                  })}
                </ol>
              )}
            </CardContent>
          </Card>
        );
      })}

      {!published && canEditContent(state.user?.role) && (
        <div className="flex justify-end">
          <Button
            variant="ghost"
            onClick={() => {
              if (window.confirm("Delete this draft test?"))
                void run(
                  "delete",
                  () => api.request(`/api/admin/tests/${test.id}`, { method: "DELETE" }),
                  () => router.replace("/tests"),
                );
            }}
          >
            Delete draft
          </Button>
        </div>
      )}
    </div>
  );
}
