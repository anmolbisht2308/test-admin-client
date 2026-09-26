"use client";

import { errorMessage, useAuth } from "@mockprep/api-client";
import {
  fakePaymentResponseSchema,
  orderCreateResponseSchema,
  paymentVerifyResponseSchema,
  quoteSchema,
  type AccessResponse,
  type OrderCreateResponse,
  type Plan,
  type Quote,
} from "@mockprep/types";
import { Alert, Button, Input, Label } from "@mockprep/ui";
import { useState } from "react";
import { useAccessStore } from "@/lib/access-store";
import { formatRupees } from "@/lib/payments";

/** The parts of Razorpay Checkout (checkout.js) we use. */
interface RazorpaySuccess {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}
interface RazorpayInstance {
  open(): void;
  on(event: "payment.failed", cb: (e: { error?: { description?: string } }) => void): void;
}
type RazorpayCtor = new (options: Record<string, unknown>) => RazorpayInstance;
declare global {
  interface Window {
    Razorpay?: RazorpayCtor;
  }
}

/** Loaded only when a student clicks Pay (never on the test route). */
function loadRazorpay(): Promise<RazorpayCtor> {
  if (window.Razorpay) return Promise.resolve(window.Razorpay);
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.async = true;
    s.onload = () =>
      window.Razorpay ? resolve(window.Razorpay) : reject(new Error("Checkout failed to load"));
    s.onerror = () => reject(new TypeError("Checkout failed to load"));
    document.body.appendChild(s);
  });
}

type Step = "review" | "paying" | "fake" | "confirming" | "done";

/**
 * Buy a plan: coupon → server quote → order → Razorpay Checkout (or the dev stand-in) →
 * verify. If verify can't be reached, the order is polled: the webhook grants access anyway.
 */
