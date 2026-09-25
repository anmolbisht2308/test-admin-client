import DOMPurify from "dompurify";
import katex from "katex";
import { Marked } from "marked";
import { describe, expect, it } from "vitest";
import { extractMath, renderQuestionHtml, type RenderLibs } from "../src/lib/render-question";

const libs: RenderLibs = { marked: new Marked(), katex, purify: DOMPurify };
const render = (source: string) => renderQuestionHtml(source, libs);

describe("extractMath", () => {
  it("extracts inline and display math", () => {
    const { text, math } = extractMath("Solve $x^2 = 4$ then $$\\int_0^1 x\\,dx$$");
    expect(text).toBe("Solve @@MATH0@@ then @@MATH1@@");
    expect(math).toEqual([
      { tex: "x^2 = 4", display: false },
      { tex: "\\int_0^1 x\\,dx", display: true },
    ]);
  });

  it("leaves currency and escaped dollars alone", () => {
    expect(extractMath("It costs $5 and $6 now").math).toHaveLength(0);
    expect(extractMath("Pay \\$10 today").math).toHaveLength(0);
  });

  it("does not let inline math span lines", () => {
    expect(extractMath("a $x\ny$ b").math).toHaveLength(0);
  });
});

describe("renderQuestionHtml", () => {
  it("renders KaTeX for inline and display math without Markdown mangling it", () => {
    const html = render("Find $a_1 * b_2$ where\n\n$$\\frac{1}{2}$$");
    expect(html).toContain('class="katex"');
    expect(html).toContain("katex-display");
    expect(html).not.toContain("<em>");
  });

  it("renders GFM tables and emphasis", () => {
    const html = render("**Bold**\n\n| Year | Sales |\n| --- | --- |\n| 2024 | 50 |");
    expect(html).toContain("<strong>Bold</strong>");
    expect(html).toContain("<table>");
    expect(html).toContain("<td>2024</td>");
  });

  it("keeps Hindi text intact", () => {
    expect(render("निम्नलिखित में से कौन सही है?")).toContain("निम्नलिखित में से कौन सही है?");
  });

  it("strips scripts, event handlers and javascript: URLs", () => {
    const html = render(
      '<script>alert(1)</script><img src="x.png" onerror="alert(2)">\n\n[link](javascript:alert(3))',
    );
    expect(html).not.toContain("<script");
    expect(html).not.toContain("onerror");
    expect(html).toContain("<a>link</a>");
    expect(html).not.toContain("javascript:");
    expect(html).toContain('<img src="x.png">');
  });

  it("cannot inject HTML through TeX", () => {
    const html = render("$\\text{<img src=x onerror=alert(1)>}$");
    expect(html).not.toContain("<img");
  });

  it("shows invalid TeX as an error instead of throwing", () => {
    expect(() => render("$\\frac{1}{$")).not.toThrow();
  });
});
