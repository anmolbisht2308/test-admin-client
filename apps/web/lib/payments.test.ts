import type { Plan } from "@mockprep/types";
import { describe, expect, it } from "vitest";
import { daysLeft, formatRupees, isUnlocked, plansFor, savingsPercent } from "./payments";

const plan = (over: Partial<Plan>): Plan => ({
  id: "0".repeat(24),
  name: "P",
  description: "",
  kind: "series",
  examKeys: [],
  pricePaise: 49900,
  mrpPaise: null,
  validityDays: 365,
  active: true,
  sortOrder: 100,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  ...over,
});

describe("payments helpers", () => {
  it("formats paise as rupees in the Indian system", () => {
    expect(formatRupees(49900)).toBe("₹499");
    expect(formatRupees(12345678)).toBe("₹1,23,456.78");
  });

  it("unlocks free tests, exam entitlements and passes", () => {
    const paid = { isFree: false, examKey: "ssc-cgl" };
    expect(isUnlocked(null, { ...paid, isFree: true })).toBe(true);
    expect(isUnlocked(null, paid)).toBe(false);
    expect(isUnlocked({ all: false, examKeys: ["sbi-po"] }, paid)).toBe(false);
    expect(isUnlocked({ all: false, examKeys: ["ssc-cgl"] }, paid)).toBe(true);
    expect(isUnlocked({ all: true, examKeys: [] }, paid)).toBe(true);
  });

  it("lists the plans that unlock an exam", () => {
    const a = plan({ name: "SBI", examKeys: ["sbi-po"] });
    const b = plan({ name: "Pass", kind: "pass" });
    const c = plan({ name: "SSC", examKeys: ["ssc-cgl"] });
    expect(plansFor([b, c, a], "sbi-po").map((p) => p.name)).toEqual(["SBI", "Pass"]);
    expect(plansFor([b, c, a], null)).toHaveLength(3);
  });

  it("days left and savings", () => {
    const now = Date.parse("2026-01-01T00:00:00Z");
    expect(daysLeft("2026-01-11T00:00:00Z", now)).toBe(10);
    expect(daysLeft("2025-01-01T00:00:00Z", now)).toBe(0);
    expect(savingsPercent({ pricePaise: 60000, mrpPaise: 100000 })).toBe(40);
    expect(savingsPercent({ pricePaise: 60000, mrpPaise: null })).toBeNull();
  });
});
