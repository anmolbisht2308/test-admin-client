import { Button, Card, CardContent, CardHeader, CardTitle } from "@mockprep/ui";
import Link from "next/link";

// TODO(phase 2): replace with the exam catalogue from the api.
const families = [
  { name: "Banking", exams: "SBI PO & Clerk · IBPS PO & Clerk" },
  { name: "SSC", exams: "CGL · CHSL" },
  { name: "UPSC Prelims", exams: "GS Paper I · CSAT" },
  { name: "Defence", exams: "NDA · CDS" },
  { name: "JEE", exams: "JEE Main · JEE Advanced" },
];

export default function HomePage() {
  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-3">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
          Practise in the real exam interface.
        </h1>
        <p className="max-w-2xl text-muted-foreground">
          Full-length mocks with the real timers, sections and marking scheme. Get your score,
          All-India rank, percentile and a full solution for every question.
        </p>
        <div>
          <Button asChild variant="outline">
            <Link href="/status">System status</Link>
          </Button>
        </div>
      </section>
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {families.map((family) => (
          <Card key={family.name}>
            <CardHeader>
              <CardTitle>{family.name}</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">{family.exams}</CardContent>
          </Card>
        ))}
      </section>
    </div>
  );
}
