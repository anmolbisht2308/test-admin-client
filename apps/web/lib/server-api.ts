import type { z } from "zod";

/**
 * Server-side fetch straight to the api (Server Components only; API_ORIGIN is not public).
 * Returns null on 404. Cached for `revalidate` seconds (ISR), so admin edits show up
 * on the site within a minute, without a deploy.
 */
export async function serverGet<S extends z.ZodType>(
  path: string,
  schema: S,
  revalidate = 60,
): Promise<z.infer<S> | null> {
  const origin = process.env.API_ORIGIN?.replace(/\/$/, "");
  if (!origin) throw new Error("API_ORIGIN is not set");
  const res = await fetch(`${origin}${path}`, {
    next: { revalidate },
    headers: { accept: "application/json" },
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`GET ${path} failed with ${res.status}`);
  return schema.parse(await res.json()) as z.infer<S>;
}
