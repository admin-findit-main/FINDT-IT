/**
 * FINDIT UI primitives for the web.
 *
 * Cards are opaque. Frost lives on `.glass-chrome` (nav, tab bars). Red is
 * reserved for the primary action.
 */
import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

export type GlassLevel = "subtle" | "base" | "strong" | "chrome" | "dark";

const LEVEL_CLASS: Record<GlassLevel, string> = {
  subtle: "glass-subtle",
  base: "glass",
  strong: "glass-strong",
  chrome: "glass-chrome",
  dark: "glass-dark",
};

/* -------------------------------------------------------------------------- */
/* Surfaces                                                                    */
/* -------------------------------------------------------------------------- */

export type GlassSurfaceProps = React.HTMLAttributes<HTMLDivElement> & {
  level?: GlassLevel;
  /** Adds the diagonal specular sheen used on hero and feature cards. */
  sheen?: boolean;
  asChild?: boolean;
};

/** Raw layered surface. Prefer `GlassCard` unless you need custom geometry. */
export function GlassSurface({
  level = "base",
  sheen = false,
  className,
  asChild = false,
  ...props
}: GlassSurfaceProps) {
  const Comp = asChild ? Slot : "div";
  return (
    <Comp
      className={cn(LEVEL_CLASS[level], sheen && "glass-sheen", className)}
      {...props}
    />
  );
}

export type GlassCardProps = GlassSurfaceProps & {
  /** Adds hover lift + pressed feedback. Use for cards that are links/buttons. */
  interactive?: boolean;
  padded?: boolean;
};

/** The workhorse floating panel: rounded, hairlined, softly shadowed. */
export function GlassCard({
  level = "base",
  sheen = false,
  interactive = false,
  padded = false,
  className,
  asChild = false,
  ...props
}: GlassCardProps) {
  const Comp = asChild ? Slot : "div";
  return (
    <Comp
      className={cn(
        LEVEL_CLASS[level],
        "relative rounded-glass-xl",
        sheen && "glass-sheen",
        padded && "p-5 sm:p-6",
        interactive && "glass-lift glass-press cursor-pointer",
        className
      )}
      {...props}
    />
  );
}

/** Section wrapper that keeps page padding consistent across screens. */
export function GlassSection({
  className,
  ...props
}: React.HTMLAttributes<HTMLElement>) {
  return <section className={cn("px-5 md:px-8 lg:px-10", className)} {...props} />;
}

/* -------------------------------------------------------------------------- */
/* Buttons                                                                     */
/* -------------------------------------------------------------------------- */

export const glassButtonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap font-semibold glass-press transition-[background-color,box-shadow,color,transform] duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-ring disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        /** Brand red. The single primary action on a screen. */
        accent:
          "bg-accent text-ink-inverse shadow-accent hover:bg-accent-hover active:bg-accent-hover",
        /** Translucent secondary action. */
        glass:
          "glass text-ink hover:bg-glass-3 rounded-glass-lg",
        /** Solid black — structural actions such as sign-in. */
        ink: "bg-[var(--fd-black)] text-ink-inverse hover:bg-[var(--fd-ink-700)]",
        /** Hairline outline on the canvas. */
        outline:
          "border border-hairline-strong bg-white text-ink hover:bg-[var(--solid-3)]",
        /** Text-only. */
        ghost: "text-ink-muted hover:bg-glass-2 hover:text-ink",
        /** Tinted red, for destructive-but-secondary actions. */
        soft: "bg-accent-soft text-accent-ink hover:bg-[rgba(229,35,27,0.18)]",
        /** Response actions in the store queue. */
        stock:
          "bg-stock-tint text-stock-ink border border-[var(--stock-border)] hover:bg-[rgba(14,159,110,0.22)]",
        order:
          "bg-order-tint text-order-ink border border-[var(--order-border)] hover:bg-[rgba(199,119,0,0.22)]",
        oos: "bg-oos-tint text-oos-ink border border-[var(--oos-border)] hover:bg-[rgba(110,110,120,0.2)]",
      },
      size: {
        sm: "h-9 rounded-glass-md px-3.5 text-xs",
        default: "h-11 rounded-glass-lg px-5 text-sm",
        lg: "h-12 rounded-glass-lg px-6 text-base",
        xl: "h-14 rounded-glass-xl px-8 text-base",
        icon: "h-11 w-11 rounded-glass-lg",
      },
    },
    defaultVariants: {
      variant: "accent",
      size: "default",
    },
  }
);