export function CheckoutDialog({
  plan,
  onClose,
}: {
  plan: Plan;
  onClose: (access: AccessResponse | null) => void;
}) {
  const { api } = useAuth();
  const setAccess = useAccessStore((s) => s.set);
  const [coupon, setCoupon] = useState("");
  const [quote, setQuote] = useState<Quote | null>(null);
  const [step, setStep] = useState<Step>("review");
  const [order, setOrder] = useState<OrderCreateResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [couponError, setCouponError] = useState<string | null>(null);
  const [granted, setGranted] = useState<AccessResponse | null>(null);

  const couponCode = coupon.trim().toUpperCase() || undefined;
  const amount = quote?.amountPaise ?? plan.pricePaise;

  // Applied on "Continue": applying it now would unmount a paywall (and this dialog) at once.
  function finish(access: AccessResponse) {
    setGranted(access);
    setStep("done");
  }

  async function applyCoupon() {
    setCouponError(null);
    if (!couponCode) return setQuote(null);
    try {
      setQuote(
        await api.request("/api/orders/quote", {
          method: "POST",
          body: { planId: plan.id, couponCode },
          schema: quoteSchema,
        }),
      );
    } catch (e) {
      setQuote(null);
      setCouponError(errorMessage(e));
    }
  }

  /** Waits for the webhook when verify didn't get through (flaky network, closed popup…). */
  async function pollOrder(orderId: string) {
    setStep("confirming");
    for (let i = 0; i < 20; i++) {
      try {
        const res = await api.request(`/api/orders/${orderId}`, {
          schema: paymentVerifyResponseSchema,
        });
        if (res.status === "paid") return finish(res.access);
        if (res.status === "failed") break;
      } catch {
        // keep polling
      }
      await new Promise((r) => setTimeout(r, 3000));
    }
    setStep("review");
    setError(
      "We couldn't confirm the payment yet. If money was deducted, access unlocks automatically within a few minutes — check My purchases.",
    );
  }

  async function verify(orderId: string, ids: Omit<RazorpaySuccess, never>) {
    setStep("confirming");
    try {
      const res = await api.request("/api/payments/verify", {
        method: "POST",
        body: {
          orderId,
          razorpayOrderId: ids.razorpay_order_id,
          razorpayPaymentId: ids.razorpay_payment_id,
          razorpaySignature: ids.razorpay_signature,
        },
        schema: paymentVerifyResponseSchema,
      });
      finish(res.access);
    } catch {
      await pollOrder(orderId);
    }
  }

  async function pay() {
    setError(null);
    setStep("paying");
    try {
      const created = await api.request("/api/orders", {
        method: "POST",
        body: { planId: plan.id, ...(couponCode ? { couponCode } : {}) },
        schema: orderCreateResponseSchema,
      });
      setOrder(created);
      if (created.provider === "free") return await pollOrder(created.orderId);
      if (created.provider === "fake") return setStep("fake");
      const Razorpay = await loadRazorpay();
      const rzp = new Razorpay({
        key: created.keyId,
        amount: created.amountPaise,
        currency: created.currency,
        order_id: created.razorpayOrderId,
        name: "mockprep",
        description: created.planName,
        prefill: created.prefill,
        theme: { color: "#2563eb" },
        handler: (res: RazorpaySuccess) => void verify(created.orderId, res),
        modal: { ondismiss: () => setStep((s) => (s === "paying" ? "review" : s)) },
      });
      rzp.on("payment.failed", (e) => setError(e.error?.description ?? "Payment failed"));
      rzp.open();
    } catch (e) {
      setError(errorMessage(e));
      setStep("review");
    }
  }

  /** Dev stand-in for Checkout (PAYMENTS_PROVIDER=fake). */
  async function fakePay(outcome: "success" | "failure", callVerify: boolean) {
    if (!order) return;
    setError(null);
    try {
      const res = await api.request("/api/payments/fake/complete", {
        method: "POST",
        body: { orderId: order.orderId, outcome },
        schema: fakePaymentResponseSchema,
      });
      if (outcome === "failure" || !res.razorpayPaymentId || !res.razorpaySignature) {
        setError("Payment failed. You can try again.");
        return;
      }
      if (callVerify) {
        await verify(order.orderId, {
          razorpay_order_id: res.razorpayOrderId,
          razorpay_payment_id: res.razorpayPaymentId,
          razorpay_signature: res.razorpaySignature,
        });
      } else {
        await pollOrder(order.orderId);
      }
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="checkout-title"
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center"
    >
      <div className="w-full max-w-md rounded-t-xl bg-background p-5 shadow-xl sm:rounded-xl">
        <h2 id="checkout-title" className="text-lg font-semibold">
          {step === "done" ? "You're in!" : plan.name}
        </h2>

        {step === "done" ? (
          <div className="mt-3 flex flex-col gap-3">
            <Alert variant="success">
              Payment received. {plan.kind === "pass" ? "Every exam" : "The mocks for this plan"}{" "}
              {plan.kind === "pass" ? "is" : "are"} unlocked for {plan.validityDays} days. Your GST
              invoice is in My purchases.
            </Alert>
            <Button
              className="h-11"
              onClick={() => {
                if (granted) setAccess(granted);
                onClose(granted);
              }}
            >
              Continue
            </Button>
          </div>
        ) : (
          <>
            <p className="mt-1 text-sm text-muted-foreground">
              {plan.validityDays} days access · price includes 18% GST
            </p>
            <div className="mt-4 flex items-end gap-2">
              <div className="flex-1">
                <Label htmlFor="coupon">Coupon code</Label>
                <Input
                  id="coupon"
                  value={coupon}
                  onChange={(e) => setCoupon(e.target.value)}
                  placeholder="Optional"
                  autoCapitalize="characters"
                  disabled={step !== "review"}
                />
              </div>
              <Button
                variant="outline"
                className="h-11"
                onClick={() => void applyCoupon()}
                disabled={step !== "review" || !coupon.trim()}
              >
                Apply
              </Button>
            </div>
            {couponError && <p className="mt-1 text-sm text-destructive">{couponError}</p>}

            <dl className="mt-4 flex flex-col gap-1 text-sm">
              <div className="flex justify-between">
                <dt>Price</dt>
                <dd className="tabular-nums">{formatRupees(plan.pricePaise)}</dd>
              </div>
              {quote && quote.discountPaise > 0 && (
                <div className="flex justify-between text-success">
                  <dt>Coupon {quote.couponCode}</dt>
                  <dd className="tabular-nums">−{formatRupees(quote.discountPaise)}</dd>
                </div>
              )}
              <div className="flex justify-between border-t pt-2 text-base font-semibold">
                <dt>To pay</dt>
                <dd className="tabular-nums">{formatRupees(amount)}</dd>
              </div>
            </dl>

            {error && <Alert className="mt-3">{error}</Alert>}

            {step === "fake" ? (
              <div className="mt-4 flex flex-col gap-2 rounded-md border border-dashed p-3">
                <p className="text-sm font-medium">Test payment (no real money)</p>
                <Button className="h-11" onClick={() => void fakePay("success", true)}>
                  Pay {formatRupees(amount)}
                </Button>
                <Button variant="outline" onClick={() => void fakePay("success", false)}>
                  Pay, then close the browser (webhook only)
                </Button>
                <Button variant="ghost" onClick={() => void fakePay("failure", true)}>
                  Simulate a failed payment
                </Button>
              </div>
            ) : (
              <Button
                className="mt-4 h-11 w-full"
                onClick={() => void pay()}
                disabled={step !== "review"}
              >
                {step === "confirming"
                  ? "Confirming payment…"
                  : step === "paying"
                    ? "Opening checkout…"
                    : amount === 0
                      ? "Get it free"
                      : `Pay ${formatRupees(amount)}`}
              </Button>
            )}
            <Button
              variant="ghost"
              className="mt-2 w-full"
              onClick={() => onClose(null)}
              disabled={step === "confirming"}
            >
              Cancel
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
