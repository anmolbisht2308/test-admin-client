"use client";

import { errorMessage, useAuth } from "@mockprep/api-client";
import {
  attemptStartResponseSchema,
  myAttemptListResponseSchema,
  publicTestDetailSchema,
  type PublicTestDetail,
} from "@mockprep/types";
import { Alert } from "@mockprep/ui";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Instructions } from "@/components/test/instructions";
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
      setError(errorMessage(e));
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
  if (!test)
    return (
      <div className="grid min-h-dvh place-items-center text-sm text-muted-foreground">
        Loading…
      </div>
    );
  return <Instructions test={test} busy={busy} error={error} onBegin={() => void begin()} />;
}
