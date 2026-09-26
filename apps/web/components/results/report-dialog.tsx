"use client";

import { errorMessage, useAuth } from "@mockprep/api-client";
import { REPORT_REASON_LABELS, reportReasonSchema, type ReportReason } from "@mockprep/types";
import { Button, Textarea } from "@mockprep/ui";
import { useState } from "react";

/** "Report an error" on a question (reports go to the admin Reports queue). */
export function ReportDialog({
  questionId,
  attemptId,
  onClose,
}: {
  questionId: string;
  attemptId: string | null;
  onClose: (sent: boolean) => void;
}) {
  const { api } = useAuth();
  const [reason, setReason] = useState<ReportReason>("wrong_answer");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send() {
    setBusy(true);
    setError(null);
    try {
      await api.request(`/api/questions/${questionId}/report`, {
        method: "POST",
        body: { reason, note, attemptId },
      });
      onClose(true);
    } catch (e) {
      setError(errorMessage(e));
      setBusy(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="report-title"
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center"
    >
      <div className="w-full max-w-md rounded-t-xl bg-background p-5 shadow-xl sm:rounded-xl">
        <h2 id="report-title" className="text-lg font-semibold">
          Report an error
        </h2>
        <fieldset className="mt-3 flex flex-col gap-1">
          <legend className="sr-only">What is wrong?</legend>
          {reportReasonSchema.options.map((r) => (
            <label
              key={r}
              className="flex min-h-11 items-center gap-3 rounded-md px-2 hover:bg-muted"
            >
              <input
                type="radio"
                name="reason"
                className="size-4"
                checked={reason === r}
                onChange={() => setReason(r)}
              />
              {REPORT_REASON_LABELS[r]}
            </label>
          ))}
        </fieldset>
        <Textarea
          className="mt-3"
          rows={3}
          maxLength={1000}
          placeholder="Details (optional), e.g. the correct answer"
          aria-label="Details"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
        {error && (
          <p role="alert" className="mt-2 text-sm text-destructive">
            {error}
          </p>
        )}
        <div className="mt-4 flex justify-end gap-3">
          <Button variant="outline" onClick={() => onClose(false)} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={() => void send()} disabled={busy}>
            {busy ? "Sending…" : "Send report"}
          </Button>
        </div>
      </div>
    </div>
  );
}
