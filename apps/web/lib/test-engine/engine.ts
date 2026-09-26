import type {
  AnswerEntry,
  AttemptClock,
  AttemptResponse,
  AttemptStartResponse,
  QuestionState,
  StudentPaper,
  StudentQuestion,
} from "@mockprep/types";

/*
 * Test-screen rules as pure functions (the Zustand store in store.ts calls these).
 * Real CBT behaviour: choosing an option only changes the *pending* selection; it is saved by
 * "Save & Next" or "Mark for Review & Next". Moving away without saving discards it.
 */

export interface LocalAnswer {
  response: AttemptResponse;
  state: QuestionState;
  timeMs: number;
  /** Client clock of the last change: the server keeps the latest. */
  at: number;
  /** Sent to the server (and not changed since). */
  synced: boolean;
}

export interface Position {
  section: number;
  index: number;
}

export interface Clock {
  deadline: number;
  sectionIndex: number;
  sectionDeadline: number | null;
  /** serverNow − clientNow when the clock was received; add it to Date.now(). */
  skewMs: number;
  status: AttemptClock["status"];
}

export interface EngineState {
  attemptId: string;
  paper: StudentPaper;
  answers: Record<string, LocalAnswer>;
  position: Position;
  /** Unsaved selection for the current question. */
  pending: AttemptResponse | undefined;
  /** When the current question was opened (for time per question). */
  enteredAt: number;
  clock: Clock;
  language: "en" | "hi";
  instructionsAccepted: boolean;
}

export const locked = (s: Pick<EngineState, "paper">) =>
  s.paper.template.sectionSwitching === "locked_sequential";

export function questionAt(
  s: Pick<EngineState, "paper">,
  p: Position,
): StudentQuestion | undefined {
  return s.paper.sections[p.section]?.questions[p.index];
}

export const currentQuestion = (s: EngineState) => questionAt(s, s.position);

export function clockFrom(c: AttemptClock, receivedAt = Date.now()): Clock {
  return {
    deadline: new Date(c.deadline).getTime(),
    sectionIndex: c.sectionIndex,
    sectionDeadline: c.sectionDeadline ? new Date(c.sectionDeadline).getTime() : null,
    skewMs: new Date(c.serverNow).getTime() - receivedAt,
    status: c.status,
  };
}

/** Milliseconds left until `deadline` by the server's clock. */
export const remainingMs = (deadline: number, clock: Pick<Clock, "skewMs">, now = Date.now()) =>
  Math.max(0, deadline - (now + clock.skewMs));

export function stateOf(s: EngineState, questionId: string): QuestionState {
  return s.answers[questionId]?.state ?? "not_visited";
}

export const hasResponse = (r: AttemptResponse | undefined) =>
  r !== null && r !== undefined && (Array.isArray(r) ? r.length > 0 : r.trim() !== "");

/** The selection shown for the current question: the pending one, else the saved one. */
export function shownResponse(s: EngineState): AttemptResponse {
  const q = currentQuestion(s);
  if (s.pending !== undefined) return s.pending;
  return q ? (s.answers[q.id]?.response ?? null) : null;
}

/** Records time spent on the current question and returns its updated answer (or undefined). */
function withTime(s: EngineState, now: number): Record<string, LocalAnswer> {
  const q = currentQuestion(s);
  if (!q) return s.answers;
  const prev = s.answers[q.id];
  const spent = Math.max(0, now - s.enteredAt);
  const base: LocalAnswer = prev ?? {
    response: null,
    state: "not_answered",
    timeMs: 0,
    at: now,
    synced: false,
  };
  return { ...s.answers, [q.id]: { ...base, timeMs: base.timeMs + spent, at: now, synced: false } };
}

/** Opens a question: a not-visited question becomes "not answered" (red), as in real exams. */
function open(s: EngineState, p: Position, now: number): EngineState {
  const q = questionAt(s, p);
  if (!q) return s;
  const answers = { ...s.answers };
  if (!answers[q.id]) {
    answers[q.id] = { response: null, state: "not_answered", timeMs: 0, at: now, synced: false };
  }
  return { ...s, answers, position: p, pending: undefined, enteredAt: now };
}

