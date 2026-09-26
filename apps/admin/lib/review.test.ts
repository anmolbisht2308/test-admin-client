import type { Question } from "@mockprep/types";
import { describe, expect, it } from "vitest";
import { titleFromFilename } from "./format";
import { toInput, toggleAnswer } from "./review";

const q: Question = {
  id: "64b0000000000000000000a1",
  rootId: "64b0000000000000000000a1",
  version: 1,
  isLatest: true,
  examFamily: "banking",
  hash: "x",
  flags: ["ai_answer"],
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  examKey: "sbi-po",
  section: "Reasoning Ability",
  number: 3,
  order: 2,
  type: "mcq_single",
  passage: "",
  passageHi: "",
  stem: "Odd one out?",
  options: ["A", "B", "C", "D", "E"],
  stemHi: "",
  optionsHi: [],
  correct: [1],
  numAnswer: null,
  answerSource: "ai",
  solution: "",
  solutionHi: "",
  subject: "",
  topic: "",
  taxonomyIds: [],
  difficulty: "medium",
  hasFigure: false,
  figureUrl: null,
  sourcePage: 1,
  confidence: 0.9,
  status: "draft",
  uploadId: null,
};

describe("review helpers", () => {
  it("setting an answer by key marks it as the admin's", () => {
    expect(toggleAnswer(q, 3)).toMatchObject({ correct: [3], answerSource: "manual" });
    expect(toggleAnswer(q, 1)).toMatchObject({ correct: [] });
    // Keys past the last option do nothing.
    expect(toggleAnswer(q, 5)).toBe(q);
  });

  it("toggles several answers on multi-correct questions", () => {
    const multi = { ...q, type: "mcq_multi" as const };
    expect(toggleAnswer(toggleAnswer(multi, 4), 0).correct).toEqual([0, 1, 4]);
  });

  it("ignores answer keys on numeric questions", () => {
    const numeric = { ...q, type: "integer" as const, options: [], correct: [] };
    expect(toggleAnswer(numeric, 0)).toBe(numeric);
  });

  it("builds the PUT body without server-only fields", () => {
    const input = toInput(q);
    expect(input).not.toHaveProperty("id");
    expect(input).not.toHaveProperty("flags");
    expect(input).toMatchObject({ stem: "Odd one out?", status: "draft" });
  });

  it("titles an upload from its file name", () => {
    expect(titleFromFilename("SBI_PO_2023-prelims.pdf")).toBe("SBI PO 2023 prelims");
  });
});