export interface GlassButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof glassButtonVariants> {
  asChild?: boolean;
}

export const GlassButton = React.forwardRef<HTMLButtonElement, GlassButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(glassButtonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
GlassButton.displayName = "GlassButton";

/* -------------------------------------------------------------------------- */
/* Form controls                                                               */
/* -------------------------------------------------------------------------- */

const fieldClass =
  "w-full rounded-glass-lg border border-hairline-strong bg-white text-ink placeholder:text-ink-subtle transition-[border-color,box-shadow] focus-visible:outline-none focus-visible:border-accent focus-visible:ring-4 focus-visible:ring-accent-soft disabled:cursor-not-allowed disabled:opacity-50";

export const GlassInput = React.forwardRef<
  HTMLInputElement,
  React.ComponentProps<"input">
>(({ className, type, ...props }, ref) => (
  <input
    type={type}
    ref={ref}
    className={cn(fieldClass, "h-12 px-4 text-base", className)}
    {...props}
  />
));
GlassInput.displayName = "GlassInput";

export const GlassTextarea = React.forwardRef<
  HTMLTextAreaElement,
  React.ComponentProps<"textarea">
>(({ className, ...props }, ref) => (
  <textarea
    ref={ref}
    className={cn(fieldClass, "min-h-24 px-4 py-3 text-base", className)}
    {...props}
  />
));
GlassTextarea.displayName = "GlassTextarea";

export const GlassSelect = React.forwardRef<
  HTMLSelectElement,
  React.ComponentProps<"select">
>(({ className, ...props }, ref) => (
  <select
    ref={ref}
    className={cn(fieldClass, "h-12 px-4 text-base", className)}
    {...props}
  />
));
GlassSelect.displayName = "GlassSelect";

export function GlassLabel({
  className,
  ...props
}: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      className={cn("mb-1.5 block text-sm font-semibold text-ink-muted", className)}
      {...props}
    />
  );
}

/** Selectable pill for categories, radius and expiry options. */
export function GlassChip({
  selected = false,
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { selected?: boolean }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      className={cn(
        "glass-press rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors",
        selected
          ? "bg-[var(--fd-black)] text-ink-inverse"
          : "border border-hairline-strong bg-white text-ink-muted hover:bg-[var(--solid-3)] hover:text-ink",
        className
      )}
      {...props}
    />
  );
}

/* -------------------------------------------------------------------------- */
/* Chrome                                                                      */
/* -------------------------------------------------------------------------- */

/** Sticky frosted top bar. */
export function GlassNav({
  className,
  ...props
}: React.HTMLAttributes<HTMLElement>) {
  return (
    <header
      className={cn(
        "glass-chrome sticky top-0 z-50 border-b border-hairline-strong",
        className
      )}
      {...props}
    />
  );
}

/** Floating frosted tab bar for small screens. */
export function GlassTabBar({
  className,
  ...props
}: React.HTMLAttributes<HTMLElement>) {
  return (
    <nav
      className={cn(
        "glass-chrome fixed inset-x-0 bottom-0 z-40 border-t border-hairline-strong",
        className
      )}
      {...props}
    />
  );
}

/* -------------------------------------------------------------------------- */
/* Status                                                                      */
/* -------------------------------------------------------------------------- */

