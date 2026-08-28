"use client";

import { passwordStrength } from "@findit/domain";
import { cn } from "@/lib/utils";

const BAR: Record<string, string> = {
  "Too weak": "bg-accent w-[12%]",
  Weak: "bg-accent w-[28%]",
  Fair: "bg-[var(--order)] w-[52%]",
  Good: "bg-stock w-[76%]",
  Strong: "bg-stock w-full",
};

const LABEL: Record<string, string> = {
  "Too weak": "text-accent-ink",
  Weak: "text-accent-ink",
  Fair: "text-[var(--order-ink)]",
  Good: "text-stock-ink",
  Strong: "text-stock-ink",
};

export function PasswordStrengthMeter({
  password,
  email,
}: {
  password: string;
  email?: string;
}) {
  if (!password) return null;
  const result = passwordStrength(password, email);
  return (
    <div className="mt-2 space-y-1">
      <div className="h-1.5 overflow-hidden rounded-full bg-ink-100">
        <div
          className={cn("h-full rounded-full transition-all", BAR[result.label])}
        />
      </div>
      <p className={cn("text-xs font-medium", LABEL[result.label])}>
        {result.label}
        {result.hints[0] ? ` — ${result.hints[0]}` : ""}
      </p>
    </div>
  );
}
