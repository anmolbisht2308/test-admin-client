"use client";

import { errorMessage, fieldErrors, isApiError, useAuth } from "@mockprep/api-client";
import {
  examListResponseSchema,
  planInputSchema,
  planListResponseSchema,
  type Plan,
  type PlanKind,
} from "@mockprep/types";
import {
  Alert,
  Badge,
  Button,
  Card,
  CardContent,
  Field,
  Input,
  Select,
  TBody,
  TD,
  TH,
  THead,
  TR,
  Table,
  Textarea,
} from "@mockprep/ui";
import { useState, type FormEvent } from "react";
import { PageHeader } from "@/components/page-header";
import { formatRupees, paiseToRupeesInput, rupeesToPaise } from "@/lib/money";
import { canManageMoney } from "@/lib/roles";
import { useApiQuery } from "@/lib/use-api-query";

interface Draft {
  id: string | null;
  name: string;
  description: string;
  kind: PlanKind;
  examKeys: string[];
  price: string;
  mrp: string;
  validityDays: string;
  active: boolean;
  sortOrder: string;
}

const EMPTY: Draft = {
  id: null,
  name: "",
  description: "",
  kind: "series",
  examKeys: [],
  price: "",
  mrp: "",
  validityDays: "365",
  active: true,
  sortOrder: "100",
};

const toDraft = (p: Plan): Draft => ({
  id: p.id,
  name: p.name,
  description: p.description,
  kind: p.kind,
  examKeys: p.examKeys,
  price: paiseToRupeesInput(p.pricePaise),
  mrp: paiseToRupeesInput(p.mrpPaise),
  validityDays: String(p.validityDays),
  active: p.active,
  sortOrder: String(p.sortOrder),
});

