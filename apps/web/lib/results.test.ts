import type { SolutionItem } from "@mockprep/types";
import { describe, expect, it } from "vitest";
import { filterSolutions, heatColor, responseLabel, scoreTrend } from "./results";

const item = (outcome: SolutionItem["outcome"], state: SolutionItem["state"]) =>
  ({ outcome, state }) as SolutionItem;

describe("results helpers", () => {
  it("filters solutions", () => {
    const items = [
      item("correct", "answered"),
      item("wrong", "answered_marked"),
      item("partial", "answered"),
      item("skipped", "marked"),
      item("skipped", "not_visited"),
    ];
    expect(filterSolutions(items, "all")).toHaveLength(5);
    expect(filterSolutions(items, "wrong")).toEqual([items[1], items[2]]);
    expect(filterSolutions(items, "skipped")).toEqual([items[3], items[4]]);
    expect(filterSolutions(items, "marked")).toEqual([items[1], items[3]]);
  });

  it("colours accuracy and labels responses", () => {
    expect([heatColor(90), heatColor(60), heatColor(30), heatColor(0)]).toEqual([
      "#1f9d55",
      "#8bc34a",
      "#f2a93b",
      "#e05545",
    ]);
    expect([
      responseLabel([1, 3]),
      responseLabel("2.5"),
      responseLabel(null),
      responseLabel([]),
    ]).toEqual(["B, D", "2.5", "Not answered", "Not answered"]);
  });

  it("builds the score trend from finished, ranked attempts, oldest first", () => {
    const base = {
      testId: "t".repeat(24),
      status: "scored" as const,
      startedAt: "2026-01-01T00:00:00.000Z",
    };
    const trend = scoreTrend([
      {
        ...base,
        id: "b",
        title: "Mock 2",
        practice: false,
        submittedAt: "2026-02-01T00:00:00.000Z",
        score: 60,
        maxScore: 100,
      },
      {
        ...base,
        id: "p",
        title: "Practice",
        practice: true,
        submittedAt: "2026-02-02T00:00:00.000Z",
        score: 5,
        maxScore: 5,
      },
      {
        ...base,
        id: "a",
        title: "Mock 1",
        practice: false,
        submittedAt: "2026-01-01T00:00:00.000Z",
        score: 45.5,
        maxScore: 100,
      },
      {
        ...base,
        id: "c",
        title: "Running",
        practice: false,
        submittedAt: null,
        score: null,
        maxScore: null,
        status: "in_progress" as const,
      },
    ]);
    expect(trend.map((t) => [t.id, t.percent])).toEqual([
      ["a", 45.5],
      ["b", 60],
    ]);
  });
});
