"use client";

import { errorMessage, isApiError, useAuth } from "@mockprep/api-client";
import {
  LOCKED_REASON,
  accessResponseSchema,
  attemptStartResponseSchema,
  myAttemptListResponseSchema,
  publicTestDetailSchema,
  type PublicTestDetail,
} from "@mockprep/types";
import { Alert } from "@mockprep/ui";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Paywall } from "@/components/payments/paywall";
import { Instructions } from "@/components/test/instructions";
import { useAccess, useAccessStore } from "@/lib/access-store";
import { isUnlocked } from "@/lib/payments";
import { useRequireStudent } from "@/lib/use-require-student";

/** Instructions first; the attempt (and its clock) starts on "I am ready to begin". */
export default function StartTestPage() {
  const { testId } = useParams<{ testId: string }>();
  const user = useRequireStudent();
  const { api } = useAuth();
  const router = useRouter();
  const [test, setTest] = useState<PublicTestDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const access = useAccess();
  // The api refused (e.g. a plan expired since access was loaded).
  const [refused, setRefused] = useState(false);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      // Already in progress (another tab or device): resume it.
      const mine = await api.request(`/api/attempts?testId=${testId}`, {
        schema: myAttemptListResponseSchema,
      });
      const open = mine.attempts.find((a) => a.status === "in_progress");
      if (open) {
        router.replace(`/test/${open.id}`);
        return;
      }
      const detail = await api.request(`/api/tests/${testId}`, {
        auth: false,
        schema: publicTestDetailSchema,
      });
      if (!cancelled) setTest(detail);
    })().catch((e: unknown) => {
      if (!cancelled) setError(errorMessage(e));
    });
    return () => {
      cancelled = true;
    };
  }, [api, testId, user, router]);

  async function begin() {
    setBusy(true);
    setError(null);
    // Full screen like an exam hall terminal (needs this click; ignored where unsupported).
    document.documentElement.requestFullscreen?.().catch(() => undefined);
    try {
      const res = await api.request("/api/attempts", {
        method: "POST",
        body: { testId },
        schema: attemptStartResponseSchema,
      });
      router.replace(`/test/${res.attempt.id}`);
    } catch (e) {
      const details = isApiError(e) ? (e.details as { reason?: string } | undefined) : undefined;
      if (details?.reason === LOCKED_REASON) {
        setRefused(true);
        // Our copy of the student's access was stale: reload it (the paywall follows it).
        api
          .request("/api/me/access", { schema: accessResponseSchema })
          .then((a) => {
            useAccessStore.getState().set(a);
            setRefused(false);
          })
          .catch(() => undefined);
      } else setError(errorMessage(e));
      setBusy(false);
    }
  }

  if (error && !test) {
    return (
      <div className="mx-auto max-w-md p-6">
        <Alert>{error}</Alert>
      </div>
    );
  }
  if (!test || (!test.isFree && access === null))
    return (
      <div className="grid min-h-dvh place-items-center text-sm text-muted-foreground">
        Loading…
      </div>
    );
  if (refused || !isUnlocked(access, test)) {
    return <Paywall title={test.title} examKey={test.examKey} />;
  }
  return <Instructions test={test} busy={busy} error={error} onBegin={() => void begin()} />;
}
