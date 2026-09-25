"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@mockprep/ui";
import { QuestionRenderer } from "@mockprep/ui/question-renderer";
import { useState } from "react";

const SAMPLE = `**Q.** If $x^2 - 5x + 6 = 0$, find the sum of the roots.

$$x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}$$

| Year | Sales (₹ lakh) |
| --- | --- |
| 2024 | 50 |
| 2025 | 65 |

निम्नलिखित में से कौन सा विकल्प सही है?

<script>alert("this is stripped")</script>`;

/** Demo of the shared QuestionRenderer: edit Markdown + LaTeX and see the student view. */
export function RendererDemo() {
  const [source, setSource] = useState(SAMPLE);
  return (
    <Card>
      <CardHeader>
        <CardTitle>QuestionRenderer demo</CardTitle>
        <CardDescription>
          Markdown + KaTeX ($...$ inline, $$...$$ display), sanitised with DOMPurify.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 md:grid-cols-2">
        <label className="flex flex-col gap-2 text-sm font-medium">
          Source
          <textarea
            value={source}
            onChange={(event) => setSource(event.target.value)}
            rows={16}
            spellCheck={false}
            className="rounded-md border border-input bg-transparent p-3 font-mono text-xs outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
          />
        </label>
        <div className="flex flex-col gap-2 text-sm font-medium">
          Student view
          <div className="rounded-md border bg-background p-4 font-normal">
            <QuestionRenderer content={source} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
