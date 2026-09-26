"use client";

import { errorMessage, useAuth } from "@mockprep/api-client";
import {
  adminOrderListResponseSchema,
  orderStatusSchema,
  planListResponseSchema,
  type AdminOrder,
  type OrderStatus,
} from "@mockprep/types";
import { Alert, Badge, Button, Input, Select, TBody, TD, TH, THead, TR, Table } from "@mockprep/ui";
import { Fragment, useState } from "react";
import { PageHeader } from "@/components/page-header";
import { downloadFile } from "@/lib/download";
import { formatIst, fromIstInput } from "@/lib/format";
import { formatRupees } from "@/lib/money";
import { canManageMoney } from "@/lib/roles";
import { useApiQuery } from "@/lib/use-api-query";

const STATUS: Record<
  OrderStatus,
  { label: string; variant: "success" | "secondary" | "destructive" | "outline" }
> = {
  created: { label: "Created", variant: "outline" },
  paid: { label: "Paid", variant: "success" },
  failed: { label: "Failed", variant: "destructive" },
  refund_pending: { label: "Refund pending", variant: "secondary" },
  refunded: { label: "Refunded", variant: "secondary" },
};

function RefundRow({
  order,
  onDone,
}: {
  order: AdminOrder;
  onDone: (text: string | null) => void;
}) {
  const { api } = useAuth();
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function refund() {
    setBusy(true);
    setError(null);
    try {
      await api.request(`/api/admin/orders/${order.id}/refund`, {
        method: "POST",
        body: { reason },
      });
      onDone(
        `Refund of ${formatRupees(order.amountPaise)} started for ${order.user.email ?? order.user.phone ?? "the student"}.`,
      );
    } catch (e) {
      setError(errorMessage(e));
      setBusy(false);
    }
  }
  return (
    <TR>
      <TD colSpan={7} className="bg-muted/40">
        <div className="flex flex-wrap items-end gap-2 py-2">
          <label className="flex min-w-64 flex-1 flex-col gap-1 text-sm">
            Reason for the refund (kept in the audit log)
            <Input value={reason} onChange={(e) => setReason(e.target.value)} autoFocus />
          </label>
          <Button
            variant="destructive"
            disabled={busy || reason.trim().length < 3}
            onClick={() => void refund()}
          >
            Refund {formatRupees(order.amountPaise)} and revoke access
          </Button>
          <Button variant="ghost" onClick={() => onDone(null)}>
            Cancel
          </Button>
        </div>
        {error && <Alert className="mt-1">{error}</Alert>}
      </TD>
    </TR>
  );
}

