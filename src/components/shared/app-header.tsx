"use client";

import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { GlassNav } from "@/components/ui/glass";
import { BrandHomeLink } from "@/components/brand/logo";

type AppHeaderProps = {
  brandHref?: string;
  brandLabel?: string;
  backHref?: string;
  backLabel?: string;
  title?: string;
  className?: string;
  contentClassName?: string;
  children?: React.ReactNode;
};

/** Customer top bar with the FINDIT F-mark. */
export function AppHeader({
  brandHref = "/home",
  brandLabel = "FINDIT",
  backHref,
  backLabel = "Back",
  title,
  className,
  contentClassName,
  children,
}: AppHeaderProps) {
  return (
    <GlassNav className={className}>
      <div
        className={cn(
          "mx-auto flex min-h-14 max-w-lg items-center gap-2 px-5 py-2.5 md:max-w-3xl lg:max-w-5xl",
          contentClassName
        )}
      >
        {backHref ? (
          <Link
            href={backHref}
            className="inline-flex min-h-11 shrink-0 items-center gap-0.5 rounded-glass-md pr-1 text-sm font-semibold text-ink-muted transition-colors hover:text-accent-ink"
            aria-label={backLabel}
          >
            <ChevronLeft className="h-5 w-5" aria-hidden />
            <span className="max-w-36 truncate sm:max-w-none">{backLabel}</span>
          </Link>
        ) : null}
        <BrandHomeLink href={brandHref} className="shrink-0" />
        {title ? (
          <>
            <span className="hidden text-ink-subtle sm:inline" aria-hidden>
              /
            </span>
            <span className="hidden truncate text-sm font-medium text-ink-muted sm:inline">
              {title}
            </span>
          </>
        ) : null}
        {children ? (
          <div className="ml-auto flex min-w-0 items-center gap-2">{children}</div>
        ) : null}
      </div>
    </GlassNav>
  );
}

export function BackLink({
  href,
  label = "Back",
  className,
}: {
  href: string;
  label?: string;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex min-h-11 items-center gap-0.5 text-sm font-semibold text-ink-muted transition-colors hover:text-accent-ink",
        className
      )}
    >
      <ChevronLeft className="h-5 w-5 shrink-0" aria-hidden />
      {label}
    </Link>
  );
}
