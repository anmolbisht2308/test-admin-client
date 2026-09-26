"use client";

import { errorMessage, useAuth } from "@mockprep/api-client";
import {
  OPTION_LETTERS,
  adminTestResponseSchema,
  isNumericType,
  rescoreResponseSchema,
  type AnswerKeyInput,
  type Question,
} from "@mockprep/types";
import { Alert, Button, Card, CardContent, Input, cn } from "@mockprep/ui";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { PageHeader } from "@/components/page-header";
import { snippet } from "@/lib/format";
import { canEditContent } from "@/lib/roles";
import { useApiQuery } from "@/lib/use-api-query";

type Change = AnswerKeyInput["changes"][number];

/**
 * Corrects a published test's answer key in place (students' mistakes in the key, not content
 * edits), then re-scores every attempt and rebuilds the ranks.
 */
export default function AnswerKeyPage() {
  const { id } = useParams<{ id: string }>();
  const { api, state } = useAuth();
  const { data, error } = useApiQuery(`/api/admin/tests/${id}`, adminTestResponseSchema);
  const [changes, setChanges] = useState<Record<string, Change>>({});
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ kind: "success" | "error"; text: string } | null>(null);
  const readOnly = !canEditContent(state.user?.role);

  const keyOf = (q: Question) => changes[q.id]?.correct ?? q.correct;
  const numOf = (q: Question) => changes[q.id]?.numAnswer ?? q.numAnswer;

  function toggle(q: Question, i: number) {
    const current = keyOf(q);
    const correct =
      q.type === "mcq_multi"
        ? current.includes(i)
          ? current.filter((c) => c !== i)
          : [...current, i].sort((a, b) => a - b)
        : [i];
    setChanges((c) => ({ ...c, [q.id]: { questionId: q.id, correct } }));
  }

  async function save() {
    const list = Object.values(changes);
    if (!list.length) return;
    if (
      !window.confirm(
        `Change ${list.length} answer key(s) and re-score every attempt of this test?`,
      )
    )
      return;
    setBusy(true);
    setNotice(null);
    try {
      const res = await api.request(`/api/admin/tests/${id}/answer-key`, {
        method: "PUT",
        body: { changes: list },
        schema: rescoreResponseSchema,
      });
      setChanges({});
      setNotice({
        kind: "success",
        text: res.queued
          ? `Saved. Re-scoring ${res.attempts} attempt(s) and rebuilding ranks in the background.`
          : "Saved. No attempts to re-score yet.",
      });
    } catch (e) {
      setNotice({ kind: "error", text: errorMessage(e) });
    } finally {
      setBusy(false);
    }
  }

  const count = Object.keys(changes).length;
  return (
    <>
      <PageHeader
        title="Change answer key"
        description={
          data && (
            <Link href={`/tests/${id}`} className="hover:underline">
              {data.test.title}
            </Link>
          )
        }
        action={
          !readOnly && (
            <Button onClick={() => void save()} disabled={busy || count === 0}>
              {busy
                ? "Saving…"
                : `Save ${count || ""} change${count === 1 ? "" : "s"} and re-score`}
            </Button>
          )
        }
      />
      {error && <Alert>{error}</Alert>}
      {notice && (
        <Alert variant={notice.kind} className="mb-4">
          {notice.text}
        </Alert>
      )}
      {data &&
        data.test.sections.map((section) => (
          <section key={section.name} className="mb-6 flex flex-col gap-2">
            <h2 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">
              {section.name}
            </h2>
            {section.questionIds.map((qid, n) => {
              const q = data.questions[qid];
              if (!q) return null;
              const changed = Boolean(changes[q.id]);
              const num = numOf(q);
              return (
                <Card key={qid} className={cn(changed && "border-primary")}>
                  <CardContent className="flex flex-wrap items-center gap-3 py-3">
                    <span className="w-10 text-sm font-semibold tabular-nums">Q{n + 1}</span>
                    <span className="min-w-0 flex-1 text-sm">
                      {snippet(q.stem || q.stemHi, 110)}
                    </span>
                    {isNumericType(q.type) ? (
                      <span className="flex items-center gap-1 text-sm">
                        <Input
                          aria-label="Answer min"
                          type="number"
                          step="any"
                          className="h-9 w-24"
                          disabled={readOnly}
                          value={num?.min ?? ""}
                          onChange={(e) =>
                            setChanges((c) => ({
                              ...c,
                              [q.id]: {
                                questionId: q.id,
                                numAnswer: {
                                  min: Number(e.target.value),
                                  max: Math.max(Number(e.target.value), num?.max ?? 0),
                                },
                              },
                            }))
                          }
                        />
                        to
                        <Input
                          aria-label="Answer max"
                          type="number"
                          step="any"
                          className="h-9 w-24"
                          disabled={readOnly}
                          value={num?.max ?? ""}
                          onChange={(e) =>
                            setChanges((c) => ({
                              ...c,
                              [q.id]: {
                                questionId: q.id,
                                numAnswer: { min: num?.min ?? 0, max: Number(e.target.value) },
                              },
                            }))
                          }
                        />
                      </span>
                    ) : (
                      <span className="flex gap-1" role="group" aria-label={`Answer for Q${n + 1}`}>
                        {q.options.map((_, i) => (
                          <button
                            key={i}
                            type="button"
                            disabled={readOnly}
                            aria-pressed={keyOf(q).includes(i)}
                            onClick={() => toggle(q, i)}
                            className={cn(
                              "size-9 rounded-md border text-sm font-semibold",
                              keyOf(q).includes(i)
                                ? "border-success bg-success text-success-foreground"
                                : "hover:bg-muted",
                            )}
                          >
                            {OPTION_LETTERS[i]}
                          </button>
                        ))}
                      </span>
                    )}
                    {q.flags.includes("suspect_key") && (
                      <span className="text-xs font-medium text-destructive">
                        stats: key looks wrong
                      </span>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </section>
        ))}
    </>
  );
}
