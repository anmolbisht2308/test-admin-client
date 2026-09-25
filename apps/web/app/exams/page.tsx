import { Card, CardDescription, CardHeader, CardTitle } from "@mockprep/ui";
import type { Metadata } from "next";
import Link from "next/link";
import { getPublishedExams, groupByFamily } from "@/lib/exams";

export const revalidate = 60;

export const metadata: Metadata = {
  title: "All exams",
  description:
    "Mock tests for Banking, SSC, UPSC, Defence and JEE exams, with the real exam pattern.",
  alternates: { canonical: "/exams" },
};

export default async function ExamsPage() {
  const exams = await getPublishedExams();
  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-2xl font-semibold">All exams</h1>
      {exams === null && (
        <p className="text-muted-foreground">
          The exam list is unavailable right now. Please try again shortly.
        </p>
      )}
      {exams !== null &&
        groupByFamily(exams).map((group) => (
          <section
            key={group.family}
            className="flex flex-col gap-3"
            aria-labelledby={`family-${group.family}`}
          >
            <h2 id={`family-${group.family}`} className="text-lg font-semibold">
              {group.label}
            </h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {group.exams.map((exam) => (
                <Link
                  key={exam.slug}
                  href={`/exams/${exam.slug}`}
                  className="rounded-xl focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
                >
                  <Card className="h-full transition-colors hover:bg-muted/50">
                    <CardHeader className="pb-5">
                      <CardTitle>{exam.shortName}</CardTitle>
                      <CardDescription>{exam.name}</CardDescription>
                    </CardHeader>
                  </Card>
                </Link>
              ))}
            </div>
          </section>
        ))}
    </div>
  );
}
