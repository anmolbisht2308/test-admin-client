import type { Metadata } from "next";
import { OnboardingForm } from "./onboarding-form";

export const metadata: Metadata = { title: "Get started", robots: { index: false } };

export default function OnboardingPage() {
  return (
    <div className="mx-auto flex max-w-xl flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">Tell us about you</h1>
        <p className="text-sm text-muted-foreground">
          We&apos;ll show the mocks for the exams you pick. You can change this later.
        </p>
      </div>
      <OnboardingForm />
    </div>
  );
}
