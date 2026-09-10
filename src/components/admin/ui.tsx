import Link from "next/link";
import { cn } from "@/lib/utils";

export function AdminPage({
  title,
  subtitle,
  actions,
  children,
}: {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="admin-page space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-ink">{title}</h1>
          {subtitle ? (
            <p className="mt-1 max-w-2xl text-sm text-ink-muted">{subtitle}</p>
          ) : null}
        </div>
        {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
      </div>
      {children}
    </div>
  );
}

export function AdminStat({
  label,
  value,
  hint,
  href,
  tone = "default",
}: {
  label: string;
  value: string | number;
  hint?: string;
  href?: string;
  tone?: "default" | "accent" | "ok" | "warn";
}) {
  const body = (
    <>
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-subtle">
        {label}
      </p>
      <p
        className={cn(
          "mt-2 text-2xl font-bold tabular-nums tracking-[-0.03em]",
          tone === "accent" && "text-[#C81109]",
          tone === "ok" && "text-[#0B7A3B]",
          tone === "warn" && "text-[#A15C00]"
        )}
      >
        {value}
      </p>
      {hint ? <p className="mt-1 text-[11px] text-ink-muted">{hint}</p> : null}
    </>
  );
  const className =
    "rounded-2xl border border-hairline-strong bg-white px-4 py-3.5 transition";
  if (href) {
    return (
      <Link href={href} className={cn(className, "hover:border-black/20 hover:shadow-sm")}>
        {body}
      </Link>
    );
  }
  return <div className={className}>{body}</div>;
}

export function AdminPanel({
  title,
  action,
  children,
  className,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "rounded-2xl border border-hairline-strong bg-white shadow-[0_1px_0_rgba(23,19,21,0.04)]",
        className
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-hairline-strong px-4 py-3.5">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-subtle">
          {title}
        </h2>
        {action}
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}

export function AdminEmpty({
  title,
  body,
}: {
  title: string;
  body?: string;
}) {
  return (
    <div className="rounded-xl border border-dashed border-hairline-strong px-4 py-10 text-center">
      <p className="text-sm font-semibold text-ink">{title}</p>
      {body ? <p className="mt-1 text-sm text-ink-muted">{body}</p> : null}
    </div>
  );
}

export function AdminQuickLink({
  href,
  label,
  body,
}: {
  href: string;
  label: string;
  body: string;
}) {
  return (
    <Link
      href={href}
      className="block rounded-xl border border-hairline-strong bg-[var(--solid-chrome)] px-3.5 py-3 transition hover:border-black/15 hover:bg-white"
    >
      <span className="block text-sm font-semibold text-ink">{label}</span>
      <span className="mt-0.5 block text-xs text-ink-muted">{body}</span>
    </Link>
  );
}
