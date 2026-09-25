"use client";

import { useAuth } from "@mockprep/api-client";
import type { User } from "@mockprep/types";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";

/**
 * Client-side guard for student pages. Redirects to /login when signed out and to /onboarding
 * until onboarding is done. Returns the user once the page may render.
 */
export function useRequireStudent({ allowNotOnboarded = false } = {}): User | null {
  const { state } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  const user = state.status === "signed_in" ? state.user : null;
  const needsOnboarding = user !== null && !user.onboarded && !allowNotOnboarded;

  useEffect(() => {
    if (state.status === "signed_out")
      router.replace(`/login?next=${encodeURIComponent(pathname)}`);
    else if (needsOnboarding) router.replace("/onboarding");
  }, [state.status, needsOnboarding, router, pathname]);

  return user && !needsOnboarding ? user : null;
}
