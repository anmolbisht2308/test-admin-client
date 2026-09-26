"use client";

import { useAuth } from "@mockprep/api-client";
import { examListResponseSchema, planListResponseSchema, type Plan } from "@mockprep/types";
import { Alert, Button } from "@mockprep/ui";
import Link from "next/link";
import { useEffect, useState } from "react";
import { plansFor } from "@/lib/payments";
import { PlanGrid } from "./plan-grid";

/** Shown instead of the instructions when a paid test isn't covered by the student's plans. */
export function Paywall({ title, examKey }: { title: string; examKey: string }) {
  const { api } = useAuth();
  const [plans, setPlans] = useState<Plan[] | null>(null);
  const [names, setNames] = useState<Record<string, string>>({});

  useEffect(() => {
    api
      .request("/api/plans", { auth: false, schema: planListResponseSchema })
      .then((r) => setPlans(plansFor(r.plans, examKey)))
      .catch(() => setPlans([]));
    api
      .request("/api/exams", { auth: false, schema: examListResponseSchema })
      .then((r) => setNames(Object.fromEntries(r.exams.map((e) => [e.slug, e.shortName]))))
      .catch(() => undefined);
  }, [api, examKey]);

  return (
    <main className="mx-auto flex min-h-dvh max-w-3xl flex-col gap-4 p-4">
      <h1 className="text-xl font-semibold">{title}</h1>
      <Alert variant="info">
        This mock is part of a paid plan. Buy a plan below — it unlocks right here, no reload
        needed.
      </Alert>
      {plans === null ? (
        <p className="text-sm text-muted-foreground">Loading plans…</p>
      ) : (
        <PlanGrid plans={plans} examNames={names} highlightExam={examKey} />
      )}
      <Button asChild variant="ghost" className="self-start">
        <Link href={`/exams/${examKey}`}>Back to free mocks</Link>
      </Button>
    </main>
  );
}
