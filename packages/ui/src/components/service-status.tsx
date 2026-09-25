"use client";

import { healthResponseSchema, type HealthResponse } from "@mockprep/types";
import { useCallback, useEffect, useState } from "react";
import { Badge } from "./badge";
import { Button } from "./button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./card";

type Check =
  | { state: "loading" }
  | { state: "reachable"; health: HealthResponse; checkedAt: Date }
  | { state: "unreachable"; message: string; checkedAt: Date };

export async function fetchHealth(
  healthUrl: string,
  signal?: AbortSignal,
): Promise<HealthResponse> {
  const res = await fetch(healthUrl, { cache: "no-store", signal });
  // 503 still carries a valid health body (status: degraded).
  return healthResponseSchema.parse(await res.json());
}

function Chip({ label, up }: { label: string; up: boolean | undefined }) {
  const text = up === undefined ? "checking" : up ? "up" : "down";
  return (
    <Badge
      variant={up === undefined ? "secondary" : up ? "success" : "destructive"}
      className="px-3 py-1 text-sm"
    >
      <span aria-hidden className="size-2 rounded-full bg-current opacity-80" />
      {label}: {text}
    </Badge>
  );
}

export interface ServiceStatusProps {
  /** Default "/api/health" (same origin, proxied to the api by the Next rewrite). */
  healthUrl?: string;
  /** Re-check interval in ms (0 disables). */
  intervalMs?: number;
}

/** Shows API / DB / Redis as green or red chips, from GET /health. */
export function ServiceStatus({
  healthUrl = "/api/health",
  intervalMs = 15_000,
}: ServiceStatusProps) {
  const [check, setCheck] = useState<Check>({ state: "loading" });

  const run = useCallback(
    async (signal?: AbortSignal) => {
      try {
        const health = await fetchHealth(healthUrl, signal);
        setCheck({ state: "reachable", health, checkedAt: new Date() });
      } catch (error) {
        if (signal?.aborted) return;
        const message = error instanceof Error ? error.message : "Request failed";
        setCheck({ state: "unreachable", message, checkedAt: new Date() });
      }
    },
    [healthUrl],
  );

  useEffect(() => {
    const controller = new AbortController();
    void run(controller.signal);
    const id = intervalMs > 0 ? setInterval(() => void run(controller.signal), intervalMs) : null;
    return () => {
      controller.abort();
      if (id) clearInterval(id);
    };
  }, [run, intervalMs]);

  const api = check.state === "loading" ? undefined : check.state === "reachable";
  const db =
    check.state === "reachable" ? check.health.db === "up" : api === false ? false : undefined;
  const redis =
    check.state === "reachable" ? check.health.redis === "up" : api === false ? false : undefined;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Service status</CardTitle>
        <CardDescription className="break-all">{healthUrl}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-wrap gap-2" aria-live="polite">
          <Chip label="API" up={api} />
          <Chip label="DB" up={db} />
          <Chip label="Redis" up={redis} />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
          <span>
            {check.state === "reachable" && <>Version {check.health.version} · </>}
            {check.state === "unreachable" && <>API unreachable ({check.message}) · </>}
            {check.state !== "loading" &&
              `checked ${check.checkedAt.toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata" })} IST`}
          </span>
          <Button variant="outline" size="sm" onClick={() => void run()}>
            Re-check
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
