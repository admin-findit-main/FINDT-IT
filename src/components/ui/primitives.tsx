/**
 * Thin, familiar names (`Card`, `Input`, `Badge`…) over the glass system.
 *
 * These exist so screens can keep importing the primitive they already use while
 * the styling stays centralised in `ui/glass.tsx`. New code can import either.
 */
import * as React from "react";
import { cn } from "@/lib/utils";
import {
  GlassBadge,
  GlassCard,
  GlassEmptyState,
  GlassInput,
  GlassLabel,
  GlassSkeleton,
  GlassTextarea,
  type GlassCardProps,
} from "@/components/ui/glass";

export const Input = GlassInput;
export const Textarea = GlassTextarea;
export const Label = GlassLabel;
export const Skeleton = GlassSkeleton;
export const EmptyState = GlassEmptyState;

export function Card({ className, ...props }: GlassCardProps) {
  return <GlassCard className={cn("rounded-glass-2xl", className)} {...props} />;
}

export function Badge({
  className,
  variant = "default",
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & {
  variant?: "default" | "success" | "warning" | "danger" | "muted";
}) {
  const toneFor = {
    default: "ink",
    success: "stock",
    warning: "order",
    danger: "accent",
    muted: "neutral",
  } as const;
  return <GlassBadge tone={toneFor[variant]} className={className} {...props} />;
}

export {
  GlassCard,
  GlassInput,
  GlassTextarea,
  GlassLabel,
  GlassBadge,
  GlassSkeleton,
  GlassEmptyState,
};
