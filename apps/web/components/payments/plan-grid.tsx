"use client";

import { useAuth } from "@mockprep/api-client";
import type { AccessResponse, Plan } from "@mockprep/types";
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, cn } from "@mockprep/ui";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useAccess } from "@/lib/access-store";
import { formatRupees, isUnlocked, savingsPercent } from "@/lib/payments";
import { CheckoutDialog } from "./checkout-dialog";

/** Plan cards with Buy buttons (used by /pricing and the paywall on the start page). */
export function PlanGrid({
  plans,
  examNames,
  highlightExam,
  onPurchased,
}: {
  plans: Plan[];
  /** slug → short name, to list what a series covers. */
  examNames: Record<string, string>;
  highlightExam?: string | null;
  onPurchased?: (access: AccessResponse) => void;
}) {
  const { state } = useAuth();
  const pathname = usePathname();
  const access = useAccess();
  const [buying, setBuying] = useState<Plan | null>(null);

  if (plans.length === 0) {
    return <p className="text-sm text-muted-foreground">Plans are coming soon.</p>;
  }
  const signedIn = state.status === "signed_in";
  const owns = (p: Plan) =>
    !!access &&
    (access.all ||
      (p.kind === "series" &&
        p.examKeys.every((k) => isUnlocked(access, { isFree: false, examKey: k }))));

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2">
        {plans.map((p) => {
          const save = savingsPercent(p);
          const featured = !!highlightExam && p.examKeys.includes(highlightExam);
          return (
            <Card key={p.id} className={cn(featured && "border-primary ring-1 ring-primary")}>
              <CardHeader>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={p.kind === "pass" ? "default" : "outline"}>
                    {p.kind === "pass" ? "All exams" : "Test series"}
                  </Badge>
                  {save !== null && <Badge variant="success">Save {save}%</Badge>}
                </div>
                <CardTitle className="mt-2 text-base">{p.name}</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                <p className="flex items-baseline gap-2">
                  <span className="text-2xl font-bold tabular-nums">
                    {formatRupees(p.pricePaise)}
                  </span>
                  {p.mrpPaise !== null && p.mrpPaise > p.pricePaise && (
                    <s className="text-sm text-muted-foreground tabular-nums">
                      {formatRupees(p.mrpPaise)}
                    </s>
                  )}
                  <span className="text-sm text-muted-foreground">/ {p.validityDays} days</span>
                </p>
                {p.description && <p className="text-sm text-muted-foreground">{p.description}</p>}
                <p className="text-sm">
                  {p.kind === "pass"
                    ? "Every paid mock of every exam."
                    : `All paid mocks of ${p.examKeys.map((k) => examNames[k] ?? k).join(", ")}.`}
                </p>
                {owns(p) ? (
                  <Button variant="outline" className="h-11" disabled>
                    Unlocked
                  </Button>
                ) : signedIn ? (
                  <Button className="h-11" onClick={() => setBuying(p)}>
                    Buy now
                  </Button>
                ) : (
                  <Button asChild className="h-11">
                    <Link href={`/login?next=${encodeURIComponent(pathname)}`}>Sign in to buy</Link>
                  </Button>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
      {buying && (
        <CheckoutDialog
          plan={buying}
          onClose={(a) => {
            setBuying(null);
            if (a) onPurchased?.(a);
          }}
        />
      )}
    </>
  );
}
