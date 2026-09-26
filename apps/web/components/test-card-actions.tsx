"use client";

import { useAuth } from "@mockprep/api-client";
import { myAttemptListResponseSchema, type MyAttemptListResponse } from "@mockprep/types";
import { Button } from "@mockprep/ui";
import Link from "next/link";
import { useEffect, useState } from "react";

/** Start / Resume / last score for one test card (the exam page itself is cached for everyone). */
export function TestCardActions({ testId }: { testId: string }) {
  const { api, state } = useAuth();
  const [mine, setMine] = useState<MyAttemptListResponse["attempts"]>([]);

  useEffect(() => {
    if (state.status !== "signed_in" || state.user.role !== "student") return;
    api
      .request(`/api/attempts?testId=${testId}`, { schema: myAttemptListResponseSchema })
      .then((res) => setMine(res.attempts))
      .catch(() => setMine([]));
  }, [api, state, testId]);

  const open = mine.find((a) => a.status === "in_progress");
  const last = mine.find((a) => a.status !== "in_progress");
  return (
    <div className="flex flex-col gap-2">
      {open ? (
        <Button asChild>
          <Link href={`/test/${open.id}`}>Resume test</Link>
        </Button>
      ) : (
        <Button asChild>
          <Link href={`/test/start/${testId}`}>{last ? "Take again" : "Start test"}</Link>
        </Button>
      )}
      {last && (
        <Link
          href={`/results/${last.id}`}
          className="text-center text-sm text-primary hover:underline"
        >
          {last.score !== null ? `Last score ${last.score}/${last.maxScore} · ` : ""}View result
        </Link>
      )}
    </div>
  );
}
