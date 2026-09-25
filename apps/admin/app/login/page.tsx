import type { Metadata } from "next";
import { Suspense } from "react";
import { AdminLoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in" };

export default function LoginPage() {
  return (
    <div className="grid min-h-dvh place-items-center px-4">
      <div className="w-full max-w-sm rounded-xl border bg-card p-6 shadow-xs">
        <p className="mb-6 font-semibold tracking-tight">
          mockprep <span className="font-normal text-muted-foreground">admin</span>
        </p>
        <Suspense>
          <AdminLoginForm />
        </Suspense>
      </div>
    </div>
  );
}
