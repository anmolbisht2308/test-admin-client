"use client";

import { AuthProvider } from "@mockprep/api-client";
import { ThemeProvider } from "@mockprep/ui";
import type { ReactNode } from "react";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider>
      <AuthProvider refreshPath="/api/auth/refresh" logoutPath="/api/auth/logout">
        {children}
      </AuthProvider>
    </ThemeProvider>
  );
}
