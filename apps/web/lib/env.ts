import { z } from "zod";

const schema = z.object({
  NEXT_PUBLIC_GOOGLE_CLIENT_ID: z
    .string()
    .trim()
    .optional()
    .transform((v) => v || undefined),
  /** Show phone OTP login. Set "false" while SMS isn't paid for (free setup: Google only). */
  NEXT_PUBLIC_PHONE_LOGIN: z
    .enum(["true", "false", ""])
    .optional()
    .transform((v) => v !== "false"),
  /** Show email-code login (free: codes are sent by the api via Brevo). Default true. */
  NEXT_PUBLIC_EMAIL_LOGIN: z
    .enum(["true", "false", ""])
    .optional()
    .transform((v) => v !== "false"),
});

// Next inlines NEXT_PUBLIC_* at build time, so each one must be referenced literally.
export const publicEnv = schema.parse({
  NEXT_PUBLIC_GOOGLE_CLIENT_ID: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID,
  NEXT_PUBLIC_PHONE_LOGIN: process.env.NEXT_PUBLIC_PHONE_LOGIN,
  NEXT_PUBLIC_EMAIL_LOGIN: process.env.NEXT_PUBLIC_EMAIL_LOGIN,
});
