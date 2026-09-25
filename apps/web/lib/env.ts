import { z } from "zod";

const schema = z.object({
  NEXT_PUBLIC_API_URL: z
    .url("NEXT_PUBLIC_API_URL must be an absolute URL, e.g. http://localhost:4000")
    .transform((url) => url.replace(/\/$/, "")),
});

// Next inlines NEXT_PUBLIC_* at build time, so each one must be referenced literally.
const parsed = schema.safeParse({ NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL });
if (!parsed.success) {
  throw new Error(
    `Invalid environment: ${parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}. See .env.example.`,
  );
}

export const env = parsed.data;
