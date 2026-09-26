"use client";

import { useAuth } from "@mockprep/api-client";
import {
  examListResponseSchema,
  myAttemptListResponseSchema,
  type Exam,
  type MyAttemptListResponse,
} from "@mockprep/types";
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from "@mockprep/ui";
import dynamic from "next/dynamic";
import Link from "next/link";
import { formatMarks, scoreTrend } from "@/lib/results";
import { useEffect, useState } from "react";
import { useRequireStudent } from "@/lib/use-require-student";

const ScoreTrend = dynamic(() => import("@/components/home/score-trend"), { ssr: false });

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "numeric",
    month: "short",
  });

export function StudentHome() {
  const user = useRequireStudent();
  const { api } = useAuth();
  const [exams, setExams] = useState<Exam[]>([]);
  const [attempts, setAttempts] = useState<MyAttemptListResponse["attempts"] | null>(null);

  useEffect(() => {
    api
      .request("/api/exams", { auth: false, schema: examListResponseSchema })
      .then((res) => setExams(res.exams))
      .catch(() => setExams([]));
  }, [api]);

  useEffect(() => {
    if (!user) return;
    api
      .request("/api/attempts", { schema: myAttemptListResponseSchema })
      .then((res) => setAttempts(res.attempts))
      .catch(() => setAttempts([]));
  }, [api, user]);

  if (!user) return <p className="text-sm text-muted-foreground">Loading…</p>;
  const mine = exams.filter((e) => user.targetExamSlugs.includes(e.slug));

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">Hi {user.name?.split(" ")[0] ?? "there"} 👋</h1>
        <p className="text-muted-foreground">
          Pick a mock from your exams, or review your last result.
        </p>
      </section>

      {attempts && attempts.length > 0 && (
        <section className="flex flex-col gap-3" aria-labelledby="history">
          <div className="flex items-center justify-between">
            <h2 id="history" className="text-lg font-semibold">
              My tests
            </h2>
            <Link href="/revision" className="text-sm text-primary hover:underline">
              My revision list
            </Link>
          </div>
          {scoreTrend(attempts).length >= 2 && (
            <Card>
              <CardContent className="pt-4">
                <p className="mb-2 text-sm font-medium">Score trend</p>
                <ScoreTrend points={scoreTrend(attempts)} />
              </CardContent>
            </Card>
          )}
          <ul className="flex flex-col divide-y rounded-xl border">
            {attempts.slice(0, 20).map((a) => (
              <li key={a.id} className="flex items-center gap-3 p-3 text-sm">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{a.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatDate(a.startedAt)}
                    {a.practice ? " · practice" : ""}
                  </p>
                </div>
                {a.status === "in_progress" ? (
                  <Button asChild size="sm">
                    <Link href={`/test/${a.id}`}>Resume</Link>
                  </Button>
                ) : (
                  <Link
                    href={`/results/${a.id}`}
                    className="text-right tabular-nums hover:underline"
                  >
                    {a.score !== null
                      ? `${formatMarks(a.score)}/${formatMarks(a.maxScore ?? 0)}`
                      : "Scoring…"}
                  </Link>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="grid gap-3 sm:grid-cols-2">
        {mine.map((exam) => (
          <Card key={exam.slug}>
            <CardHeader>
              <CardTitle>{exam.shortName}</CardTitle>
              <CardDescription>{exam.name}</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <Button asChild variant="outline">
                <Link href={`/exams/${exam.slug}`}>Mock tests & pattern</Link>
              </Button>
            </CardContent>
          </Card>
        ))}
      </section>

      <div>
        <Button asChild variant="ghost">
          <Link href="/onboarding">Change my exams</Link>
        </Button>
      </div>
    </div>
  );
}
