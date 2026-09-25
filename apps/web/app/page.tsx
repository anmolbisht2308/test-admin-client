import { Button } from "@mockprep/ui";
import Link from "next/link";
import { getPublishedExams, groupByFamily } from "@/lib/exams";

export const revalidate = 60;

export default async function HomePage() {
  const exams = await getPublishedExams();
  return (
    <div className="flex flex-col gap-10">
      <section className="flex flex-col gap-4">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
          Practise in the real exam interface.
        </h1>
        <p className="max-w-2xl text-muted-foreground">
          Full-length mocks with the real timers, sections and marking scheme. Get your score,
          All-India rank, percentile and a full solution for every question.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button asChild size="lg">
            <Link href="/login">Start free</Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link href="/exams">Browse exams</Link>
          </Button>
        </div>
      </section>
      {exams && exams.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold">Exams we cover</h2>
          <ul className="flex flex-wrap gap-2">
            {groupByFamily(exams).flatMap((group) =>
              group.exams.map((exam) => (
                <li key={exam.slug}>
                  <Link
                    href={`/exams/${exam.slug}`}
                    className="inline-flex h-11 items-center rounded-full border px-4 text-sm hover:bg-muted"
                  >
                    {exam.shortName}
                  </Link>
                </li>
              )),
            )}
          </ul>
        </section>
      )}
    </div>
  );
}
