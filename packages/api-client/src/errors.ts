import { apiErrorSchema } from "@mockprep/types";

/** Thrown for any non-2xx response. `message` is the api's `error` string, safe to show. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }

  static async fromResponse(res: Response): Promise<ApiError> {
    const body: unknown = await res.json().catch(() => null);
    const parsed = apiErrorSchema.safeParse(body);
    if (parsed.success) return new ApiError(res.status, parsed.data.error, parsed.data.details);
    return new ApiError(
      res.status,
      res.status >= 500 ? "Something went wrong. Please try again." : res.statusText,
    );
  }
}

export const isApiError = (error: unknown): error is ApiError => error instanceof ApiError;

/** User-facing message for any thrown value. */
export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof TypeError)
    return "You seem to be offline. Check your connection and try again.";
  return "Something went wrong. Please try again.";
}

interface Issue {
  path: PropertyKey[];
  message: string;
}

const isIssueList = (value: unknown): value is Issue[] =>
  Array.isArray(value) &&
  value.every((i) => typeof i === "object" && i !== null && "path" in i && "message" in i);

/**
 * Zod issues (from a local safeParse or an api 400's `details`) → { "sections.0.name": message }.
 * The first message per field wins.
 */
export function fieldErrors(issues: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  if (!isIssueList(issues)) return out;
  for (const issue of issues) {
    const key = issue.path.map(String).join(".");
    out[key] ??= issue.message;
  }
  return out;
}
