"use client";

import { Button } from "@mockprep/ui";
import { submitSummary, type EngineState } from "@/lib/test-engine/engine";

export function SubmitDialog({
  s,
  busy,
  error,
  onCancel,
  onConfirm,
}: {
  s: EngineState;
  busy: boolean;
  error: string | null;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const rows = submitSummary(s);
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="submit-title"
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center"
    >
      <div className="max-h-[90dvh] w-full max-w-2xl overflow-y-auto rounded-t-xl bg-background p-4 shadow-xl sm:rounded-xl sm:p-6">
        <h2 id="submit-title" className="text-lg font-semibold">
          Submit the test?
        </h2>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[480px] text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="py-2 pr-2 font-medium">Section</th>
                <th className="px-2 text-right font-medium">Questions</th>
                <th className="px-2 text-right font-medium">Answered</th>
                <th className="px-2 text-right font-medium">Not answered</th>
                <th className="px-2 text-right font-medium">Marked</th>
                <th className="pl-2 text-right font-medium">Not visited</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.name} className="border-b tabular-nums">
                  <td className="py-2 pr-2">{r.name}</td>
                  <td className="px-2 text-right">{r.total}</td>
                  <td className="px-2 text-right">{r.answered}</td>
                  <td className="px-2 text-right">{r.notAnswered}</td>
                  <td className="px-2 text-right">{r.marked}</td>
                  <td className="pl-2 text-right">{r.notVisited}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-4 text-sm text-muted-foreground">
          Answers marked for review count only if you selected an option. You can&apos;t change
          answers after submitting.
        </p>
        {error && (
          <p role="alert" className="mt-3 text-sm text-destructive">
            {error}
          </p>
        )}
        <div className="mt-5 flex justify-end gap-3">
          <Button variant="outline" onClick={onCancel} disabled={busy}>
            Back to test
          </Button>
          <Button
            onClick={onConfirm}
            disabled={busy}
            className="bg-[var(--tx-primary)] text-white hover:bg-[var(--tx-primary)]/90"
          >
            {busy ? "Submitting…" : "Yes, submit"}
          </Button>
        </div>
      </div>
    </div>
  );
}
