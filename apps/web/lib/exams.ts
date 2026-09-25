import {
  EXAM_FAMILY_LABELS,
  examDetailResponseSchema,
  examFamilySchema,
  examListResponseSchema,
  publicTestListResponseSchema,
  type Exam,
  type ExamFamily,
} from "@mockprep/types";
import { serverGet } from "./server-api";

export const FAMILY_ORDER: ExamFamily[] = examFamilySchema.options;

export async function getPublishedExams(): Promise<Exam[] | null> {
  try {
    return (await serverGet("/api/exams", examListResponseSchema))?.exams ?? [];
  } catch {
    // Api unreachable (e.g. during a CI build): render a fallback and retry on revalidate.
    return null;
  }
}

export const getExamDetail = (slug: string) =>
  serverGet(`/api/exams/${encodeURIComponent(slug)}`, examDetailResponseSchema);

/** Published tests for an exam page. Empty on errors so the page still renders. */
export async function getExamTests(slug: string) {
  try {
    return (
      (
        await serverGet(
          `/api/exams/${encodeURIComponent(slug)}/tests`,
          publicTestListResponseSchema,
        )
      )?.tests ?? []
    );
  } catch {
    return [];
  }
}

export function groupByFamily(exams: Exam[]) {
  return FAMILY_ORDER.map((family) => ({
    family,
    label: EXAM_FAMILY_LABELS[family],
    exams: exams.filter((e) => e.family === family),
  })).filter((group) => group.exams.length > 0);
}

export const formatMinutes = (sec: number) => {
  const min = Math.round(sec / 60);
  return min >= 60 && min % 60 === 0 ? `${min / 60} h` : `${min} min`;
};

export const formatMarks = (n: number) => (n > 0 ? `+${n}` : n === 0 ? "0" : `${n}`);