/** Orders with filters; refunds go through Razorpay and revoke access when processed. */
export default function OrdersPage() {
  const { api, state } = useAuth();
  const canRefund = canManageMoney(state.user?.role);
  const plans = useApiQuery("/api/admin/plans", planListResponseSchema);
  const [status, setStatus] = useState<OrderStatus | "">("");
  const [planId, setPlanId] = useState("");
  const [q, setQ] = useState("");
  const [query, setQuery] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);
  const [refunding, setRefunding] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ kind: "success" | "error"; text: string } | null>(null);

  const params = new URLSearchParams();
  if (status) params.set("status", status);
  if (planId) params.set("planId", planId);
  if (query) params.set("q", query);
  const fromIso = fromIstInput(from ? `${from}T00:00` : "");
  const toIso = fromIstInput(to ? `${to}T23:59` : "");
  if (fromIso) params.set("from", fromIso);
  if (toIso) params.set("to", toIso);
  params.set("page", String(page));
  const orders = useApiQuery(
    `/api/admin/orders?${params.toString()}`,
    adminOrderListResponseSchema,
  );
  const pages = orders.data ? Math.max(1, Math.ceil(orders.data.total / orders.data.pageSize)) : 1;

  async function invoice(o: AdminOrder, kind: "invoice" | "credit_note") {
    try {
      await downloadFile(api, `/api/admin/orders/${o.id}/invoice?kind=${kind}`, `${kind}.pdf`);
    } catch (e) {
      setNotice({ kind: "error", text: errorMessage(e) });
    }
  }

  return (
    <>
      <PageHeader title="Orders" description="Times in IST. Amounts include GST." />
      <form
        className="mb-4 flex flex-wrap items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          setPage(1);
          setQuery(q.trim());
        }}
      >
        <Input
          className="w-64"
          placeholder="Email, phone, name, coupon or Razorpay id"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          aria-label="Search"
        />
        <Select
          aria-label="Status"
          className="w-40"
          value={status}
          onChange={(e) => {
            const parsed = orderStatusSchema.safeParse(e.target.value);
            setStatus(parsed.success ? parsed.data : "");
            setPage(1);
          }}
        >
          <option value="">Any status</option>
          {orderStatusSchema.options.map((s) => (
            <option key={s} value={s}>
              {STATUS[s].label}
            </option>
          ))}
        </Select>
        <Select
          aria-label="Plan"
          className="w-48"
          value={planId}
          onChange={(e) => {
            setPlanId(e.target.value);
            setPage(1);
          }}
        >
          <option value="">Any plan</option>
          {plans.data?.plans.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </Select>
        <Input
          type="date"
          aria-label="From"
          className="w-40"
          value={from}
          onChange={(e) => setFrom(e.target.value)}
        />
        <Input
          type="date"
          aria-label="To"
          className="w-40"
          value={to}
          onChange={(e) => setTo(e.target.value)}
        />
        <Button type="submit" variant="secondary">
          Search
        </Button>
      </form>
      {orders.error && <Alert className="mb-4">{orders.error}</Alert>}
      {notice && (
        <Alert variant={notice.kind} className="mb-4">
          {notice.text}
        </Alert>
      )}
      <Table>
        <THead>
          <TR>
            <TH>When</TH>
            <TH>Student</TH>
            <TH>Plan</TH>
            <TH className="text-right">Amount</TH>
            <TH>Status</TH>
            <TH>Invoice</TH>
            <TH />
          </TR>
        </THead>
        <TBody>
          {orders.data?.orders.map((o) => (
            <Fragment key={o.id}>
              <TR>
                <TD className="text-sm whitespace-nowrap">{formatIst(o.paidAt ?? o.createdAt)}</TD>
                <TD className="text-sm">
                  {o.user.name ?? "–"}
                  <br />
                  <span className="text-muted-foreground">{o.user.email ?? o.user.phone}</span>
                </TD>
                <TD className="text-sm">
                  {o.plan.name}
                  {o.couponCode && (
                    <span className="block text-muted-foreground">
                      {o.couponCode} −{formatRupees(o.discountPaise)}
                    </span>
                  )}
                </TD>
                <TD className="text-right tabular-nums">{formatRupees(o.amountPaise)}</TD>
                <TD>
                  <Badge variant={STATUS[o.status].variant}>{STATUS[o.status].label}</Badge>
                  {o.refundReason && (
                    <span className="block text-xs text-muted-foreground">{o.refundReason}</span>
                  )}
                </TD>
                <TD className="text-sm whitespace-nowrap">
                  {o.invoiceNumber ? (
                    <button
                      type="button"
                      className="text-primary hover:underline"
                      onClick={() => void invoice(o, "invoice")}
                    >
                      {o.invoiceNumber}
                    </button>
                  ) : (
                    "–"
                  )}
                  {o.status === "refunded" && (
                    <button
                      type="button"
                      className="block text-primary hover:underline"
                      onClick={() => void invoice(o, "credit_note")}
                    >
                      Credit note
                    </button>
                  )}
                </TD>
                <TD className="text-right">
                  {canRefund && o.status === "paid" && refunding !== o.id && (
                    <Button size="sm" variant="ghost" onClick={() => setRefunding(o.id)}>
                      Refund
                    </Button>
                  )}
                </TD>
              </TR>
              {refunding === o.id && (
                <RefundRow
                  order={o}
                  onDone={(text) => {
                    setRefunding(null);
                    if (text) {
                      setNotice({ kind: "success", text });
                      orders.reload();
                    }
                  }}
                />
              )}
            </Fragment>
          ))}
        </TBody>
      </Table>
      {orders.data?.orders.length === 0 && (
        <p className="mt-3 text-sm text-muted-foreground">No orders match.</p>
      )}
      {pages > 1 && (
        <div className="mt-4 flex items-center gap-2 text-sm">
          <Button
            size="sm"
            variant="outline"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
          >
            Previous
          </Button>
          Page {page} of {pages}
          <Button
            size="sm"
            variant="outline"
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
