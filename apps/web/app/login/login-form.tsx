"use client";

import { errorMessage, isApiError, useAuth } from "@mockprep/api-client";
import {
  authSessionResponseSchema,
  indianPhoneSchema,
  otpSendResponseSchema,
  type AuthSessionResponse,
} from "@mockprep/types";
import { Alert, Button, Field, Input } from "@mockprep/ui";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { GoogleSignIn } from "@/components/google-sign-in";
import { publicEnv } from "@/lib/env";

type Step = { name: "phone" } | { name: "code"; phone: string; display: string };

/** Only allow same-site relative redirects after sign-in. */
function safeNext(value: string | null) {
  return value && value.startsWith("/") && !value.startsWith("//") ? value : "/home";
}

export function LoginForm() {
  const { api, state } = useAuth();
  const router = useRouter();
  const next = safeNext(useSearchParams().get("next"));
  const [step, setStep] = useState<Step>({ name: "phone" });
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [resendIn, setResendIn] = useState(0);

  // Already signed in (e.g. back button): go straight on.
  useEffect(() => {
    if (state.status === "signed_in") router.replace(state.user.onboarded ? next : "/onboarding");
  }, [state, router, next]);

  useEffect(() => {
    if (resendIn <= 0) return;
    const id = setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => clearTimeout(id);
  }, [resendIn]);

  const finish = (session: AuthSessionResponse) => {
    api.setSession(session);
    router.replace(session.user.onboarded ? next : "/onboarding");
  };

  async function sendCode(target: string) {
    setError(null);
    const parsed = indianPhoneSchema.safeParse(target);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Enter a valid mobile number");
      return;
    }
    setBusy(true);
    try {
      const res = await api.request("/api/auth/otp/send", {
        method: "POST",
        auth: false,
        body: { phone: parsed.data },
        schema: otpSendResponseSchema,
      });
      setStep({
        name: "code",
        phone: parsed.data,
        display: parsed.data.replace(/^\+91(\d{5})(\d{5})$/, "+91 $1 $2"),
      });
      setResendIn(res.resendInSec);
      setCode("");
    } catch (e) {
      if (isApiError(e) && e.status === 429) {
        const details = e.details as { retryAfterSec?: number } | undefined;
        if (details?.retryAfterSec) setResendIn(details.retryAfterSec);
      }
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  async function verify(event: FormEvent) {
    event.preventDefault();
    if (step.name !== "code") return;
    setError(null);
    setBusy(true);
    try {
      finish(
        await api.request("/api/auth/otp/verify", {
          method: "POST",
          auth: false,
          body: { phone: step.phone, code },
          schema: authSessionResponseSchema,
        }),
      );
    } catch (e) {
      setError(errorMessage(e));
      setBusy(false);
    }
  }

  async function google(idToken: string) {
    setError(null);
    try {
      finish(
        await api.request("/api/auth/google", {
          method: "POST",
          auth: false,
          body: { idToken },
          schema: authSessionResponseSchema,
        }),
      );
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  if (step.name === "code") {
    return (
      <form onSubmit={verify} className="flex flex-col gap-4" noValidate>
        <p className="text-sm">
          Enter the 6-digit code sent to <span className="font-medium">{step.display}</span>.{" "}
          <button
            type="button"
            className="text-primary underline-offset-4 hover:underline"
            onClick={() => setStep({ name: "phone" })}
          >
            Change
          </button>
        </p>
        <Field label="Verification code" htmlFor="code">
          <Input
            id="code"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="\d{6}"
            maxLength={6}
            autoFocus
            className="text-center text-lg tracking-[0.5em]"
            aria-invalid={error ? true : undefined}
          />
        </Field>
        {error && <Alert>{error}</Alert>}
        <Button type="submit" size="lg" disabled={busy || code.length !== 6}>
          {busy ? "Verifying…" : "Verify and continue"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          disabled={busy || resendIn > 0}
          onClick={() => void sendCode(step.phone)}
        >
          {resendIn > 0 ? `Resend code in ${resendIn}s` : "Resend code"}
        </Button>
      </form>
    );
  }

  const phoneLogin = publicEnv.NEXT_PUBLIC_PHONE_LOGIN;
  const googleId = publicEnv.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

  return (
    <div className="flex flex-col gap-6">
      {!phoneLogin && !googleId && (
        <Alert>Sign-in is not configured yet. Please try again later.</Alert>
      )}
      {!phoneLogin && error && <Alert>{error}</Alert>}
      {phoneLogin && (
        <form
          className="flex flex-col gap-4"
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            void sendCode(phone);
          }}
        >
          <Field label="Mobile number" htmlFor="phone" hint="We'll send a one-time code by SMS.">
            <div className="flex">
              <span className="inline-flex h-11 items-center rounded-l-md border border-r-0 border-input bg-muted px-3 text-sm text-muted-foreground">
                +91
              </span>
              <Input
                id="phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                inputMode="tel"
                autoComplete="tel-national"
                placeholder="98765 43210"
                className="rounded-l-none"
                autoFocus
                aria-invalid={error ? true : undefined}
              />
            </div>
          </Field>
          {error && <Alert>{error}</Alert>}
          <Button type="submit" size="lg" disabled={busy || resendIn > 0}>
            {busy ? "Sending…" : resendIn > 0 ? `Try again in ${resendIn}s` : "Send code"}
          </Button>
        </form>
      )}
      {googleId && (
        <>
          {phoneLogin && (
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span className="h-px flex-1 bg-border" /> or{" "}
              <span className="h-px flex-1 bg-border" />
            </div>
          )}
          <GoogleSignIn clientId={googleId} onCredential={(t) => void google(t)} />
        </>
      )}
    </div>
  );
}
