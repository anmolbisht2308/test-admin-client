import { ServiceStatus } from "@mockprep/ui";
import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";
import { RendererDemo } from "@/components/renderer-demo";

export const metadata: Metadata = { title: "Status" };

export default function StatusPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Status" />
      <ServiceStatus />
      <RendererDemo />
    </div>
  );
}