export type StatusTone = "stock" | "order" | "oos" | "pending";

const STATUS_PILL: Record<StatusTone, string> = {
  stock: "bg-stock-tint text-stock-ink border-[var(--stock-border)]",
  order: "bg-order-tint text-order-ink border-[var(--order-border)]",
  oos: "bg-oos-tint text-oos-ink border-[var(--oos-border)]",
  pending: "bg-oos-tint text-oos-ink border-[var(--oos-border)]",
};

const STATUS_RAIL: Record<StatusTone, string> = {
  stock: "bg-stock",
  order: "bg-order",
  oos: "bg-oos",
  pending: "bg-oos",
};

/** Maps a database `response_type` onto a design tone. */
export function toneForResponse(type: string | null | undefined): StatusTone {
  switch (type) {
    case "in_stock":
      return "stock";
    case "can_order":
      return "order";
    case "out_of_stock":
      return "oos";
    default:
      return "pending";
  }
}

export function StatusPill({
  tone,
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { tone: StatusTone }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-[12px] font-semibold",
        STATUS_PILL[tone],
        className
      )}
      {...props}
    />
  );
}

/** Coloured rail down the leading edge of a response card. */
export function StatusRail({ tone }: { tone: StatusTone }) {
  return (
    <span
      aria-hidden
      className={cn(
        "absolute inset-y-0 left-0 w-1.5 rounded-l-glass-xl",
        STATUS_RAIL[tone]
      )}
    />
  );
}

/** Neutral / accent metadata badge. */
export function GlassBadge({
  tone = "neutral",
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & {
  tone?: "neutral" | "accent" | "ink" | "stock" | "order" | "oos";
}) {
  const tones: Record<string, string> = {
    neutral: "border-hairline-strong bg-glass-2 text-ink-muted",
    accent: "border-[var(--accent-ring)] bg-accent-soft text-accent-ink",
    ink: "border-transparent bg-[var(--fd-black)] text-ink-inverse",
    stock: STATUS_PILL.stock,
    order: STATUS_PILL.order,
    oos: STATUS_PILL.oos,
  };
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold",
        tones[tone],
        className
      )}
      {...props}
    />
  );
}

/* -------------------------------------------------------------------------- */
/* Feedback                                                                    */
/* -------------------------------------------------------------------------- */

export function GlassEmptyState({
  title,
  description,
  action,
  className,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center px-6 py-16 text-center",
        className
      )}
    >
      <h3 className="text-lg font-semibold text-ink">{title}</h3>
      {description ? (
        <p className="mt-2 max-w-sm text-sm leading-relaxed text-ink-muted">
          {description}
        </p>
      ) : null}
      {action ? <div className="mt-6">{action}</div> : null}
    </div>
  );
}

export function GlassSkeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "animate-pulse rounded-glass-lg border border-hairline-strong bg-glass-2",
        className
      )}
      {...props}
    />
  );
}

/** Inline notice: `accent` for problems, `muted` for hints. */
export function GlassNotice({
  tone = "muted",
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & {
  tone?: "accent" | "muted" | "stock" | "order";
}) {
  const tones: Record<string, string> = {
    accent: "border-[var(--accent-ring)] bg-accent-soft text-accent-ink",
    muted: "border-hairline-strong bg-glass-1 text-ink-muted",
    stock: "border-[var(--stock-border)] bg-stock-tint text-stock-ink",
    order: "border-[var(--order-border)] bg-order-tint text-order-ink",
  };
  return (
    <div
      className={cn(
        "rounded-glass-lg border p-4 text-sm leading-relaxed",
        tones[tone],
        className
      )}
      {...props}
    />
  );
}

/** Small caps section label used above groups of cards. */
export function Overline({
  className,
  ...props
}: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p
      className={cn(
        "text-[12px] font-semibold tracking-wide text-ink-muted",
        className
      )}
      {...props}
    />
  );
}
