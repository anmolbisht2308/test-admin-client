import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";
import { TaxonomyTree } from "@/components/taxonomy-tree";

export const metadata: Metadata = { title: "Taxonomy" };

export default function TaxonomyPage() {
  return (
    <>
      <PageHeader
        title="Taxonomy"
        description="Subject → topic → subtopic, per exam family. Questions are tagged with these."
      />
      <TaxonomyTree />
    </>
  );
}
