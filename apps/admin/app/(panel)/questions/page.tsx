"use client";

import { errorMessage, useAuth } from "@mockprep/api-client";
import {
  EXAM_FAMILY_LABELS,
  answerSourceSchema,
  difficultySchema,
  examFamilySchema,
  questionBulkResponseSchema,
  questionListResponseSchema,
  questionStatusSchema,
} from "@mockprep/types";
import {
  Alert,
  Badge,
  Button,
  Card,
  Input,
  Select,
  TBody,
  TD,
  TH,
  THead,
  TR,
  Table,
} from "@mockprep/ui";
import { Copy, Plus, Upload } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/page-header";
import { snippet } from "@/lib/format";
import { canEditContent } from "@/lib/roles";
import { useApiQuery } from "@/lib/use-api-query";

const PAGE_SIZE = 25;
type Filters = {
  examFamily: string;
  section: string;
  topic: string;
  difficulty: string;
  status: string;
  answerSource: string;
  q: string;
};
const EMPTY: Filters = {
  examFamily: "",
  section: "",
  topic: "",
  difficulty: "",
  status: "",
  answerSource: "",
  q: "",
};

export default function QuestionBankPage() {
  const { api, state } = useAuth();
  const canEdit = canEditContent(state.user?.role);
  const [filters, setFilters] = useState<Filters>(EMPTY);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkTopic, setBulkTopic] = useState("");
  const [bulkDifficulty, setBulkDifficulty] = useState("");
  const [notice, setNotice] = useState<{ kind: "error" | "success"; text: string } | null>(null);

  // Debounce the text search.
  useEffect(() => {
    const id = setTimeout(() => {
      setFilters((f) => ({ ...f, q: search }));
      setPage(1);
    }, 300);
    return () => clearTimeout(id);
  }, [search]);

  const path = useMemo(() => {
    const params = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
    for (const [key, value] of Object.entries(filters)) if (value) params.set(key, value);
    return `/api/admin/questions?${params.toString()}`;
  }, [filters, page]);
  const { data, error, reload } = useApiQuery(path, questionListResponseSchema);

  const setFilter = (key: keyof Filters, value: string) => {
    setFilters((f) => ({ ...f, [key]: value }));
    setPage(1);
    setSelected(new Set());
  };
  const pageIds = data?.questions.map((q) => q.id) ?? [];
  const allSelected = pageIds.length > 0 && pageIds.every((id) => selected.has(id));
  const toggle = (id: string) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  const pages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;

  async function bulk(action: "update" | "delete") {
    if (
      action === "delete" &&
      !window.confirm(`Delete ${selected.size} question(s)? Questions used in tests are skipped.`)
    )
      return;
    setNotice(null);
    try {
      const set: Record<string, string> = {};
      if (bulkTopic.trim()) set.topic = bulkTopic.trim();
      if (bulkDifficulty) set.difficulty = bulkDifficulty;
      const res = await api.request("/api/admin/questions/bulk", {
        method: "POST",
        body:
          action === "delete"
            ? { action, ids: [...selected] }
            : { action, ids: [...selected], set },
        schema: questionBulkResponseSchema,
      });
      const skipped = res.skipped.length
        ? ` ${res.skipped.length} skipped (${res.skipped[0]?.reason}${res.skipped.length > 1 ? ", …" : ""}).`
        : "";
      setNotice({
        kind: "success",
        text: `${action === "delete" ? "Deleted" : "Updated"} ${res.modified}.${skipped}`,
      });
      setSelected(new Set());
      setBulkTopic("");
      setBulkDifficulty("");
      reload();
    } catch (e) {
      setNotice({ kind: "error", text: errorMessage(e) });
    }
  }

  return (
    <>
      <PageHeader
        title="Question bank"
        description={data ? `${data.total} question${data.total === 1 ? "" : "s"}` : undefined}
        action={
          canEdit && (
            <div className="flex flex-wrap gap-2">
              <Button asChild variant="ghost">
                <Link href="/questions/duplicates">
                  <Copy /> Duplicates
                </Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/questions/import">
                  <Upload /> Import Excel
                </Link>
              </Button>
              <Button asChild>
                <Link href="/questions/new">
                  <Plus /> New question
                </Link>
              </Button>
            </div>
          )
        }
      />

      <Card className="mb-4 grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4">
        <Input
          aria-label="Search"
          placeholder="Search text…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="lg:col-span-2"
        />
        <Select
          aria-label="Exam family"
          value={filters.examFamily}
          onChange={(e) => setFilter("examFamily", e.target.value)}
        >
          <option value="">All families</option>
          {examFamilySchema.options.map((f) => (
            <option key={f} value={f}>
              {EXAM_FAMILY_LABELS[f]}
            </option>
          ))}
        </Select>
        <Input
          aria-label="Section"
          placeholder="Section"
          value={filters.section}
          onChange={(e) => setFilter("section", e.target.value)}
        />
        <Input
          aria-label="Topic"
          placeholder="Topic"
          value={filters.topic}
          onChange={(e) => setFilter("topic", e.target.value)}
        />
        <Select
          aria-label="Difficulty"
          value={filters.difficulty}
          onChange={(e) => setFilter("difficulty", e.target.value)}
        >
          <option value="">Any difficulty</option>
          {difficultySchema.options.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </Select>
        <Select
          aria-label="Status"
          value={filters.status}
          onChange={(e) => setFilter("status", e.target.value)}
        >
          <option value="">Any status</option>
          {questionStatusSchema.options.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </Select>
        <Select
          aria-label="Answer source"
          value={filters.answerSource}
          onChange={(e) => setFilter("answerSource", e.target.value)}
        >
          <option value="">Any source</option>
          {answerSourceSchema.options.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </Select>
      </Card>

      {canEdit && selected.size > 0 && (
        <Card className="mb-4 flex flex-wrap items-center gap-3 p-3 text-sm">
          <span className="font-medium">{selected.size} selected</span>
          <Input
            aria-label="Set topic"
            placeholder="Set topic"
            value={bulkTopic}
            onChange={(e) => setBulkTopic(e.target.value)}
            className="h-9 w-48"
          />
          <Select
            aria-label="Set difficulty"
            value={bulkDifficulty}
            onChange={(e) => setBulkDifficulty(e.target.value)}
            className="h-9 w-40"
          >
            <option value="">Difficulty…</option>
            {difficultySchema.options.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </Select>
          <Button
            size="sm"
            onClick={() => void bulk("update")}
            disabled={!bulkTopic.trim() && !bulkDifficulty}
          >
            Apply tags
          </Button>
          <Button size="sm" variant="ghost" onClick={() => void bulk("delete")}>
            Delete
          </Button>
        </Card>
      )}
      {notice && (
        <Alert variant={notice.kind} className="mb-4">
          {notice.text}
        </Alert>
      )}
      {error && <Alert className="mb-4">{error}</Alert>}

      <Card>
        <Table>
          <THead>
            <TR>
              {canEdit && (
                <TH className="w-10">
                  <input
                    type="checkbox"
                    aria-label="Select page"
                    className="size-4"
                    checked={allSelected}
                    onChange={() => setSelected(allSelected ? new Set() : new Set(pageIds))}
                  />
                </TH>
              )}
              <TH>Question</TH>
              <TH>Exam · section</TH>
              <TH>Topic</TH>
              <TH>Difficulty</TH>
              <TH>Status</TH>
            </TR>
          </THead>
          <TBody>
            {data?.questions.map((q) => (
              <TR key={q.id}>
                {canEdit && (
                  <TD>
                    <input
                      type="checkbox"
                      aria-label="Select question"
                      className="size-4"
                      checked={selected.has(q.id)}
                      onChange={() => toggle(q.id)}
                    />
                  </TD>
                )}
                <TD className="max-w-md">
                  <Link href={`/questions/${q.id}`} className="hover:underline">
                    {snippet(q.stem || q.stemHi) || (
                      <em className="text-muted-foreground">No text</em>
                    )}
                  </Link>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {q.version > 1 && <Badge variant="outline">v{q.version}</Badge>}
                    {q.flags.map((f) => (
                      <Badge key={f} variant="destructive">
                        {f.replace(/_/g, " ")}
                      </Badge>
                    ))}
                    {q.stemHi && <Badge variant="outline">HI</Badge>}
                    {q.figureUrl && <Badge variant="outline">figure</Badge>}
                  </div>
                </TD>
                <TD className="whitespace-nowrap text-muted-foreground">
                  {q.examKey} · {q.section}
                </TD>
                <TD className="text-muted-foreground">{q.topic || "–"}</TD>
                <TD>{q.difficulty}</TD>
                <TD>
                  <Badge variant={q.status === "approved" ? "success" : "secondary"}>
                    {q.status}
                  </Badge>
                </TD>
              </TR>
            ))}
            {data?.questions.length === 0 && (
              <TR>
                <TD colSpan={6} className="py-8 text-center text-muted-foreground">
                  No questions match.
                </TD>
              </TR>
            )}
            {!data && !error && (
              <TR>
                <TD colSpan={6} className="py-8 text-center text-muted-foreground">
                  Loading…
                </TD>
              </TR>
            )}
          </TBody>
        </Table>
      </Card>
      {data && pages > 1 && (
        <div className="mt-4 flex items-center justify-end gap-2 text-sm">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
          >
            Previous
          </Button>
          <span className="tabular-nums">
            Page {page} of {pages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= pages}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </Button>
        </div>
      )}
    </>
  );
}
