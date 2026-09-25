"use client";

import { useAuth } from "@mockprep/api-client";
import { Button, ThemeToggle } from "@mockprep/ui";
import Link from "next/link";
import { useRouter } from "next/navigation";

export function SiteHeader() {
  const { state, api } = useAuth();
  const router = useRouter();

  return (
    <header className="sticky top-0 z-10 border-b bg-background/90 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-2 px-4">
        <Link
          href={state.status === "signed_in" ? "/home" : "/"}
          className="text-lg font-semibold tracking-tight"
        >
          mock<span className="text-primary">prep</span>
        </Link>
        <nav className="flex items-center gap-1 text-sm">
          <Link href="/exams" className="rounded-md px-3 py-2 hover:bg-muted">
            Exams
          </Link>
          {state.status === "signed_in" ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                // Leave the page first so signed-in-only pages don't redirect to /login.
                router.replace("/");
                void api.signOut();
              }}
            >
              Sign out
            </Button>
          ) : state.status === "signed_out" ? (
            <Button asChild size="sm">
              <Link href="/login">Sign in</Link>
            </Button>
          ) : (
            <span className="inline-block h-9 w-16" aria-hidden />
          )}
          <ThemeToggle />
        </nav>
      </div>
    </header>
  );
}
