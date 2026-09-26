import type { MyAttemptListResponse, SolutionItem } from "@mockprep/types";

export type SolutionFilter = "all" | "wrong" | "skipped" | "marked";

/** Solutions reader filter. "wrong" includes partial credit; "marked" = marked for review. */
export function filterSolutions(items: SolutionItem[], filter: SolutionFilter): SolutionItem[] {
  switch (filter) {
    case "wrong":
      return items.filter((i) => i.outcome === "wrong" || i.outcome === "partial");
    case "skipped":
      return items.filter((i) => i.outcome === "skipped");
    case "marked":
      return items.filter((i) => i.state === "marked" || i.state === "answered_marked");
    default:
      return items;
  }
}

/** Heatmap cell colour for a topic accuracy (0–100): red → amber → green. */
export function heatColor(accuracy: number): string {
  if (accuracy >= 75) return "#1f9d55";
  if (accuracy >= 50) return "#8bc34a";
  if (accuracy >= 25) return "#f2a93b";
  return "#e05545";
}

/** Score % per finished (non-practice) attempt, oldest first, for the dashboard trend line. */
export function scoreTrend(attempts: MyAttemptListResponse["attempts"]) {
  return attempts
    .filter((a) => !a.practice && a.score !== null && a.maxScore)
    .map((a) => ({
      id: a.id,
      title: a.title,
      at: a.submittedAt ?? a.startedAt,
      percent: Math.round(((a.score ?? 0) / (a.maxScore || 1)) * 1000) / 10,
    }))
    .sort((x, y) => x.at.localeCompare(y.at));
}

/** "You chose B · Correct: D" style labels. */
export function responseLabel(response: SolutionItem["yourResponse"]): string {
  if (response === null) return "Not answered";
  if (typeof response === "string") return response.trim() === "" ? "Not answered" : response;
  return response.length ? response.map((i) => "ABCDEF"[i] ?? "?").join(", ") : "Not answered";
}

export const formatMarks = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(2));
export const formatDuration = (sec: number) => {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  return h ? `${h} h ${m} min` : `${m} min ${Math.round(sec % 60)} s`;
};
