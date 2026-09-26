"use client";

import { useAuth } from "@mockprep/api-client";
import { myAttemptListResponseSchema, type MyAttemptListResponse } from "@mockprep/types";
import { Button } from "@mockprep/ui";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useAccess } from "@/lib/access-store";
import { isUnlocked } from "@/lib/payments";

const LockIcon = () => (
  <svg
    viewBox="0 0 24 24"
    className="size-4"
    aria-hidden
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
  >
    <rect x="5" y="11" width="14" height="10" rx="2" />
    <path d="M8 11V7a4 4 0 0 1 8 0v4" />
  </svg>
);

/** Start / Resume / last score for one test card (the exam page itself is cached for everyone). */
export function TestCardActions({
  testId,
  isFree,
  examKey,
}: {
  testId: string;
  isFree: boolean;
  examKey: string;
}) {
  const { api, state } = useAuth();
  const access = useAccess();
  const isStudent = state.status === "signed_in" && state.user.role === "student";
  // Unknown yet (session or access still loading): don't flash a lock.
  const pending = state.status === "loading" || (isStudent && access === null);
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
  // Paid and not covered by a plan: point to the plans for this exam (unlocks without refresh).
  const locked = !isUnlocked(access, { isFree, examKey }) && !open && !pending;
  if (locked) {
    return (
      <div className="flex flex-col gap-2">
        <Button asChild variant="outline">
          <Link href={`/pricing?exam=${encodeURIComponent(examKey)}`}>
            <LockIcon /> Unlock with a plan
          </Link>
        </Button>
        {last && (
          <Link
            href={`/results/${last.id}`}
            className="text-center text-sm text-primary hover:underline"
          >
            View last result
          </Link>
        )}
      </div>
    );
  }
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
