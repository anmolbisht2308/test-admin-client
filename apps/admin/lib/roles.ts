import type { Role } from "@mockprep/types";

/** Mirrors the api's CONTENT_WRITERS. The api enforces it; the UI only hides buttons. */
export const canEditContent = (role: Role | undefined) =>
  role === "superadmin" || role === "content";

export const ROLE_LABELS: Record<Role, string> = {
  student: "Student",
  superadmin: "Super admin",
  content: "Content",
  reviewer: "Reviewer",
  support: "Support",
  finance: "Finance",
};