/** Plans students can buy: a test series (some exams) or a pass (every exam). */
export default function PlansPage() {
  const { api, state } = useAuth();
  const canEdit = canManageMoney(state.user?.role);
  const plans = useApiQuery("/api/admin/plans", planListResponseSchema);
  const exams = useApiQuery("/api/admin/exams", examListResponseSchema);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState<{ kind: "success" | "error"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const examName = (slug: string) =>
    exams.data?.exams.find((e) => e.slug === slug)?.shortName ?? slug;

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!draft) return;
    const input = {
      name: draft.name,
      description: draft.description,
      kind: draft.kind,
      examKeys: draft.kind === "pass" ? [] : draft.examKeys,
      pricePaise: rupeesToPaise(draft.price) ?? -1,
      mrpPaise: draft.mrp.trim() ? (rupeesToPaise(draft.mrp) ?? -1) : null,
      validityDays: Number(draft.validityDays),
      active: draft.active,
      sortOrder: Number(draft.sortOrder) || 100,
    };
    const parsed = planInputSchema.safeParse(input);
    if (!parsed.success) return setErrors(fieldErrors(parsed.error.issues));
    setErrors({});
    setBusy(true);
    try {
      await api.request(draft.id ? `/api/admin/plans/${draft.id}` : "/api/admin/plans", {
        method: draft.id ? "PUT" : "POST",
        body: parsed.data,
      });
      setNotice({ kind: "success", text: `Saved “${parsed.data.name}”.` });
      setDraft(null);
      plans.reload();
    } catch (err) {
      if (isApiError(err) && err.status === 400) setErrors(fieldErrors(err.details));
      setNotice({ kind: "error", text: errorMessage(err) });
    } finally {
      setBusy(false);
    }
  }

  async function remove(p: Plan) {
    if (!window.confirm(`Delete “${p.name}”?`)) return;
    try {
      await api.request(`/api/admin/plans/${p.id}`, { method: "DELETE" });
      plans.reload();
    } catch (err) {
      setNotice({ kind: "error", text: errorMessage(err) });
    }
  }

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) =>
    setDraft((d) => (d ? { ...d, [key]: value } : d));

  return (
    <>
      <PageHeader
        title="Plans"
        description="Prices include 18% GST. Edits apply to new purchases only."
        action={
          canEdit && !draft ? <Button onClick={() => setDraft(EMPTY)}>New plan</Button> : null
        }
      />
      {(plans.error ?? exams.error) && <Alert className="mb-4">{plans.error ?? exams.error}</Alert>}
      {notice && (
        <Alert variant={notice.kind} className="mb-4">
          {notice.text}
        </Alert>
      )}

      {draft && (
        <Card className="mb-6">
          <CardContent className="py-4">
            <form onSubmit={(e) => void save(e)} className="grid gap-4 sm:grid-cols-2">
              <Field label="Name" htmlFor="name" error={errors.name}>
                <Input id="name" value={draft.name} onChange={(e) => set("name", e.target.value)} />
              </Field>
              <Field label="Kind" htmlFor="kind">
                <Select
                  id="kind"
                  value={draft.kind}
                  onChange={(e) => set("kind", e.target.value === "pass" ? "pass" : "series")}
                >
                  <option value="series">Test series (chosen exams)</option>
                  <option value="pass">Pass (every exam)</option>
                </Select>
              </Field>
              {draft.kind === "series" && (
                <Field
                  label="Exams"
                  htmlFor="exams"
                  error={errors.examKeys}
                  className="sm:col-span-2"
                >
                  <div id="exams" className="flex flex-wrap gap-2">
                    {exams.data?.exams.map((ex) => (
                      <label
                        key={ex.slug}
                        className="flex min-h-9 items-center gap-2 rounded-md border px-2 text-sm"
                      >
                        <input
                          type="checkbox"
                          checked={draft.examKeys.includes(ex.slug)}
                          onChange={(e) =>
                            set(
                              "examKeys",
                              e.target.checked
                                ? [...draft.examKeys, ex.slug]
                                : draft.examKeys.filter((k) => k !== ex.slug),
                            )
                          }
                        />
                        {ex.shortName}
                      </label>
                    ))}
                  </div>
                </Field>
              )}
              <Field label="Price (₹, incl. GST)" htmlFor="price" error={errors.pricePaise}>
                <Input
                  id="price"
                  inputMode="decimal"
                  value={draft.price}
                  onChange={(e) => set("price", e.target.value)}
                />
              </Field>
              <Field
                label="MRP (₹, optional, shown struck through)"
                htmlFor="mrp"
                error={errors.mrpPaise}
              >
                <Input
                  id="mrp"
                  inputMode="decimal"
                  value={draft.mrp}
                  onChange={(e) => set("mrp", e.target.value)}
                />
              </Field>
              <Field label="Validity (days)" htmlFor="validity" error={errors.validityDays}>
                <Input
                  id="validity"
                  inputMode="numeric"
                  value={draft.validityDays}
                  onChange={(e) => set("validityDays", e.target.value)}
                />
              </Field>
              <Field label="Sort order" htmlFor="sort">
                <Input
                  id="sort"
                  inputMode="numeric"
                  value={draft.sortOrder}
                  onChange={(e) => set("sortOrder", e.target.value)}
                />
              </Field>
              <Field label="Description" htmlFor="desc" className="sm:col-span-2">
                <Textarea
                  id="desc"
                  rows={2}
                  value={draft.description}
                  onChange={(e) => set("description", e.target.value)}
                />
              </Field>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={draft.active}
                  onChange={(e) => set("active", e.target.checked)}
                />
                Active (shown on the pricing page)
              </label>
              <div className="flex gap-2 sm:col-span-2">
                <Button type="submit" disabled={busy}>
                  {draft.id ? "Save plan" : "Create plan"}
                </Button>
                <Button type="button" variant="ghost" onClick={() => setDraft(null)}>
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <Table>
        <THead>
          <TR>
            <TH>Plan</TH>
            <TH>Covers</TH>
            <TH className="text-right">Price</TH>
            <TH className="text-right">Validity</TH>
            <TH />
          </TR>
        </THead>
        <TBody>
          {plans.data?.plans.map((p) => (
            <TR key={p.id}>
              <TD>
                <span className="font-medium">{p.name}</span>{" "}
                {!p.active && <Badge variant="secondary">Inactive</Badge>}
              </TD>
              <TD className="text-sm">
                {p.kind === "pass" ? "Every exam" : p.examKeys.map(examName).join(", ")}
              </TD>
              <TD className="text-right tabular-nums">{formatRupees(p.pricePaise)}</TD>
              <TD className="text-right tabular-nums">{p.validityDays} d</TD>
              <TD className="text-right whitespace-nowrap">
                {canEdit && (
                  <>
                    <Button size="sm" variant="ghost" onClick={() => setDraft(toDraft(p))}>
                      Edit
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => void remove(p)}>
                      Delete
                    </Button>
                  </>
                )}
              </TD>
            </TR>
          ))}
        </TBody>
      </Table>
      {plans.data?.plans.length === 0 && (
        <p className="mt-3 text-sm text-muted-foreground">No plans yet.</p>
      )}
    </>
  );
}
