import type { ComponentProps, ReactNode } from "react";
import { cn } from "../lib/cn";

const control =
  "w-full min-w-0 rounded-md border border-input bg-transparent px-3 text-base shadow-xs outline-none placeholder:text-muted-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive md:text-sm";

export function Label({ className, ...props }: ComponentProps<"label">) {
  return <label className={cn("text-sm font-medium leading-none", className)} {...props} />;
}

export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return <textarea className={cn(control, "min-h-24 py-2", className)} {...props} />;
}

/** Native select: accessible, tiny, and uses the phone's own picker on mobile. */
export function Select({ className, ...props }: ComponentProps<"select">) {
  return <select className={cn(control, "h-11 bg-background pr-8", className)} {...props} />;
}

export interface FieldProps {
  label: ReactNode;
  htmlFor: string;
  error?: string | undefined;
  hint?: ReactNode;
  className?: string;
  children: ReactNode;
}

/** Label + control + hint/error, wired for screen readers via `${htmlFor}-error`. */
export function Field({ label, htmlFor, error, hint, className, children }: FieldProps) {
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {error ? (
        <p id={`${htmlFor}-error`} className="text-sm text-destructive">
          {error}
        </p>
      ) : hint ? (
        <p className="text-sm text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}

export function Alert({
  className,
  variant = "error",
  ...props
}: ComponentProps<"div"> & { variant?: "error" | "info" | "success" }) {
  return (
    <div
      role={variant === "error" ? "alert" : "status"}
      className={cn(
        "rounded-md border px-3 py-2 text-sm",
        variant === "error" && "border-destructive/40 bg-destructive/10 text-destructive",
        variant === "info" && "bg-muted text-foreground",
        variant === "success" && "border-success/40 bg-success/10 text-foreground",
        className,
      )}
      {...props}
    />
  );
}
