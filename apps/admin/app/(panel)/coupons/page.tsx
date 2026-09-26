"use client";

import { errorMessage, fieldErrors, isApiError, useAuth } from "@mockprep/api-client";
import {
  couponInputSchema,
  couponListResponseSchema,
  planListResponseSchema,
  type Coupon,
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
} from "@mockprep/ui";
import { useState, type FormEvent } from "react";
import { PageHeader } from "@/components/page-header";
import { formatIst, fromIstInput, toIstInput } from "@/lib/format";
import { formatRupees, paiseToRupeesInput, rupeesToPaise } from "@/lib/money";
import { canManageMoney } from "@/lib/roles";
import { useApiQuery } from "@/lib/use-api-query";

interface Draft {
  id: string | null;
  code: string;
  kind: "percent" | "flat";
  percent: string;
  flat: string;
  maxUses: string;
  perUserLimit: string;
  expiresAt: string;
  planIds: string[];
  active: boolean;
}

const EMPTY: Draft = {
  id: null,
  code: "",
  kind: "percent",
  percent: "10",
  flat: "",
  maxUses: "",
  perUserLimit: "1",
  expiresAt: "",
  planIds: [],
  active: true,
};

const toDraft = (c: Coupon): Draft => ({
  id: c.id,
  code: c.code,
  kind: c.kind,
  percent: c.percent === null ? "" : String(c.percent),
  flat: paiseToRupeesInput(c.flatPaise),
  maxUses: c.maxUses === null ? "" : String(c.maxUses),
  perUserLimit: String(c.perUserLimit),
  expiresAt: toIstInput(c.expiresAt),
  planIds: c.planIds,
  active: c.active,
});

const discount = (c: Coupon) =>
  c.kind === "percent" ? `${c.percent ?? 0}%` : formatRupees(c.flatPaise ?? 0);

