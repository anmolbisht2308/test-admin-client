import { ThemeToggle } from "@mockprep/ui";
import Link from "next/link";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-10 border-b bg-background/90 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-2 px-4">
        <Link href="/" className="text-lg font-semibold tracking-tight">
          mock<span className="text-primary">prep</span>
        </Link>
        <nav className="flex items-center gap-1 text-sm">
          <Link href="/status" className="rounded-md px-3 py-2 hover:bg-muted">
            Status
          </Link>
          <ThemeToggle />
        </nav>
      </div>
    </header>
  );
}
