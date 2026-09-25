import { ThemeProvider } from "@mockprep/ui";
import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { SiteHeader } from "@/components/site-header";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "mockprep: mock tests for Indian competitive exams",
    template: "%s · mockprep",
  },
  description:
    "Full-length mock tests for SBI & IBPS, SSC, UPSC Prelims, NDA & CDS and JEE, in the real exam interface, with rank, percentile and solutions.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fcfcfc" },
    { media: "(prefers-color-scheme: dark)", color: "#16171a" },
  ],
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    // suppressHydrationWarning: next-themes sets the theme class before hydration.
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-dvh">
        <ThemeProvider>
          <SiteHeader />
          <main className="mx-auto max-w-5xl px-4 py-8">{children}</main>
        </ThemeProvider>
      </body>
    </html>
  );
}
