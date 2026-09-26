import { planListResponseSchema } from "@mockprep/types";
import type { Metadata } from "next";
import { PlanGrid } from "@/components/payments/plan-grid";
import { getPublishedExams } from "@/lib/exams";
import { plansFor } from "@/lib/payments";
import { serverGet } from "@/lib/server-api";

export const metadata: Metadata = {
  title: "Pricing — test series and passes",
  description: "Full-length mock test series for banking, SSC, UPSC, defence and JEE exams.",
  alternates: { canonical: "/pricing" },
};

type Props = { searchParams: Promise<{ exam?: string }> };

export default async function PricingPage({ searchParams }: Props) {
  const { exam } = await searchParams;
  const [plans, exams] = await Promise.all([
    serverGet("/api/plans", planListResponseSchema)
      .then((r) => r?.plans ?? [])
      .catch(() => []),
    getPublishedExams(),
  ]);
  const examNames = Object.fromEntries((exams ?? []).map((e) => [e.slug, e.shortName]));
  const shown = plansFor(plans, exam);
  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
          {exam && examNames[exam] ? `Unlock ${examNames[exam]} mocks` : "Plans"}
        </h1>
        <p className="max-w-2xl text-muted-foreground">
          Free mocks stay free. A plan unlocks every paid mock of its exams, in the real exam
          interface, with rank, analysis and solutions. Prices include 18% GST.
        </p>
      </header>
      <PlanGrid plans={shown.length ? shown : plans} examNames={examNames} highlightExam={exam} />
      <p className="text-xs text-muted-foreground">
        Secure payments by Razorpay (UPI, cards, net banking, wallets). A GST invoice is emailed
        after every purchase.
      </p>
    </div>
  );
}
