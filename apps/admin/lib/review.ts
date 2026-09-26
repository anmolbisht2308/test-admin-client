import { isNumericType, type Question, type QuestionInput } from "@mockprep/types";

/** The editable fields of a saved question (what PUT /questions/:id takes). */
export function toInput(q: Question): QuestionInput {
  const {
    id: _id,
    rootId: _rootId,
    version: _version,
    isLatest: _isLatest,
    examFamily: _examFamily,
    hash: _hash,
    flags: _flags,
    createdAt: _createdAt,
    updatedAt: _updatedAt,
    ...input
  } = q;
  return input;
}

/** Answer change from a key press (A–E / 1–5) or a click, for single and multi MCQs. */
export function toggleAnswer(q: Question, index: number): Question {
  if (isNumericType(q.type) || index >= q.options.length) return q;
  const correct =
    q.type === "mcq_multi"
      ? q.correct.includes(index)
        ? q.correct.filter((c) => c !== index)
        : [...q.correct, index].sort((a, b) => a - b)
      : q.correct[0] === index
        ? []
        : [index];
  return { ...q, correct, answerSource: "manual" };
}
