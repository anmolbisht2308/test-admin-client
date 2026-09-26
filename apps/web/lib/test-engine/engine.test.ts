import type { AttemptStartResponse, StudentQuestion } from "@mockprep/types";
import { describe, expect, it } from "vitest";
import {
  applyClock,
  choose,
  clearResponse,
  clockFrom,
  goTo,
  initialState,
  markAndNext,
  markSynced,
  paletteCounts,
  remainingMs,
  saveAndNext,
  shownResponse,
  stateOf,
  submitSummary,
  typeNumeric,
  unsynced,
  type EngineState,
} from "./engine";

const q = (id: string, type: StudentQuestion["type"] = "mcq_single"): StudentQuestion => ({
  id: id.padStart(24, "0"),
  type,
  number: null,
  passage: "",
  passageHi: "",
  stem: `Q ${id}`,
  stemHi: "",
  options: type === "integer" || type === "numeric" ? [] : ["a", "b", "c", "d", "e"],
  optionsHi: [],
  hasFigure: false,
  figureUrl: null,
});
const ID = (n: string) => n.padStart(24, "0");

const T0 = 1_790_000_000_000;

function start(
  locked = false,
  answers: AttemptStartResponse["attempt"]["answers"] = [],
): AttemptStartResponse {
  return {
    attempt: {
      id: "a".repeat(24),
      testId: "b".repeat(24),
      status: "in_progress",
      startedAt: new Date(T0).toISOString(),
      serverNow: new Date(T0).toISOString(),
      deadline: new Date(T0 + 3_600_000).toISOString(),
      sectionIndex: 0,
      sectionDeadline: locked ? new Date(T0 + 1_200_000).toISOString() : null,
      answers,
    },
    paper: {
      testId: "b".repeat(24),
      title: "Mock",
      template: {
        skin: "ibps",
        totalTimeSec: 3600,
        optionCount: 5,
        sectionSwitching: locked ? "locked_sequential" : "free",
        marking: { correct: 1, wrong: -0.25 },
      },
      sections: [
        { name: "English", questions: [q("1"), q("2"), q("3", "mcq_multi")] },
        { name: "Maths", questions: [q("4"), q("5", "numeric")] },
      ],
    },
  };
}

const s0 = (locked = false): EngineState => initialState(start(locked), null, T0);

describe("CBT rules", () => {
  it("opens the first question as not answered; others are not visited", () => {
    const s = s0();
    expect(stateOf(s, ID("1"))).toBe("not_answered");
    expect(stateOf(s, ID("2"))).toBe("not_visited");
    expect(paletteCounts(s)).toMatchObject({ not_visited: 4, not_answered: 1 });
  });

  it("a choice is not saved until Save & Next", () => {
    let s = choose(s0(), 2);
    expect(shownResponse(s)).toEqual([2]);
    expect(s.answers[ID("1")]?.response).toBeNull();
    // Moving away (palette / swipe) drops the unsaved choice.
    s = goTo(s, { section: 0, index: 1 }, T0 + 1000);
    s = goTo(s, { section: 0, index: 0 }, T0 + 2000);
    expect(shownResponse(s)).toBeNull();
    s = saveAndNext(choose(s, 2), T0 + 3000);
    expect(s.answers[ID("1")]).toMatchObject({ response: [2], state: "answered", synced: false });
    expect(s.position).toEqual({ section: 0, index: 1 });
  });

  it("tracks time per question", () => {
    let s = saveAndNext(choose(s0(), 0), T0 + 10_000);
    s = goTo(s, { section: 0, index: 0 }, T0 + 15_000);
    s = goTo(s, { section: 0, index: 1 }, T0 + 20_000);
    expect(s.answers[ID("1")]?.timeMs).toBe(15_000);
    expect(s.answers[ID("2")]?.timeMs).toBe(5_000);
  });

  it("mark for review with and without an answer; clear response", () => {
    let s = markAndNext(s0(), T0 + 1);
    expect(stateOf(s, ID("1"))).toBe("marked");
    s = markAndNext(choose(s, 4), T0 + 2);
    expect(stateOf(s, ID("2"))).toBe("answered_marked");
    s = goTo(s, { section: 0, index: 1 }, T0 + 3);
    s = clearResponse(s, T0 + 4);
    expect(s.answers[ID("2")]).toMatchObject({ response: null, state: "not_answered" });
    expect(shownResponse(s)).toBeNull();
  });

  it("multi-correct toggles several options; numeric uses the keypad string", () => {
    let s = goTo(s0(), { section: 0, index: 2 }, T0);
    s = choose(choose(choose(s, 3), 0), 3);
    expect(shownResponse(s)).toEqual([0]);
    s = goTo(s, { section: 1, index: 1 }, T0);
    s = typeNumeric(s, "-2.");
    s = typeNumeric(s, "-2.5");
    s = typeNumeric(s, "abc");
    expect(shownResponse(s)).toBe("-2.5");
    s = saveAndNext(s, T0 + 5);
    expect(s.answers[ID("5")]).toMatchObject({ response: "-2.5", state: "answered" });
  });

  it("Save & Next moves across sections only when switching is free", () => {
    let free = goTo(s0(), { section: 0, index: 2 }, T0);
    free = saveAndNext(free, T0 + 1);
    expect(free.position).toEqual({ section: 1, index: 0 });

    let lockedS = s0(true);
    expect(goTo(lockedS, { section: 1, index: 0 }, T0).position).toEqual({ section: 0, index: 0 });
    lockedS = goTo(lockedS, { section: 0, index: 2 }, T0);
    lockedS = saveAndNext(lockedS, T0 + 1);
    expect(lockedS.position).toEqual({ section: 0, index: 2 });
  });

  it("follows the server when a locked section's timer ends", () => {
    const s = s0(true);
    const moved = applyClock(
      s,
      clockFrom(
        {
          status: "in_progress",
          serverNow: new Date(T0 + 1_200_001).toISOString(),
          deadline: new Date(T0 + 3_600_000).toISOString(),
          sectionIndex: 1,
          sectionDeadline: new Date(T0 + 2_400_000).toISOString(),
        },
        T0 + 1_200_001,
      ),
      T0 + 1_200_001,
    );
    expect(moved.position).toEqual({ section: 1, index: 0 });
    expect(goTo(moved, { section: 0, index: 1 }).position).toEqual({ section: 1, index: 0 });
  });
});

