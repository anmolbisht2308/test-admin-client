import { z } from "zod";

const schema = z.object({
  NEXT_PUBLIC_GOOGLE_CLIENT_ID: z
    .string()
    .trim()
    .optional()
    .transform((v) => v || undefined),
});

// Next inlines NEXT_PUBLIC_* at build time, so each one must be referenced literally.
export const publicEnv = schema.parse({
  NEXT_PUBLIC_GOOGLE_CLIENT_ID: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID,
});
