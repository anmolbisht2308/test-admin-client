"use client";

import { useAuth } from "@mockprep/api-client";
import { Button, ThemeToggle, cn } from "@mockprep/ui";
import {
  Activity,
  BookOpen,
  ClipboardList,
  FileQuestion,
  FileSliders,
  ListTree,
  LogOut,
  Menu,
  Upload,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { ROLE_LABELS } from "@/lib/roles";

const NAV = [
  { href: "/tests", label: "Tests", icon: ClipboardList },
  { href: "/uploads", label: "Paper uploads", icon: Upload },
  { href: "/questions", label: "Question bank", icon: FileQuestion },
  { href: "/exams", label: "Exams", icon: BookOpen },
  { href: "/templates", label: "Exam templates", icon: FileSliders },
  { href: "/taxonomy", label: "Taxonomy", icon: ListTree },
  { href: "/status", label: "Status", icon: Activity },
];

/** Signed-in admin layout: sidebar on desktop, drawer on mobile. Redirects to /login when signed out. */
export function AdminShell({ children }: { children: ReactNode }) {
  const { state, api } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (state.status === "signed_out")
      router.replace(`/login?next=${encodeURIComponent(pathname)}`);
  }, [state.status, router, pathname]);
  useEffect(() => setOpen(false), [pathname]);

  if (state.status !== "signed_in") {
    return (
      <div className="grid min-h-dvh place-items-center text-sm text-muted-foreground">
        Loading…
      </div>
    );
  }
  const user = state.user;

  const nav = (
    <nav className="flex flex-col gap-1">
      {NAV.map(({ href, label, icon: Icon }) => {
        const active = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex h-10 items-center gap-3 rounded-md px-3 text-sm",
              active
                ? "bg-primary/10 font-medium text-primary"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            <Icon className="size-4" aria-hidden />
            {label}
          </Link>
        );
      })}
    </nav>
  );

  const account = (
    <div className="flex flex-col gap-2 border-t pt-4 text-sm">
      <div className="min-w-0">
        <p className="truncate font-medium">{user.email}</p>
        <p className="text-xs text-muted-foreground">{ROLE_LABELS[user.role]}</p>
      </div>
      <div className="flex items-center justify-between">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            void api.signOut().finally(() => router.replace("/login"));
          }}
        >
          <LogOut /> Sign out
        </Button>
        <ThemeToggle />
      </div>
    </div>
  );

  return (
    <div className="flex min-h-dvh">
      <aside className="sticky top-0 hidden h-dvh self-start w-60 shrink-0 flex-col justify-between border-r bg-card p-4 lg:flex">
        <div className="flex flex-col gap-6">
          <Link href="/exams" className="px-3 font-semibold tracking-tight">
            mockprep <span className="font-normal text-muted-foreground">admin</span>
          </Link>
          {nav}
        </div>
        {account}
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 items-center justify-between border-b bg-card px-4 lg:hidden">
          <span className="font-semibold">mockprep admin</span>
          <Button variant="ghost" size="icon" aria-label="Open menu" onClick={() => setOpen(true)}>
            <Menu />
          </Button>
        </header>
        {open && (
          <div className="fixed inset-0 z-20 bg-black/40 lg:hidden" onClick={() => setOpen(false)}>
            <div
              className="flex h-full w-72 flex-col justify-between bg-card p-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex flex-col gap-4">
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Close menu"
                  onClick={() => setOpen(false)}
                  className="self-end"
                >
                  <X />
                </Button>
                {nav}
              </div>
              {account}
            </div>
          </div>
        )}
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
