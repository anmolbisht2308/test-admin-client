"use client";

import { errorMessage, useAuth } from "@mockprep/api-client";
import { OPTION_LETTERS, bookmarkListResponseSchema, type Bookmark } from "@mockprep/types";
import { Alert, Button, cn } from "@mockprep/ui";
import { QuestionRenderer } from "@mockprep/ui/question-renderer";
import { useEffect, useState } from "react";
import { useRequireStudent } from "@/lib/use-require-student";

function Item({ b, onRemove }: { b: Bookmark; onRemove: () => void }) {
  const [open, setOpen] = useState(false);
  const q = b.question;
  return (
    <li className="flex flex-col gap-3 rounded-xl border p-4">
      <p className="text-xs text-muted-foreground">
        {q.section}
        {q.topic ? ` · ${q.topic}` : ""}
      </p>
      {q.passage.trim() && (
        <details className="rounded-md bg-muted/50 p-2 text-sm">
          <summary className="cursor-pointer">Passage</summary>
          <QuestionRenderer content={q.passage} />
        </details>
      )}
      <QuestionRenderer content={q.stem || q.stemHi} />
      {q.options.length > 0 && (
        <ul className="flex flex-col gap-1 text-sm">
          {q.options.map((o, i) => (
            <li
              key={i}
              className={cn(
                "flex gap-2 rounded px-2 py-1",
                open && q.correct.includes(i) && "bg-[#1f9d55]/15 font-medium",
              )}
            >
              <span className="font-semibold">{OPTION_LETTERS[i]}</span>
              <QuestionRenderer content={o} className="min-w-0 flex-1" />
            </li>
          ))}
        </ul>
      )}
      {open && (
        <div className="rounded-md border border-dashed p-3 text-sm">
          {q.numAnswer && (
            <p className="mb-1 font-medium">
              Answer:{" "}
              {q.numAnswer.min === q.numAnswer.max
                ? q.numAnswer.min
                : `${q.numAnswer.min} to ${q.numAnswer.max}`}
            </p>
          )}
          {q.solution.trim() ? (
            <QuestionRenderer content={q.solution} />
          ) : (
            <p className="text-muted-foreground">No explanation yet.</p>
          )}
        </div>
      )}
      <div className="flex gap-2">
        <Button size="sm" variant="outline" onClick={() => setOpen((v) => !v)}>
          {open ? "Hide answer" : "Show answer"}
        </Button>
        <Button size="sm" variant="ghost" onClick={onRemove}>
          Remove
        </Button>
      </div>
    </li>
  );
}

/** My revision list: questions saved from solutions. */
export default function RevisionPage() {
  const user = useRequireStudent();
  const { api } = useAuth();
  const [items, setItems] = useState<Bookmark[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    api
      .request("/api/bookmarks", { schema: bookmarkListResponseSchema })
      .then((res) => setItems(res.bookmarks))
      .catch((e: unknown) => setError(errorMessage(e)));
  }, [api, user]);

  async function remove(questionId: string) {
    setItems((list) => list?.filter((b) => b.questionId !== questionId) ?? null);
    await api
      .request(`/api/bookmarks/${questionId}`, { method: "DELETE" })
      .catch((e: unknown) => setError(errorMessage(e)));
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold tracking-tight">My revision list</h1>
      {error && <Alert>{error}</Alert>}
      {items === null ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Nothing saved yet. Use &ldquo;Save for revision&rdquo; in a test&apos;s solutions.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {items.map((b) => (
            <Item key={b.questionId} b={b} onRemove={() => void remove(b.questionId)} />
          ))}
        </ul>
      )}
    </div>
  );
}
