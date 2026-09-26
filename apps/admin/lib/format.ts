import { OPTION_LETTERS } from "@mockprep/types";

/** One-line plain-text preview of Markdown/LaTeX (for tables and lists, not for students). */
export function snippet(markdown: string, max = 120): string {
  const text = markdown
    .replace(/\$\$?([^$]*)\$\$?/g, "$1")
    .replace(/[*_`#>|]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

export const letter = (index: number) => OPTION_LETTERS[index] ?? "?";

const IST_OFFSET_MS = 330 * 60_000;

/** UTC ISO → value for <input type="datetime-local">, shown in IST. */
export function toIstInput(iso: string | null): string {
  if (!iso) return "";
  return new Date(new Date(iso).getTime() + IST_OFFSET_MS).toISOString().slice(0, 16);
}

/** <input type="datetime-local"> value entered as IST → UTC ISO. */
export function fromIstInput(value: string): string | null {
  if (!value) return null;
  const date = new Date(`${value}:00+05:30`);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export const formatIst = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleString("en-IN", {
        timeZone: "Asia/Kolkata",
        dateStyle: "medium",
        timeStyle: "short",
      })
    : "–";

/** "SBI_PO_2023-prelims.pdf" → "SBI PO 2023 prelims" */
export const titleFromFilename = (name: string) =>
  name
    .replace(/\.[^.]+$/, "")
    .replace(/[_\-.]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 160);
