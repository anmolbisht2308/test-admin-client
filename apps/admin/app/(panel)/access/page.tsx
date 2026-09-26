"use client";

import { errorMessage, fieldErrors, isApiError, useAuth } from "@mockprep/api-client";
import {
  adminGrantListResponseSchema,
  examListResponseSchema,
  grantInputSchema,
} from "@mockprep/types";
import {
  Alert,
  Badge,
  Button,
  Card,
  CardContent,
  Field,
  Input,
  TBody,
  TD,
  TH,
  THead,
  TR,
  Table,
} from "@mockprep/ui";
import { useState, type FormEvent } from "react";
import { PageHeader } from "@/components/page-header";
import { formatIst } from "@/lib/format";
import { canServeOrders } from "@/lib/roles";
import { useApiQuery } from "@/lib/use-api-query";

/** Manual access for support cases (every grant and revoke is audited). */
export default function AccessPage() {
  const { api, state } = useAuth();
  const allowed = canServeOrders(state.user?.role);
  const grants = useApiQuery(
    allowed ? "/api/admin/entitlements" : null,
    adminGrantListResponseSchema,
  );
  const exams = useApiQuery("/api/admin/exams", examListResponseSchema);
  const [identifier, setIdentifier] = useState("");
  const [all, setAll] = useState(false);
  const [examKeys, setExamKeys] = useState<string[]>([]);
  const [days, setDays] = useState("30");
  const [note, setNote] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState<{ kind: "success" | "error"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function grant(e: FormEvent) {
    e.preventDefault();
    const parsed = grantInputSchema.safeParse({
      identifier,
      all,
      examKeys: all ? [] : examKeys,
      validityDays: Number(days),
      note,
    });
    if (!parsed.success) return setErrors(fieldErrors(parsed.error.issues));
    setErrors({});
    setBusy(true);
    setNotice(null);
    try {
      await api.request("/api/admin/entitlements", { method: "POST", body: parsed.data });
      setNotice({ kind: "success", text: `Access granted to ${identifier} for ${days} days.` });
      setIdentifier("");
      setNote("");
      grants.reload();
    } catch (err) {
      if (isApiError(err) && err.status === 400) setErrors(fieldErrors(err.details));
      setNotice({ kind: "error", text: errorMessage(err) });
    } finally {
      setBusy(false);
    }
  }

  async function revoke(id: string) {
    if (!window.confirm("Revoke this access now?")) return;
    try {
      await api.request(`/api/admin/entitlements/${id}`, { method: "DELETE" });
      grants.reload();
    } catch (err) {
      setNotice({ kind: "error", text: errorMessage(err) });
    }
  }

  if (!allowed) return <Alert>Only super admin, finance and support can grant access.</Alert>;

  return (
    <>
      <PageHeader
        title="Manual access"
        description="For support cases: payment stuck, goodwill, partner students. Purchases grant access on their own."
      />
      {notice && (
        <Alert variant={notice.kind} className="mb-4">
          {notice.text}
        </Alert>
      )}
      <Card className="mb-6">
        <CardContent className="py-4">
          <form onSubmit={(e) => void grant(e)} className="grid gap-4 sm:grid-cols-2">
            <Field label="Student email or phone" htmlFor="who" error={errors.identifier}>
              <Input id="who" value={identifier} onChange={(e) => setIdentifier(e.target.value)} />
            </Field>
            <Field label="Days" htmlFor="days" error={errors.validityDays}>
              <Input
                id="days"
                inputMode="numeric"
                value={days}
                onChange={(e) => setDays(e.target.value)}
              />
            </Field>
            <Field label="Exams" htmlFor="exams" error={errors.examKeys} className="sm:col-span-2">
              <div id="exams" className="flex flex-wrap gap-2">
                <label className="flex min-h-9 items-center gap-2 rounded-md border px-2 text-sm font-medium">
                  <input type="checkbox" checked={all} onChange={(e) => setAll(e.target.checked)} />
                  All exams
                </label>
                {!all &&
                  exams.data?.exams.map((ex) => (
                    <label
                      key={ex.slug}
                      className="flex min-h-9 items-center gap-2 rounded-md border px-2 text-sm"
                    >
                      <input
                        type="checkbox"
                        checked={examKeys.includes(ex.slug)}
                        onChange={(e) =>
                          setExamKeys((keys) =>
                            e.target.checked
                              ? [...keys, ex.slug]
                              : keys.filter((k) => k !== ex.slug),
                          )
                        }
                      />
                      {ex.shortName}
                    </label>
                  ))}
              </div>
            </Field>
            <Field
              label="Why (ticket number, reason)"
              htmlFor="note"
              error={errors.note}
              className="sm:col-span-2"
            >
              <Input id="note" value={note} onChange={(e) => setNote(e.target.value)} />
            </Field>
            <div>
              <Button type="submit" disabled={busy}>
                Grant access
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {grants.error && <Alert className="mb-4">{grants.error}</Alert>}
      <Table>
        <THead>
          <TR>
            <TH>Student</TH>
            <TH>Access</TH>
            <TH>Until</TH>
            <TH>Note</TH>
            <TH />
          </TR>
        </THead>
        <TBody>
          {grants.data?.grants.map((g) => (
            <TR key={g.id}>
              <TD className="text-sm">
                {g.user.name ?? "–"}
                <span className="block text-muted-foreground">{g.user.email ?? g.user.phone}</span>
              </TD>
              <TD className="text-sm">{g.all ? "All exams" : g.examKeys.join(", ")}</TD>
              <TD className="text-sm whitespace-nowrap">
                {g.revokedAt ? <Badge variant="secondary">Revoked</Badge> : formatIst(g.expiresAt)}
              </TD>
              <TD className="text-sm">{g.note}</TD>
              <TD className="text-right">
                {!g.revokedAt && (
                  <Button size="sm" variant="ghost" onClick={() => void revoke(g.id)}>
                    Revoke
                  </Button>
                )}
              </TD>
            </TR>
          ))}
        </TBody>
      </Table>
    </>
  );
}
