"use client";

import { revenueReportSchema } from "@mockprep/types";
import {
  Alert,
  Button,
  Card,
  CardContent,
  Input,
  TBody,
  TD,
  TH,
  THead,
  TR,
  Table,
} from "@mockprep/ui";
import { useState } from "react";
import { PageHeader } from "@/components/page-header";
import { fromIstInput } from "@/lib/format";
import { formatRupees } from "@/lib/money";
import { useApiQuery } from "@/lib/use-api-query";

const istDay = (offsetDays: number) =>
  new Date(Date.now() + 330 * 60_000 + offsetDays * 86_400_000).toISOString().slice(0, 10);

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardContent className="py-4">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="text-2xl font-semibold tabular-nums">{value}</p>
      </CardContent>
    </Card>
  );
}

/** Revenue: daily (IST), by plan, coupon usage, refunds. */
export default function RevenuePage() {
  const [from, setFrom] = useState(istDay(-29));
  const [to, setTo] = useState(istDay(0));
  const [range, setRange] = useState({ from, to });
  const params = new URLSearchParams();
  const fromIso = fromIstInput(`${range.from}T00:00`);
  const toIso = fromIstInput(`${range.to}T23:59`);
  if (fromIso) params.set("from", fromIso);
  if (toIso) params.set("to", toIso);
  const { data, error } = useApiQuery(
    `/api/admin/revenue?${params.toString()}`,
    revenueReportSchema,
  );
  const max = Math.max(1, ...(data?.daily.map((d) => d.amountPaise) ?? [1]));

  return (
    <>
      <PageHeader title="Revenue" description="Amounts include GST. Days are IST." />
      <form
        className="mb-4 flex flex-wrap items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          setRange({ from, to });
        }}
      >
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
          Show
        </Button>
      </form>
      {error && <Alert className="mb-4">{error}</Alert>}
      {data && (
        <div className="flex flex-col gap-6">
          <div className="grid gap-3 sm:grid-cols-4">
            <Stat label="Gross" value={formatRupees(data.totals.grossPaise)} />
            <Stat label="Refunded" value={formatRupees(data.totals.refundedPaise)} />
            <Stat label="Net" value={formatRupees(data.totals.netPaise)} />
            <Stat label="Paid orders" value={String(data.totals.paidOrders)} />
          </div>

          <section>
            <h2 className="mb-2 font-semibold">Daily</h2>
            {data.daily.length === 0 ? (
              <p className="text-sm text-muted-foreground">No sales in this range.</p>
            ) : (
              <ul className="flex flex-col gap-1">
                {data.daily.map((d) => (
                  <li
                    key={d.date}
                    className="grid grid-cols-[6rem_1fr_7rem] items-center gap-2 text-sm"
                  >
                    <span className="tabular-nums">{d.date}</span>
                    <span
                      className="h-3 rounded bg-primary/80"
                      style={{ width: `${(d.amountPaise / max) * 100}%` }}
                    />
                    <span className="text-right tabular-nums">
                      {formatRupees(d.amountPaise)} · {d.orders}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section>
            <h2 className="mb-2 font-semibold">By plan</h2>
            <Table>
              <THead>
                <TR>
                  <TH>Plan</TH>
                  <TH className="text-right">Orders</TH>
                  <TH className="text-right">Amount</TH>
                </TR>
              </THead>
              <TBody>
                {data.byPlan.map((p) => (
                  <TR key={p.planId}>
                    <TD>{p.name}</TD>
                    <TD className="text-right tabular-nums">{p.orders}</TD>
                    <TD className="text-right tabular-nums">{formatRupees(p.amountPaise)}</TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </section>

          <section>
            <h2 className="mb-2 font-semibold">Coupon usage</h2>
            {data.coupons.length === 0 ? (
              <p className="text-sm text-muted-foreground">No coupons used.</p>
            ) : (
              <Table>
                <THead>
                  <TR>
                    <TH>Code</TH>
                    <TH className="text-right">Orders</TH>
                    <TH className="text-right">Discount given</TH>
                  </TR>
                </THead>
                <TBody>
                  {data.coupons.map((c) => (
                    <TR key={c.code}>
                      <TD className="font-mono">{c.code}</TD>
                      <TD className="text-right tabular-nums">{c.orders}</TD>
                      <TD className="text-right tabular-nums">{formatRupees(c.discountPaise)}</TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            )}
          </section>
        </div>
      )}
    </>
  );
}