describe("sync and resume", () => {
  it("only unsynced answers are sent; a change during the request stays unsynced", () => {
    let s = saveAndNext(choose(s0(), 1), T0 + 1000);
    const sent = unsynced(s);
    expect(sent.map((e) => [e.questionId, e.response, e.state])).toEqual([
      [ID("1"), [1], "answered"],
      [ID("2"), null, "not_answered"],
    ]);
    // Q2 changes while the request is in flight.
    s = saveAndNext(choose(s, 3), T0 + 2000);
    s = markSynced(s, sent);
    expect(unsynced(s).map((e) => e.questionId)).toEqual([ID("2"), ID("3")]);
  });

  it("resume merges server and device answers: latest change wins", () => {
    const server = [
      {
        questionId: ID("1"),
        response: [0],
        state: "answered" as const,
        timeMs: 1000,
        at: T0 + 100,
      },
      {
        questionId: ID("2"),
        response: [1],
        state: "answered" as const,
        timeMs: 1000,
        at: T0 + 500,
      },
    ];
    const local = {
      answers: {
        [ID("1")]: {
          response: [4],
          state: "answered" as const,
          timeMs: 2000,
          at: T0 + 300,
          synced: false,
        },
        [ID("2")]: {
          response: [2],
          state: "answered" as const,
          timeMs: 2000,
          at: T0 + 200,
          synced: true,
        },
        [ID("4")]: {
          response: [3],
          state: "answered_marked" as const,
          timeMs: 10,
          at: T0 + 900,
          synced: false,
        },
      },
      position: { section: 1, index: 0 },
      instructionsAccepted: true,
    };
    const s = initialState(start(false, server), local, T0 + 1000);
    expect(s.answers[ID("1")]?.response).toEqual([4]);
    expect(s.answers[ID("2")]?.response).toEqual([1]);
    expect(s.answers[ID("4")]?.state).toBe("answered_marked");
    expect(s.position).toEqual({ section: 1, index: 0 });
    expect(
      unsynced(s)
        .map((e) => e.questionId)
        .sort(),
    ).toEqual([ID("1"), ID("4")]);
  });

  it("uses the server clock for the timer", () => {
    const clock = clockFrom(
      {
        status: "in_progress",
        serverNow: new Date(T0 + 60_000).toISOString(),
        deadline: new Date(T0 + 600_000).toISOString(),
        sectionIndex: 0,
        sectionDeadline: null,
      },
      T0, // this device's clock is a minute behind
    );
    expect(remainingMs(clock.deadline, clock, T0)).toBe(540_000);
    expect(remainingMs(clock.deadline, clock, T0 + 10_000_000)).toBe(0);
  });

  it("summarises sections for the submit dialog", () => {
    let s = saveAndNext(choose(s0(), 1), T0 + 1);
    s = markAndNext(s, T0 + 2);
    expect(submitSummary(s)[0]).toEqual({
      name: "English",
      total: 3,
      answered: 1,
      notAnswered: 1,
      marked: 1,
      notVisited: 0,
    });
  });
});