export function canOpenSection(s: EngineState, section: number): boolean {
  if (section < 0 || section >= s.paper.sections.length) return false;
  return !locked(s) || section === s.clock.sectionIndex;
}

/** Goes to a question without saving the pending selection (palette click, Previous, swipe). */
export function goTo(s: EngineState, p: Position, now = Date.now()): EngineState {
  if (!canOpenSection(s, p.section) || !questionAt(s, p)) return s;
  if (p.section === s.position.section && p.index === s.position.index) return s;
  return open({ ...s, answers: withTime(s, now) }, p, now);
}

/** Next question; at the end of a section moves to the next one (when switching is free). */
export function nextPosition(s: EngineState, from = s.position): Position | null {
  const section = s.paper.sections[from.section];
  if (!section) return null;
  if (from.index + 1 < section.questions.length)
    return { section: from.section, index: from.index + 1 };
  if (locked(s)) return null;
  for (let i = from.section + 1; i < s.paper.sections.length; i++) {
    if ((s.paper.sections[i]?.questions.length ?? 0) > 0) return { section: i, index: 0 };
  }
  return null;
}

export function previousPosition(s: EngineState, from = s.position): Position | null {
  if (from.index > 0) return { section: from.section, index: from.index - 1 };
  if (locked(s)) return null;
  for (let i = from.section - 1; i >= 0; i--) {
    const count = s.paper.sections[i]?.questions.length ?? 0;
    if (count > 0) return { section: i, index: count - 1 };
  }
  return null;
}

/** Choosing an option / typing on the keypad: only the pending selection changes. */
export function choose(s: EngineState, optionIndex: number): EngineState {
  const q = currentQuestion(s);
  if (!q || optionIndex < 0 || optionIndex >= q.options.length) return s;
  const current = shownResponse(s);
  const chosen = Array.isArray(current) ? current : [];
  if (q.type === "mcq_multi") {
    const next = chosen.includes(optionIndex)
      ? chosen.filter((c) => c !== optionIndex)
      : [...chosen, optionIndex].sort((a, b) => a - b);
    return { ...s, pending: next };
  }
  return { ...s, pending: [optionIndex] };
}

export function typeNumeric(s: EngineState, value: string): EngineState {
  const q = currentQuestion(s);
  if (!q || (q.type !== "integer" && q.type !== "numeric")) return s;
  if (!/^-?\d*\.?\d*$/.test(value) || value.length > 20) return s;
  if (q.type === "integer" && value.includes(".")) return s;
  return { ...s, pending: value };
}

/** Save & Next / Mark for Review & Next. */
function saveWith(s: EngineState, mark: boolean, now: number): EngineState {
  const q = currentQuestion(s);
  if (!q) return s;
  const response = shownResponse(s);
  const answered = hasResponse(response);
  const state: QuestionState = mark
    ? answered
      ? "answered_marked"
      : "marked"
    : answered
      ? "answered"
      : "not_answered";
  const answers = withTime(s, now);
  const prev = answers[q.id] as LocalAnswer;
  answers[q.id] = { ...prev, response: answered ? response : null, state, at: now, synced: false };
  const saved: EngineState = { ...s, answers, pending: undefined, enteredAt: now };
  const next = nextPosition(saved);
  return next ? open(saved, next, now) : saved;
}

export const saveAndNext = (s: EngineState, now = Date.now()) => saveWith(s, false, now);
export const markAndNext = (s: EngineState, now = Date.now()) => saveWith(s, true, now);

/** Clear Response: removes the saved answer too (the question becomes "not answered"). */
export function clearResponse(s: EngineState, now = Date.now()): EngineState {
  const q = currentQuestion(s);
  if (!q) return s;
  const answers = withTime(s, now);
  const prev = answers[q.id] as LocalAnswer;
  answers[q.id] = { ...prev, response: null, state: "not_answered", at: now, synced: false };
  return { ...s, answers, pending: null, enteredAt: now };
}

