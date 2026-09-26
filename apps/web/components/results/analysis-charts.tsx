"use client";

import type { AttemptAnalysis } from "@mockprep/types";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from "recharts";
import { heatColor } from "@/lib/results";

const COLORS = {
  you: "#2b6cb0",
  topper: "#1f9d55",
  average: "#9aa4b2",
  correct: "#1f9d55",
  wrong: "#e05545",
  skipped: "#9aa4b2",
};
const axis = { fontSize: 12, fill: "currentColor" };

function Panel({
  title,
  children,
  note,
}: {
  title: string;
  children: React.ReactNode;
  note?: string;
}) {
  return (
    <section className="rounded-xl border p-4">
      <h2 className="mb-1 text-base font-semibold">{title}</h2>
      {note && <p className="mb-3 text-xs text-muted-foreground">{note}</p>}
      {children}
    </section>
  );
}

/** Score per section next to the section's maximum. */
export function SectionBars({ a }: { a: AttemptAnalysis }) {
  const data = a.sections.map((s) => ({
    name: s.name,
    "Your score": s.score,
    "Max marks": s.maxScore,
  }));
  return (
    <Panel
      title="Sections"
      note="Your score in each section next to its maximum (cut-offs are in the table below)."
    >
      <ResponsiveContainer width="100%" height={240}>
        <BarChart data={data} margin={{ left: -8, right: 8 }}>
          <CartesianGrid vertical={false} strokeOpacity={0.2} />
          <XAxis dataKey="name" tick={axis} interval={0} />
          <YAxis tick={axis} />
          <Tooltip />
          <Legend />
          <Bar dataKey="Your score" fill={COLORS.you} />
          <Bar dataKey="Max marks" fill={COLORS.average} fillOpacity={0.5} />
        </BarChart>
      </ResponsiveContainer>
    </Panel>
  );
}

/** Topic accuracy as a coloured grid, grouped by section. */
export function TopicHeatmap({ a }: { a: AttemptAnalysis }) {
  const sections = [...new Set(a.topics.map((t) => t.section))];
  return (
    <Panel
      title="Topics"
      note="Accuracy per topic (correct / questions). Red needs work, green is strong."
    >
      <div className="flex flex-col gap-4">
        {sections.map((section) => (
          <div key={section}>
            <p className="mb-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
              {section}
            </p>
            <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {a.topics
                .filter((t) => t.section === section)
                .map((t) => (
                  <li
                    key={t.topic}
                    className="rounded-md p-2 text-sm text-white"
                    style={{ background: heatColor(t.accuracy) }}
                    title={`${t.correct} correct, ${t.wrong} wrong, ${t.skipped} skipped`}
                  >
                    <span className="block truncate font-medium">{t.topic}</span>
                    <span className="text-xs opacity-90">
                      {t.correct}/{t.total} · {Math.round(t.accuracy)}%
                    </span>
                  </li>
                ))}
            </ul>
          </div>
        ))}
      </div>
    </Panel>
  );
}

/** Time spent on each question, coloured by outcome. */
export function TimeScatter({ a }: { a: AttemptAnalysis }) {
  const points = a.questions.map((q, i) => ({
    x: i + 1,
    y: Math.round(q.timeMs / 1000),
    outcome: q.outcome,
    label: `${q.section} Q${q.number}`,
  }));
  const series = (["correct", "wrong", "skipped"] as const).map((outcome) => ({
    outcome,
    data: points.filter((p) =>
      outcome === "wrong"
        ? p.outcome === "wrong" || p.outcome === "partial"
        : p.outcome === outcome,
    ),
  }));
  return (
    <Panel
      title="Time vs accuracy"
      note="Seconds spent on each question: green correct, red wrong, grey skipped."
    >
      <ResponsiveContainer width="100%" height={240}>
        <ScatterChart margin={{ left: -8, right: 8 }}>
          <CartesianGrid strokeOpacity={0.2} />
          <XAxis type="number" dataKey="x" name="Question" tick={axis} allowDecimals={false} />
          <YAxis type="number" dataKey="y" name="Seconds" unit="s" tick={axis} />
          <ZAxis range={[40, 40]} />
          <Tooltip
            cursor={{ strokeDasharray: "3 3" }}
            formatter={(value, name) => [value, name === "y" ? "Seconds" : "Question"]}
          />
          <Legend />
          {series.map((s) => (
            <Scatter
              key={s.outcome}
              name={s.outcome[0]?.toUpperCase() + s.outcome.slice(1)}
              data={s.data}
              fill={COLORS[s.outcome]}
            />
          ))}
        </ScatterChart>
      </ResponsiveContainer>
    </Panel>
  );
}

/** You vs the topper vs the average, per section. */
export function Comparison({ a }: { a: AttemptAnalysis }) {
  if (!a.topper || !a.average) return null;
  const topper = a.topper;
  const average = a.average;
  const data = a.sections.map((s) => ({
    name: s.name,
    You: s.score,
    Topper: topper.sections.find((x) => x.name === s.name)?.score ?? 0,
    Average: average.sections.find((x) => x.name === s.name)?.score ?? 0,
  }));
  return (
    <Panel
      title="You vs topper vs average"
      note={`Total: you ${a.you.score}, topper ${topper.score}, average ${average.score}.`}
    >
      <ResponsiveContainer width="100%" height={240}>
        <BarChart data={data} margin={{ left: -8, right: 8 }}>
          <CartesianGrid vertical={false} strokeOpacity={0.2} />
          <XAxis dataKey="name" tick={axis} interval={0} />
          <YAxis tick={axis} />
          <Tooltip />
          <Legend />
          <Bar dataKey="You" fill={COLORS.you} />
          <Bar dataKey="Topper" fill={COLORS.topper} />
          <Bar dataKey="Average" fill={COLORS.average} />
        </BarChart>
      </ResponsiveContainer>
    </Panel>
  );
}

export default function AnalysisCharts({ a }: { a: AttemptAnalysis }) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <SectionBars a={a} />
      <Comparison a={a} />
      <TopicHeatmap a={a} />
      <TimeScatter a={a} />
    </div>
  );
}
