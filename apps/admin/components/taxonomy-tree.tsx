"use client";

import { errorMessage, useAuth } from "@mockprep/api-client";
import {
  EXAM_FAMILY_LABELS,
  examFamilySchema,
  taxonomyListResponseSchema,
  type ExamFamily,
  type TaxonomyNode,
} from "@mockprep/types";
import { Alert, Badge, Button, Card, CardContent, Input, cn } from "@mockprep/ui";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { useMemo, useState, type FormEvent } from "react";
import { canEditContent } from "@/lib/roles";
import { useApiQuery } from "@/lib/use-api-query";

type Editing = { mode: "add"; parentId: string | null } | { mode: "rename"; id: string } | null;

const CHILD_LABEL = { subject: "topic", topic: "subtopic", subtopic: null } as const;

function InlineForm({
  initial,
  placeholder,
  onSubmit,
  onCancel,
}: {
  initial: string;
  placeholder: string;
  onSubmit: (name: string) => Promise<void>;
  onCancel: () => void;
}) {
  const [value, setValue] = useState(initial);
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!value.trim()) return;
    setBusy(true);
    await onSubmit(value.trim());
    setBusy(false);
  }
  return (
    <form
      onSubmit={submit}
      className="flex items-center gap-2 py-1"
      onKeyDown={(e) => e.key === "Escape" && onCancel()}
    >
      <Input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        autoFocus
        className="h-9 max-w-xs"
        aria-label={placeholder}
      />
      <Button type="submit" size="sm" disabled={busy || !value.trim()}>
        Save
      </Button>
      <Button type="button" size="sm" variant="ghost" onClick={onCancel}>
        Cancel
      </Button>
    </form>
  );
}

export function TaxonomyTree() {
  const { api, state } = useAuth();
  const canEdit = canEditContent(state.user?.role);
  const [family, setFamily] = useState<ExamFamily>("banking");
  const { data, error, reload } = useApiQuery(
    `/api/admin/taxonomy?examFamily=${family}`,
    taxonomyListResponseSchema,
  );
  const [editing, setEditing] = useState<Editing>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const children = useMemo(() => {
    const map = new Map<string | null, TaxonomyNode[]>();
    for (const node of data?.nodes ?? []) {
      const list = map.get(node.parentId) ?? [];
      list.push(node);
      map.set(node.parentId, list);
    }
    for (const list of map.values()) list.sort((a, b) => a.name.localeCompare(b.name));
    return map;
  }, [data]);

  async function run(action: () => Promise<unknown>) {
    setActionError(null);
    try {
      await action();
      setEditing(null);
      reload();
    } catch (e) {
      setActionError(errorMessage(e));
    }
  }

  const add = (parentId: string | null) => (name: string) =>
    run(() =>
      api.request("/api/admin/taxonomy", {
        method: "POST",
        body: { examFamily: family, parentId, name },
      }),
    );
  const rename = (id: string) => (name: string) =>
    run(() => api.request(`/api/admin/taxonomy/${id}`, { method: "PATCH", body: { name } }));
  const remove = (node: TaxonomyNode) => {
    if (window.confirm(`Delete “${node.name}”?`))
      void run(() => api.request(`/api/admin/taxonomy/${node.id}`, { method: "DELETE" }));
  };

  function renderNodes(parentId: string | null, depth: number) {
    const nodes = children.get(parentId) ?? [];
    return (
      <ul className={cn("flex flex-col", depth > 0 && "ml-4 border-l pl-4")}>
        {nodes.map((node) => {
          const childLabel = CHILD_LABEL[node.level];
          return (
            <li key={node.id} className="flex flex-col">
              {editing?.mode === "rename" && editing.id === node.id ? (
                <InlineForm
                  initial={node.name}
                  placeholder="Name"
                  onSubmit={rename(node.id)}
                  onCancel={() => setEditing(null)}
                />
              ) : (
                <div className="group flex min-h-10 items-center gap-2">
                  <span className={cn(depth === 0 && "font-medium")}>{node.name}</span>
                  <Badge variant="outline" className="text-[10px]">
                    {node.level}
                  </Badge>
                  {canEdit && (
                    <span className="flex opacity-100 transition-opacity md:opacity-0 md:group-focus-within:opacity-100 md:group-hover:opacity-100">
                      {childLabel && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setEditing({ mode: "add", parentId: node.id })}
                          aria-label={`Add ${childLabel} to ${node.name}`}
                        >
                          <Plus /> {childLabel}
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setEditing({ mode: "rename", id: node.id })}
                        aria-label={`Rename ${node.name}`}
                      >
                        <Pencil />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => remove(node)}
                        aria-label={`Delete ${node.name}`}
                      >
                        <Trash2 />
                      </Button>
                    </span>
                  )}
                </div>
              )}
              {(children.get(node.id)?.length ?? 0) > 0 && renderNodes(node.id, depth + 1)}
              {editing?.mode === "add" && editing.parentId === node.id && (
                <div className="ml-4 border-l pl-4">
                  <InlineForm
                    initial=""
                    placeholder={`New ${childLabel ?? "item"} name`}
                    onSubmit={add(node.id)}
                    onCancel={() => setEditing(null)}
                  />
                </div>
              )}
            </li>
          );
        })}
      </ul>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div role="tablist" aria-label="Exam family" className="flex flex-wrap gap-1">
        {examFamilySchema.options.map((f) => (
          <button
            key={f}
            role="tab"
            aria-selected={f === family}
            onClick={() => {
              setFamily(f);
              setEditing(null);
            }}
            className={cn(
              "h-9 rounded-md px-3 text-sm",
              f === family
                ? "bg-primary/10 font-medium text-primary"
                : "text-muted-foreground hover:bg-muted",
            )}
          >
            {EXAM_FAMILY_LABELS[f]}
          </button>
        ))}
      </div>
      {(error ?? actionError) && <Alert>{error ?? actionError}</Alert>}
      <Card>
        <CardContent className="flex flex-col gap-2">
          {data && data.nodes.length === 0 && editing?.mode !== "add" && (
            <p className="text-sm text-muted-foreground">
              No subjects yet for {EXAM_FAMILY_LABELS[family]}.
            </p>
          )}
          {!data && !error && <p className="text-sm text-muted-foreground">Loading…</p>}
          {data && renderNodes(null, 0)}
          {editing?.mode === "add" && editing.parentId === null ? (
            <InlineForm
              initial=""
              placeholder="New subject name"
              onSubmit={add(null)}
              onCancel={() => setEditing(null)}
            />
          ) : (
            canEdit && (
              <div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setEditing({ mode: "add", parentId: null })}
                >
                  <Plus /> Add subject
                </Button>
              </div>
            )
          )}
        </CardContent>
      </Card>
    </div>
  );
}
