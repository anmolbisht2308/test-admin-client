"use client";

import { cn } from "@mockprep/ui";
import { useEffect, useRef } from "react";
import { remainingMs } from "@/lib/test-engine/engine";
import { useTestStore } from "@/lib/test-engine/store";
import { formatClock, useNow } from "./use-now";

/**
 * Time left by the server's clock: amber under 5 minutes, red under 1. Locked sections show the
 * section's time. Calls `onSectionEnd` / `onTimeUp` once when they reach zero.
 */
export function Timer({
  onSectionEnd,
  onTimeUp,
}: {
  onSectionEnd: () => void;
  onTimeUp: () => void;
}) {
  const clock = useTestStore((st) => st.s?.clock);
  const now = useNow(1000);
  const fired = useRef({ section: -1, total: false });

  const total = clock ? remainingMs(clock.deadline, clock, now) : 0;
  const section =
    clock?.sectionDeadline !== null && clock?.sectionDeadline !== undefined
      ? remainingMs(clock.sectionDeadline, clock, now)
      : null;
  const shown = section ?? total;

  useEffect(() => {
    if (!clock) return;
    if (total <= 0 && !fired.current.total) {
      fired.current.total = true;
      onTimeUp();
    } else if (section !== null && section <= 0 && fired.current.section !== clock.sectionIndex) {
      fired.current.section = clock.sectionIndex;
      onSectionEnd();
    }
  }, [clock, total, section, onSectionEnd, onTimeUp]);

  return (
    <div
      role="timer"
      aria-live="off"
      className={cn(
        "flex items-center gap-2 rounded-md px-2 py-1 font-mono text-base font-semibold tabular-nums",
        shown <= 60_000
          ? "bg-red-600 text-white"
          : shown <= 300_000
            ? "bg-amber-400 text-black"
            : "bg-white/15",
      )}
    >
      <span className="text-xs font-sans font-normal opacity-80">
        {section !== null ? "Section" : "Time left"}
      </span>
      {formatClock(shown)}
    </div>
  );
}
