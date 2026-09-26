"use client";

import { errorMessage, useAuth } from "@mockprep/api-client";
import { attemptStartResponseSchema } from "@mockprep/types";
import { Alert, Button } from "@mockprep/ui";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { ExamScreen } from "@/components/test/exam-screen";
import { useTestStore } from "@/lib/test-engine/store";
import { useRequireStudent } from "@/lib/use-require-student";

/** Loads (or resumes) an attempt: server state merged with what this device kept. */
export default function TestPage() {
  const { attemptId } = useParams<{ attemptId: string }>();
  const user = useRequireStudent();
  const { api } = useAuth();
  const router = useRouter();
  const ready = useTestStore((st) => st.s?.attemptId === attemptId);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const start = await api.request(`/api/attempts/${attemptId}`, {
        schema: attemptStartResponseSchema,
      });
      if (start.attempt.status !== "in_progress") {
        router.replace(`/results/${attemptId}`);
        return;
      }
      await useTestStore.getState().load(start);
    } catch (e) {
      setError(errorMessage(e));
    }
  }, [api, attemptId, router]);

  useEffect(() => {
    if (user) void load();
  }, [user, load]);

  if (error) {
    return (
      <div className="mx-auto flex max-w-md flex-col gap-3 p-6">
        <Alert>{error}</Alert>
        <p className="text-sm text-muted-foreground">Your answers are kept on this device.</p>
        <Button onClick={() => void load()}>Try again</Button>
      </div>
    );
  }
  if (!ready)
    return (
      <div className="grid min-h-dvh place-items-center text-sm text-muted-foreground">
        Loading test…
      </div>
    );
  return <ExamScreen />;
}
