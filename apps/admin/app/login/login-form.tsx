"use client";

import { errorMessage, useAuth } from "@mockprep/api-client";
import {
  adminLoginResponseSchema,
  authSessionResponseSchema,
  type AdminLoginResponse,
} from "@mockprep/types";
import { Alert, Button, Field, Input } from "@mockprep/ui";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";

function safeNext(value: string | null) {
  return value && value.startsWith("/") && !value.startsWith("//") && value !== "/login"
    ? value
    : "/exams";
}

export function AdminLoginForm() {
  const { api, state } = useAuth();
  const router = useRouter();
  const next = safeNext(useSearchParams().get("next"));
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [challenge, setChallenge] = useState<AdminLoginResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (state.status === "signed_in") router.replace(next);
  }, [state.status, router, next]);

  async function submitPassword(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      setChallenge(
        await api.request("/api/admin/auth/login", {
          method: "POST",
          auth: false,
          body: { email, password },
          schema: adminLoginResponseSchema,
        }),
      );
      setCode("");
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  async function submitCode(event: FormEvent) {
    event.preventDefault();
    if (!challenge) return;
    setError(null);
    setBusy(true);
    try {
      const session = await api.request("/api/admin/auth/totp/verify", {
        method: "POST",
        auth: false,
        body: { challengeToken: challenge.challengeToken, code },
        schema: authSessionResponseSchema,
      });
      api.setSession(session);
      router.replace(next);
    } catch (e) {
      setError(errorMessage(e));
      setBusy(false);
    }
  }

  if (challenge) {
    return (
      <form onSubmit={submitCode} className="flex flex-col gap-4" noValidate>
        {challenge.status === "totp_setup_required" ? (
          <div className="flex flex-col gap-3 text-sm">
            <h1 className="text-lg font-semibold">Set up two-factor sign-in</h1>
            <p className="text-muted-foreground">
              Scan this QR code with an authenticator app (Google Authenticator, Authy, 1Password),
              then enter the 6-digit code it shows.
            </p>
            {/* eslint-disable-next-line @next/next/no-img-element -- data URL from the api */}
            <img
              src={challenge.qrDataUrl}
              alt="QR code for your authenticator app"
              width={220}
              height={220}
              className="self-center rounded-md bg-white p-2"
            />
            <details className="text-muted-foreground">
              <summary className="cursor-pointer">Can&apos;t scan? Enter this key</summary>
              <code className="mt-2 block rounded bg-muted p-2 font-mono text-xs break-all text-foreground">
                {challenge.secret}
              </code>
            </details>
          </div>
        ) : (
          <div className="flex flex-col gap-1">
            <h1 className="text-lg font-semibold">Two-factor code</h1>
            <p className="text-sm text-muted-foreground">
              Enter the 6-digit code from your authenticator app.
            </p>
          </div>
        )}
        <Field label="Authentication code" htmlFor="totp">
          <Input
            id="totp"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            inputMode="numeric"
            autoComplete="one-time-code"
            autoFocus
            className="text-center text-lg tracking-[0.5em]"
            aria-invalid={error ? true : undefined}
          />
        </Field>
        {error && <Alert>{error}</Alert>}
        <Button type="submit" disabled={busy || code.length !== 6}>
          {busy ? "Checking…" : "Verify"}
        </Button>
        <Button type="button" variant="ghost" onClick={() => setChallenge(null)}>
          Back
        </Button>
      </form>
    );
  }

  return (
    <form onSubmit={submitPassword} className="flex flex-col gap-4" noValidate>
      <h1 className="text-lg font-semibold">Sign in</h1>
      <Field label="Email" htmlFor="email">
        <Input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="username"
          autoFocus
          required
        />
      </Field>
      <Field label="Password" htmlFor="password">
        <Input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          required
        />
      </Field>
      {error && <Alert>{error}</Alert>}
      <Button type="submit" disabled={busy || !email || !password}>
        {busy ? "Signing in…" : "Continue"}
      </Button>
    </form>
  );
}
