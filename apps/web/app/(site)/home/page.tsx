import type { Metadata } from "next";
import { StudentHome } from "./student-home";

export const metadata: Metadata = { title: "Home", robots: { index: false } };

export default function HomePage() {
  return <StudentHome />;
}
