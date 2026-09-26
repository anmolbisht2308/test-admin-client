"use client";

import { ApiError, errorMessage, useAuth } from "@mockprep/api-client";
import {
  purchaseListResponseSchema,
  referralResponseSchema,
  type Purchase,
  type ReferralResponse,
} from "@mockprep/types";
import { Alert, Badge, Button, Card, CardContent, CardHeader, CardTitle } from "@mockprep/ui";
import Link from "next/link";
import { useEffect, useState } from "react";
import { daysLeft, formatIstDate, formatRupees } from "@/lib/payments";
import { useRequireStudent } from "@/lib/use-require-student";

const STATUS_LABEL: Record<Purchase["status"], string> = {
  created: "Pending",
  failed: "Failed",
  paid: "Paid",
  refund_pending: "Refund in progress",
  refunded: "Refunded",
};

function PurchaseCard({ p, onDownload }: { p: Purchase; onDownload: (kind: string) => void }) {
  const left = p.validUntil ? daysLeft(p.validUntil) : 0;
  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={p.active ? "success" : "secondary"}>
            {p.active
              ? "Active"
              : STATUS_LABEL[p.status] === "Paid"
                ? "Expired"
                : STATUS_LABEL[p.status]}
          </Badge>
          <span className="text-sm text-muted-foreground tabular-nums">
            {formatRupees(p.amountPaise)}
          </span>
        </div>
        <CardTitle className="mt-2 text-base">{p.planName}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 text-sm">
        <p className="text-muted-foreground">
          {p.paidAt ? `Bought ${formatIstDate(p.paidAt)}` : ""}
          {p.validUntil && p.active
            ? ` · valid till ${formatIstDate(p.validUntil)} (${left} day${left === 1 ? "" : "s"} left)`
            : ""}
        </p>
        <div className="flex flex-wrap gap-2">
          {p.invoice && (
            <Button variant="outline" size="sm" onClick={() => onDownload("invoice")}>
              Invoice {p.invoice.number}
            </Button>
          )}
          {p.creditNote && (
            <Button variant="outline" size="sm" onClick={() => onDownload("credit_note")}>
              Credit note {p.creditNote.number}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function ReferralCard({ r }: { r: ReferralResponse }) {
  const [copied, setCopied] = useState(false);
  const link = `${typeof window === "undefined" ? "" : window.location.origin}/login?ref=${r.code}`;
  const unused = r.coupons.filter((c) => c.uses === 0);
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Invite friends, get 20% off</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 text-sm">
        <p className="text-muted-foreground">
          When a friend signs up with your link and buys their first plan, you get a 20% off coupon.
          Your code: <strong className="font-mono text-foreground">{r.code}</strong>
        </p>
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            onClick={() => {
              void navigator.clipboard?.writeText(link).then(() => setCopied(true));
            }}
          >
            {copied ? "Link copied" : "Copy invite link"}
          </Button>
          <Button asChild size="sm" variant="outline">
            <a
              href={`https://wa.me/?text=${encodeURIComponent(`Practise real-exam mocks on mockprep: ${link}`)}`}
              target="_blank"
              rel="noreferrer"
            >
              Share on WhatsApp
            </a>
          </Button>
        </div>
        {r.rewarded > 0 && <p>{r.rewarded} friend(s) joined and bought a plan.</p>}
        {unused.length > 0 && (
          <p>
            Your coupons:{" "}
            {unused.map((c) => (
              <strong key={c.code} className="mr-2 font-mono">
                {c.code}
              </strong>
            ))}
            {unused[0]?.expiresAt ? `(use by ${formatIstDate(unused[0].expiresAt)})` : ""}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

export default function PurchasesPage() {
  const user = useRequireStudent();
  const { api } = useAuth();
  const [purchases, setPurchases] = useState<Purchase[] | null>(null);
  const [referral, setReferral] = useState<ReferralResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    api
      .request("/api/me/purchases", { schema: purchaseListResponseSchema })
      .then((r) => setPurchases(r.purchases))
      .catch((e: unknown) => setError(errorMessage(e)));
    api
      .request("/api/me/referral", { schema: referralResponseSchema })
      .then(setReferral)
      .catch(() => undefined);
  }, [api, user]);

  async function download(orderId: string, kind: string) {
    setError(null);
    try {
      const res = await api.fetchRaw(`/api/me/purchases/${orderId}/invoice?kind=${kind}`);
      if (!res.ok) throw await ApiError.fromResponse(res);
      const name =
        /filename="([^"]+)"/.exec(res.headers.get("content-disposition") ?? "")?.[1] ??
        "invoice.pdf";
      const url = URL.createObjectURL(await res.blob());
      const a = document.createElement("a");
      a.href = url;
      a.download = name;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  if (!user) return <p className="text-sm text-muted-foreground">Loading…</p>;
  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight">My purchases</h1>
        <p className="text-sm text-muted-foreground">Plans, validity and GST invoices.</p>
      </header>
      {error && <Alert>{error}</Alert>}
      {purchases === null ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : purchases.length === 0 ? (
        <div className="flex flex-col items-start gap-3">
          <p className="text-sm text-muted-foreground">You haven&apos;t bought a plan yet.</p>
          <Button asChild>
            <Link href="/pricing">See plans</Link>
          </Button>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {purchases.map((p) => (
            <PurchaseCard key={p.orderId} p={p} onDownload={(k) => void download(p.orderId, k)} />
          ))}
        </div>
      )}
      {referral && <ReferralCard r={referral} />}
    </div>
  );
}
