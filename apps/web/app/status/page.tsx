import { ServiceStatus } from "@mockprep/ui";
import type { Metadata } from "next";
import { env } from "@/lib/env";

export const metadata: Metadata = { title: "Status", robots: { index: false } };

export default function StatusPage() {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">Status</h1>
      <ServiceStatus apiUrl={env.NEXT_PUBLIC_API_URL} />
    </div>
  );
}
