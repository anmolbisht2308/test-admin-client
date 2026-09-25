import type { DOMPurify } from "dompurify";
import type katexDefault from "katex";
import type { Marked } from "marked";

export interface RenderLibs {
  marked: Pick<Marked, "parse">;
  katex: Pick<typeof katexDefault, "renderToString">;
  purify: Pick<DOMPurify, "sanitize">;
}

interface MathSegment {
  tex: string;
  display: boolean;
}

const placeholder = (index: number) => `@@MATH${index}@@`;
const PLACEHOLDER_RE = /@@MATH(\d+)@@/g;

/**
 * Pull `$$...$$` (display) and `$...$` (inline) math out of the source before Markdown
 * parsing, so Markdown never mangles TeX (underscores, asterisks, backslashes).
 * - `\$` is a literal dollar sign.
 * - Inline math must not start or end with whitespace, so "costs $5 and $6" stays text.
 */
export function extractMath(source: string): { text: string; math: MathSegment[] } {
  const math: MathSegment[] = [];
  let text = "";
  let i = 0;
  while (i < source.length) {
    const ch = source[i];
    if (ch === "\\" && source[i + 1] === "$") {
      text += "\\$";
      i += 2;
      continue;
    }
    if (ch === "$") {
      const display = source[i + 1] === "$";
      const open = display ? 2 : 1;
      const close = findClosing(source, i + open, display);
      if (close !== -1) {
        const tex = source.slice(i + open, close);
        math.push({ tex: tex.trim(), display });
        text += placeholder(math.length - 1);
        i = close + open;
        continue;
      }
    }
    text += ch;
    i += 1;
  }
  return { text, math };
}

function findClosing(source: string, start: number, display: boolean): number {
  if (display) {
    for (let j = start; j < source.length - 1; j++) {
      if (source[j] === "\\") {
        j++;
        continue;
      }
      if (source[j] === "$" && source[j + 1] === "$") return j > start ? j : -1;
    }
    return -1;
  }
  if (/\s/.test(source[start] ?? " ")) return -1;
  for (let j = start; j < source.length; j++) {
    const c = source[j];
    if (c === "\n") return -1;
    if (c === "\\") {
      j++;
      continue;
    }
    if (c === "$") {
      if (j === start || /\s/.test(source[j - 1] ?? "")) return -1;
      return j;
    }
  }
  return -1;
}

/**
 * Markdown + LaTeX → sanitised HTML.
 * Order matters: Markdown output (user content) is sanitised first; KaTeX output is inserted
 * afterwards because KaTeX escapes its input and never emits user-controlled markup
 * (`trust: false`).
 */
export function renderQuestionHtml(source: string, libs: RenderLibs): string {
  const { text, math } = extractMath(source);
  const rawHtml = libs.marked.parse(text, { async: false, gfm: true, breaks: true });
  const safeHtml = libs.purify.sanitize(rawHtml, {
    USE_PROFILES: { html: true },
    FORBID_TAGS: ["style", "form", "input", "button", "textarea", "select"],
  });
  return safeHtml.replace(PLACEHOLDER_RE, (_match, index: string) => {
    const segment = math[Number(index)];
    if (!segment) return "";
    return libs.katex.renderToString(segment.tex, {
      displayMode: segment.display,
      throwOnError: false,
      trust: false,
      strict: "ignore",
      output: "htmlAndMathml",
    });
  });
}
