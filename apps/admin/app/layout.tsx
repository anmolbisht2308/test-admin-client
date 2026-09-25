import { ThemeProvider } from "@mockprep/ui";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { AdminHeader } from "@/components/admin-header";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "mockprep admin", template: "%s · mockprep admin" },
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-dvh bg-muted/40">
        <ThemeProvider>
          <AdminHeader />
          <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
        </ThemeProvider>
      </body>
    </html>
  );
}
