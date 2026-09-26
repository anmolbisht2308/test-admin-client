import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = { title: "Test", robots: { index: false } };

/** Full screen: no site header on the test screens. */
export default function TestLayout({ children }: { children: ReactNode }) {
  return children;
}
