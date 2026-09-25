"use client";

import "katex/dist/katex.min.css";
import { useEffect, useState } from "react";
import { cn } from "./lib/cn";
import { renderQuestionHtml, type RenderLibs } from "./lib/render-question";

let libsPromise: Promise<RenderLibs> | undefined;

/** Lazy-load the renderer libraries once, so they stay out of the initial bundle. */
function loadLibs(): Promise<RenderLibs> {
  libsPromise ??= Promise.all([import("marked"), import("katex"), import("dompurify")]).then(
    ([markedModule, katexModule, purifyModule]) => ({
      marked: new markedModule.Marked(),
      katex: katexModule.default,
      purify: purifyModule.default,
    }),
  );
  return libsPromise;
}

export interface QuestionRendererProps {
  /** Markdown with LaTeX in $...$ (inline) or $$...$$ (display). */
  content: string;
  className?: string;
  /** Language of the content, e.g. "hi" for Hindi (helps fonts + screen readers). */
  lang?: string;
}

/**
 * The only way question content (stems, options, passages, solutions) is rendered.
 * Client-only: renders after mount, so server HTML and first client render always match.
 */
export function QuestionRenderer({ content, className, lang }: QuestionRendererProps) {
  const [html, setHtml] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadLibs()
      .then((libs) => {
        if (!cancelled) setHtml(renderQuestionHtml(content, libs));
      })
      .catch(() => {
        if (!cancelled) setHtml(null);
      });
    return () => {
      cancelled = true;
    };
  }, [content]);

  if (html === null) {
    return (
      <div
        className={cn("question-content animate-pulse text-muted-foreground", className)}
        lang={lang}
        aria-busy="true"
      >
        <div className="h-4 w-3/4 rounded bg-muted" />
      </div>
    );
  }

  return (
    <div
      className={cn("question-content", className)}
      lang={lang}
      // Sanitised by DOMPurify in renderQuestionHtml; KaTeX output is escaped by KaTeX.
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
