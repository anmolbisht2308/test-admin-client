import { ThemeToggle } from "@mockprep/ui";
import Link from "next/link";

export function AdminHeader() {
  return (
    <header className="border-b bg-card">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-2 px-4">
        <Link href="/" className="font-semibold tracking-tight">
          mockprep <span className="font-normal text-muted-foreground">admin</span>
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
