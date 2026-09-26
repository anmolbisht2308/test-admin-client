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

/** Mirrors the api's FINANCE roles: plans, coupons, refunds, revenue. */
export const canManageMoney = (role: Role | undefined) =>
  role === "superadmin" || role === "finance";

/** Mirrors the api's ORDER_DESK: orders list and manual access. */
export const canServeOrders = (role: Role | undefined) =>
  canManageMoney(role) || role === "support";