export type PaletteCounts = Record<QuestionState, number>;

export function paletteCounts(s: EngineState, section?: number): PaletteCounts {
  const counts: PaletteCounts = {
    not_visited: 0,
    not_answered: 0,
    answered: 0,
    marked: 0,
    answered_marked: 0,
  };
  const sections = section === undefined ? s.paper.sections : [s.paper.sections[section]];
  for (const sec of sections) {
    for (const q of sec?.questions ?? []) counts[stateOf(s, q.id)] += 1;
  }
  return counts;
}

/** Answers changed since the last sync, as the api expects them. */
export function unsynced(s: Pick<EngineState, "answers">): AnswerEntry[] {
  return Object.entries(s.answers)
    .filter(([, a]) => !a.synced)
    .map(([questionId, a]) => ({
      questionId,
      response: a.response,
      state: a.state,
      timeMs: Math.round(a.timeMs),
      at: a.at,
    }));
}

/** After a successful sync: marks entries synced unless they changed while the request was out. */
export function markSynced(s: EngineState, sent: AnswerEntry[]): EngineState {
  const answers = { ...s.answers };
  for (const e of sent) {
    const a = answers[e.questionId];
    if (a && a.at === e.at) answers[e.questionId] = { ...a, synced: true };
  }
  return { ...s, answers };
}

/** New server clock (from any response): locked sections may have moved on. */
export function applyClock(s: EngineState, clock: Clock, now = Date.now()): EngineState {
  let next: EngineState = { ...s, clock };
  if (locked(s) && s.position.section !== clock.sectionIndex) {
    const section = s.paper.sections[clock.sectionIndex];
    if (section && section.questions.length > 0) {
      next = open(
        { ...next, answers: withTime(next, now) },
        { section: clock.sectionIndex, index: 0 },
        now,
      );
    }
  }
  return next;
}

/** First load / resume: server answers merged with the ones kept on this device (latest wins). */
export function initialState(
  start: AttemptStartResponse,
  local: Partial<
    Pick<EngineState, "answers" | "position" | "language" | "instructionsAccepted">
  > | null,
  now = Date.now(),
): EngineState {
  const answers: Record<string, LocalAnswer> = {};
  for (const a of start.attempt.answers) {
    answers[a.questionId] = {
      response: a.response,
      state: a.state,
      timeMs: a.timeMs,
      at: a.at,
      synced: true,
    };
  }
  for (const [id, a] of Object.entries(local?.answers ?? {})) {
    const server = answers[id];
    if (!server || a.at > server.at) answers[id] = a;
  }
  const clock = clockFrom(start.attempt, now);
  const base: EngineState = {
    attemptId: start.attempt.id,
    paper: start.paper,
    answers,
    position: { section: 0, index: 0 },
    pending: undefined,
    enteredAt: now,
    clock,
    language: local?.language ?? "en",
    instructionsAccepted: local?.instructionsAccepted ?? start.attempt.answers.length > 0,
  };
  // Resume on the same question (if its section is still open), else the open section's first.
  const wanted = local?.position;
  const position =
    wanted && questionAt(base, wanted) && canOpenSection(base, wanted.section)
      ? wanted
      : { section: locked(base) ? clock.sectionIndex : 0, index: 0 };
  return open(base, position, now);
}

/** What the submit summary shows, per section. */
export function submitSummary(s: EngineState) {
  return s.paper.sections.map((sec, i) => {
    const c = paletteCounts(s, i);
    return {
      name: sec.name,
      total: sec.questions.length,
      answered: c.answered + c.answered_marked,
      notAnswered: c.not_answered,
      marked: c.marked + c.answered_marked,
      notVisited: c.not_visited,
    };
  });
}

/** Marks for a question type (shown next to the question number). */
export const markingFor = (template: StudentPaper["template"], type: StudentQuestion["type"]) =>
  template.markingByType?.[type] ?? template.marking;
