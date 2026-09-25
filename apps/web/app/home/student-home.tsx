"use client";

import { useAuth } from "@mockprep/api-client";
import { examListResponseSchema, type Exam } from "@mockprep/types";
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from "@mockprep/ui";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRequireStudent } from "@/lib/use-require-student";

export function StudentHome() {
  const user = useRequireStudent();
  const { api } = useAuth();
  const [exams, setExams] = useState<Exam[]>([]);

  useEffect(() => {
    api
      .request("/api/exams", { auth: false, schema: examListResponseSchema })
      .then((res) => setExams(res.exams))
      .catch(() => setExams([]));
  }, [api]);

  if (!user) return <p className="text-sm text-muted-foreground">Loading…</p>;
  const mine = exams.filter((e) => user.targetExamSlugs.includes(e.slug));

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">Hi {user.name?.split(" ")[0] ?? "there"} 👋</h1>
        <p className="text-muted-foreground">Your exams are below. Mock tests are on their way.</p>
      </section>

      <section className="grid gap-3 sm:grid-cols-2">
        {mine.map((exam) => (
          <Card key={exam.slug}>
            <CardHeader>
              <CardTitle>{exam.shortName}</CardTitle>
              <CardDescription>{exam.name}</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {/* TODO(phase 3): published mocks for this exam. */}
              <p className="text-sm text-muted-foreground">No mocks published yet.</p>
              <Button asChild variant="outline">
                <Link href={`/exams/${exam.slug}`}>Exam pattern</Link>
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
