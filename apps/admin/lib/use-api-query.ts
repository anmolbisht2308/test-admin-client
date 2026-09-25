"use client";

import { errorMessage, useAuth } from "@mockprep/api-client";
import { useCallback, useEffect, useState } from "react";
import type { z } from "zod";

/** Loads an authed GET once (and on reload()). */
export function useApiQuery<S extends z.ZodType>(path: string | null, schema: S) {
  const { api } = useAuth();
  const [data, setData] = useState<z.infer<S> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    if (!path) return;
    const controller = new AbortController();
    setError(null);
    api
      .request(path, { schema, signal: controller.signal })
      .then((result) => setData(result))
      .catch((e: unknown) => {
        if (!controller.signal.aborted) setError(errorMessage(e));
      });
    return () => controller.abort();
  }, [api, path, schema, version]);

  const reload = useCallback(() => setVersion((v) => v + 1), []);
  return { data, error, reload };
}
