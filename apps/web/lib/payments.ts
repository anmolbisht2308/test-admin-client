import type { AccessResponse, Plan } from "@mockprep/types";

/** Paise → "₹499" / "₹1,299.50" (display only; never do money math on the result). */
export function formatRupees(paise: number): string {
  const rupees = paise / 100;
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: paise % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(rupees);
}

/** A date in IST, e.g. "26 Sept 2027". */
export const formatIstDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "numeric",
    month: "short",
    year: "numeric",
  });

/** Whether the student can open a test (the api enforces the same rule). */
export function isUnlocked(
  access: Pick<AccessResponse, "all" | "examKeys"> | null,
  test: { isFree: boolean; examKey: string },
): boolean {
  if (test.isFree) return true;
  if (!access) return false;
  return access.all || access.examKeys.includes(test.examKey);
}

/** Plans that unlock an exam (series for it first, then passes), or all plans. */
export function plansFor(plans: Plan[], examKey?: string | null): Plan[] {
  if (!examKey) return plans;
  const series = plans.filter((p) => p.kind === "series" && p.examKeys.includes(examKey));
  const passes = plans.filter((p) => p.kind === "pass");
  return [...series, ...passes];
}

/** Whole days left until `iso` (0 when past). */
export function daysLeft(iso: string, now = Date.now()): number {
  return Math.max(0, Math.ceil((new Date(iso).getTime() - now) / 86_400_000));
}

/** "Save 40%" when there is a struck-through MRP. */
export function savingsPercent(plan: Pick<Plan, "pricePaise" | "mrpPaise">): number | null {
  if (!plan.mrpPaise || plan.mrpPaise <= plan.pricePaise) return null;
  return Math.round(((plan.mrpPaise - plan.pricePaise) / plan.mrpPaise) * 100);
}