/** Discount codes. Referral credit coupons (one student each) are listed separately. */
export default function CouponsPage() {
  const { api, state } = useAuth();
  const canEdit = canManageMoney(state.user?.role);
  const [referral, setReferral] = useState(false);
  const coupons = useApiQuery(
    `/api/admin/coupons?referral=${referral ? "true" : "false"}`,
    couponListResponseSchema,
  );
  const plans = useApiQuery("/api/admin/plans", planListResponseSchema);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState<{ kind: "success" | "error"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) =>
    setDraft((d) => (d ? { ...d, [key]: value } : d));

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!draft) return;
    const input = {
      code: draft.code,
      kind: draft.kind,
      percent: draft.kind === "percent" ? Number(draft.percent) : null,
      flatPaise: draft.kind === "flat" ? (rupeesToPaise(draft.flat) ?? -1) : null,
      maxUses: draft.maxUses.trim() ? Number(draft.maxUses) : null,
      perUserLimit: Number(draft.perUserLimit),
      expiresAt: fromIstInput(draft.expiresAt),
      planIds: draft.planIds,
      active: draft.active,
    };
    const parsed = couponInputSchema.safeParse(input);
    if (!parsed.success) return setErrors(fieldErrors(parsed.error.issues));
    setErrors({});
    setBusy(true);
    try {
      await api.request(draft.id ? `/api/admin/coupons/${draft.id}` : "/api/admin/coupons", {
        method: draft.id ? "PUT" : "POST",
        body: parsed.data,
      });
      setNotice({ kind: "success", text: `Saved ${parsed.data.code}.` });
      setDraft(null);
      coupons.reload();
    } catch (err) {
      if (isApiError(err) && err.status === 400) setErrors(fieldErrors(err.details));
      setNotice({ kind: "error", text: errorMessage(err) });
    } finally {
      setBusy(false);
    }
  }

  async function remove(c: Coupon) {
    if (!window.confirm(`Delete ${c.code}?`)) return;
    try {
      await api.request(`/api/admin/coupons/${c.id}`, { method: "DELETE" });
      coupons.reload();
    } catch (err) {
      setNotice({ kind: "error", text: errorMessage(err) });
    }
  }

  return (
    <>
      <PageHeader
        title="Coupons"
        description="A use is counted when an order is paid."
        action={
          canEdit && !draft && !referral ? (
            <Button onClick={() => setDraft(EMPTY)}>New coupon</Button>
          ) : null
        }
      />
      <div className="mb-4 flex gap-2">
        <Button
          size="sm"
          variant={referral ? "ghost" : "secondary"}
          onClick={() => setReferral(false)}
        >
          Coupons
        </Button>
        <Button
          size="sm"
          variant={referral ? "secondary" : "ghost"}
          onClick={() => setReferral(true)}
        >
          Referral credits
        </Button>
      </div>
      {coupons.error && <Alert className="mb-4">{coupons.error}</Alert>}
      {notice && (
        <Alert variant={notice.kind} className="mb-4">
          {notice.text}
        </Alert>
      )}

      {draft && (
        <Card className="mb-6">
          <CardContent className="py-4">
            <form onSubmit={(e) => void save(e)} className="grid gap-4 sm:grid-cols-2">
              <Field label="Code" htmlFor="code" error={errors.code}>
                <Input
                  id="code"
                  value={draft.code}
                  onChange={(e) => set("code", e.target.value.toUpperCase())}
                />
              </Field>
              <Field label="Discount" htmlFor="kind">
                <Select
                  id="kind"
                  value={draft.kind}
                  onChange={(e) => set("kind", e.target.value === "flat" ? "flat" : "percent")}
                >
                  <option value="percent">Percent off</option>
                  <option value="flat">Flat ₹ off</option>
                </Select>
              </Field>
              {draft.kind === "percent" ? (
                <Field label="Percent" htmlFor="percent" error={errors.percent}>
                  <Input
                    id="percent"
                    inputMode="numeric"
                    value={draft.percent}
                    onChange={(e) => set("percent", e.target.value)}
                  />
                </Field>
              ) : (
                <Field label="Amount off (₹)" htmlFor="flat" error={errors.flatPaise}>
                  <Input
                    id="flat"
                    inputMode="decimal"
                    value={draft.flat}
                    onChange={(e) => set("flat", e.target.value)}
                  />
                </Field>
              )}
              <Field label="Expires (IST, optional)" htmlFor="expires" error={errors.expiresAt}>
                <Input
                  id="expires"
                  type="datetime-local"
                  value={draft.expiresAt}
                  onChange={(e) => set("expiresAt", e.target.value)}
                />
              </Field>
              <Field
                label="Max uses in total (empty = unlimited)"
                htmlFor="max"
                error={errors.maxUses}
              >
                <Input
                  id="max"
                  inputMode="numeric"
                  value={draft.maxUses}
                  onChange={(e) => set("maxUses", e.target.value)}
                />
              </Field>
              <Field label="Uses per student" htmlFor="per" error={errors.perUserLimit}>
                <Input
                  id="per"
                  inputMode="numeric"
                  value={draft.perUserLimit}
                  onChange={(e) => set("perUserLimit", e.target.value)}
                />
              </Field>
              <Field label="Plans (none = every plan)" htmlFor="plans" className="sm:col-span-2">
                <div id="plans" className="flex flex-wrap gap-2">
                  {plans.data?.plans.map((p) => (
                    <label
                      key={p.id}
                      className="flex min-h-9 items-center gap-2 rounded-md border px-2 text-sm"
                    >
                      <input
                        type="checkbox"
                        checked={draft.planIds.includes(p.id)}
                        onChange={(e) =>
                          set(
                            "planIds",
                            e.target.checked
                              ? [...draft.planIds, p.id]
                              : draft.planIds.filter((id) => id !== p.id),
                          )
                        }
                      />
                      {p.name}
                    </label>
                  ))}
                </div>
              </Field>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={draft.active}
                  onChange={(e) => set("active", e.target.checked)}
                />
                Active
              </label>
              <div className="flex gap-2 sm:col-span-2">
                <Button type="submit" disabled={busy}>
                  {draft.id ? "Save coupon" : "Create coupon"}
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
            <TH>Code</TH>
            <TH>Discount</TH>
            <TH className="text-right">Used</TH>
            <TH>Expires</TH>
            <TH />
          </TR>
        </THead>
        <TBody>
          {coupons.data?.coupons.map((c) => (
            <TR key={c.id}>
              <TD>
                <span className="font-mono font-medium">{c.code}</span>{" "}
                {!c.active && <Badge variant="secondary">Inactive</Badge>}
              </TD>
              <TD>{discount(c)}</TD>
              <TD className="text-right tabular-nums">
                {c.uses}
                {c.maxUses !== null ? ` / ${c.maxUses}` : ""}
              </TD>
              <TD className="text-sm">{c.expiresAt ? formatIst(c.expiresAt) : "Never"}</TD>
              <TD className="text-right whitespace-nowrap">
                {canEdit && !referral && (
                  <>
                    <Button size="sm" variant="ghost" onClick={() => setDraft(toDraft(c))}>
                      Edit
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => void remove(c)}>
                      Delete
                    </Button>
                  </>
                )}
              </TD>
            </TR>
          ))}
        </TBody>
      </Table>
      {coupons.data?.coupons.length === 0 && (
        <p className="mt-3 text-sm text-muted-foreground">None yet.</p>
      )}
    </>
  );
}
