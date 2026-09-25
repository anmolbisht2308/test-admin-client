import {
  EXAM_FAMILY_LABELS,
  templateMaxMarks,
  templateQuestionCount,
  type ExamTemplate,
} from "@mockprep/types";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  TBody,
  TD,
  TH,
  THead,
  TR,
  Table,
} from "@mockprep/ui";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";
import { formatMarks, formatMinutes, getExamDetail } from "@/lib/exams";

export const revalidate = 60;

// No pages at build time: each exam page is rendered on first visit, then cached and
// refreshed every 60 s, so exams created in the admin appear without a deploy.
export function generateStaticParams(): { slug: string }[] {
  return [];
}

type Props = { params: Promise<{ slug: string }> };

// Deduplicates the fetch between generateMetadata and the page.
const load = cache((slug: string) => getExamDetail(slug));

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const detail = await load((await params).slug);
  if (!detail) return { title: "Exam not found" };
  const { exam, templates } = detail;
  const pattern = templates
    .map(
      (t) => `${t.name}: ${templateQuestionCount(t)} questions, ${formatMinutes(t.totalTimeSec)}`,
    )
    .join("; ");
  const description = `${exam.name} mock tests in the real exam interface. Pattern: ${pattern}.`;
  return {
    title: `${exam.shortName} mock test & exam pattern`,
    description,
    alternates: { canonical: `/exams/${exam.slug}` },
    openGraph: { title: `${exam.shortName} mock tests`, description, type: "website" },
  };
}

function PatternTable({ template }: { template: ExamTemplate }) {
  const questions = templateQuestionCount(template);
  const hasSectionTimes = template.sections.some((s) => s.timeSec !== undefined);
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{template.name}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 px-3 sm:px-5">
        <Table className="[&_td]:px-2 [&_th]:px-2">
          <THead>
            <TR>
              <TH>Section</TH>
              <TH className="text-right">Qs</TH>
              <TH className="text-right">Marks</TH>
              {hasSectionTimes && <TH className="text-right">Time</TH>}
            </TR>
          </THead>
          <TBody>
            {template.sections.map((s) => (
              <TR key={s.name}>
                <TD>{s.name}</TD>
                <TD className="text-right tabular-nums">{s.count}</TD>
                <TD className="text-right tabular-nums">{s.count * template.marking.correct}</TD>
                {hasSectionTimes && (
                  <TD className="text-right whitespace-nowrap tabular-nums">
                    {s.timeSec ? formatMinutes(s.timeSec) : "–"}
                  </TD>
                )}
              </TR>
            ))}
            <TR className="font-medium">
              <TD>Total</TD>
              <TD className="text-right tabular-nums">{questions}</TD>
              <TD className="text-right tabular-nums">{templateMaxMarks(template)}</TD>
              {hasSectionTimes && (
                <TD className="text-right whitespace-nowrap tabular-nums">
                  {formatMinutes(template.totalTimeSec)}
                </TD>
              )}
            </TR>
          </TBody>
        </Table>
        <ul className="flex flex-wrap gap-2 text-sm">
          <li>
            <Badge variant="secondary">{formatMinutes(template.totalTimeSec)}</Badge>
          </li>
          <li>
            <Badge variant="secondary">{template.optionCount} options per question</Badge>
          </li>
          <li>
            <Badge variant="secondary">
              {formatMarks(template.marking.correct)} correct /{" "}
              {formatMarks(template.marking.wrong)} wrong
            </Badge>
          </li>
          <li>
            <Badge variant="secondary">
              {template.sectionSwitching === "locked_sequential"
                ? "Sections timed separately, in order"
                : "Switch sections freely"}
            </Badge>
          </li>
          {template.qualifyingPercent !== undefined && (
            <li>
              <Badge variant="outline">Qualifying: {template.qualifyingPercent}% needed</Badge>
            </li>
          )}
        </ul>
      </CardContent>
    </Card>
  );
}

export default async function ExamPage({ params }: Props) {
  const detail = await load((await params).slug);
  if (!detail) notFound();
  const { exam, templates } = detail;
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Exams", item: `${site}/exams` },
          {
            "@type": "ListItem",
            position: 2,
            name: exam.shortName,
            item: `${site}/exams/${exam.slug}`,
          },
        ],
      },
      {
        "@type": "Course",
        name: `${exam.shortName} mock tests`,
        description: exam.description || `${exam.name} full-length mock tests.`,
        provider: { "@type": "Organization", name: "mockprep", sameAs: site },
        educationalLevel: EXAM_FAMILY_LABELS[exam.family],
        hasCourseInstance: templates.map((t) => ({
          "@type": "CourseInstance",
          name: t.name,
          courseMode: "online",
          courseWorkload: `PT${Math.round(t.totalTimeSec / 60)}M`,
        })),
      },
    ],
  };

  return (
    <article className="flex flex-col gap-6">
      <script
        type="application/ld+json"
        // Escape "<" so exam text can never close the script tag.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
      />
      <nav aria-label="Breadcrumb" className="text-sm text-muted-foreground">
        <Link href="/exams" className="hover:underline">
          Exams
        </Link>{" "}
        / {exam.shortName}
      </nav>
      <header className="flex flex-col gap-2">
        <Badge variant="outline">{EXAM_FAMILY_LABELS[exam.family]}</Badge>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{exam.name}</h1>
        {exam.description && <p className="max-w-2xl text-muted-foreground">{exam.description}</p>}
      </header>
      <section className="flex flex-col gap-3" aria-labelledby="pattern">
        <h2 id="pattern" className="text-lg font-semibold">
          Exam pattern
        </h2>
        {templates.map((t) => (
          <PatternTable key={t.key} template={t} />
        ))}
        <p className="text-xs text-muted-foreground">
          Always check the latest official notification for the current pattern.
        </p>
      </section>
      <section className="flex flex-col gap-3" aria-labelledby="mocks">
        <h2 id="mocks" className="text-lg font-semibold">
          Mock tests
        </h2>
        {/* TODO(phase 3): published test cards. */}
        <p className="text-sm text-muted-foreground">Mocks for {exam.shortName} are coming soon.</p>
        <div>
          <Button asChild>
            <Link href="/login">Sign up free to get notified</Link>
          </Button>
        </div>
      </section>
    </article>
  );
}
