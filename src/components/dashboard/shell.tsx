"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import {
  BarChart3,
  Bell,
  Building2,
  CalendarClock,
  ClipboardList,
  Cpu,
  CreditCard,
  FileWarning,
  LayoutDashboard,
  Menu,
  MessageSquareReply,
  Monitor,
  PackageSearch,
  Settings,
  Shield,
  Store,
  Tablet,
  User,
  Users,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { signOutAction } from "@/lib/services/actions";
import { BrandLogo } from "@/components/brand/logo";
import { useHostSurface } from "@/components/host/host-surface";
import {
  matchProductSurface,
  resolveBrandHomeHref,
  toInternalPath,
  toPublicPath,
} from "@/lib/config/product-hosts";
import {
  dashItemActive,
  dashTitle,
  type DashItem,
} from "@/lib/dashboard/nav";
import { GlassTabBar } from "@/components/ui/glass";

const ICONS: Record<DashItem["icon"], typeof LayoutDashboard> = {
  overview: LayoutDashboard,
  requests: PackageSearch,
  responses: MessageSquareReply,
  demand: BarChart3,
  staff: Users,
  hub: Tablet,
  shifts: CalendarClock,
  devices: Monitor,
  store: Store,
  plan: CreditCard,
  alerts: Bell,
  account: User,
  settings: Settings,
  applications: ClipboardList,
  stores: Building2,
  users: Users,
  analytics: BarChart3,
  reports: FileWarning,
  system: Cpu,
};

export function DashboardShell({
  tone = "business",
  identity,
  role,
  email,
  items,
  mobileItems,
  accountHref,
  logoutHref = "/login/business",
  children,
}: {
  tone?: "business" | "admin";
  identity: string;
  role: string;
  email: string | null;
  items: DashItem[];
  mobileItems?: DashItem[];
  accountHref: string;
  logoutHref?: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const contextSurface = useHostSurface();
  const surface =
    typeof window !== "undefined"
      ? matchProductSurface(window.location.host)
      : contextSurface;
  const internalPath = toInternalPath(surface, pathname);
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const { title, subtitle } = dashTitle(internalPath);
  const isAdmin = tone === "admin";
  const publicAccountHref = toPublicPath(surface, accountHref);
  const publicLogoutHref = toPublicPath(surface, logoutHref);

  async function logout() {
    await signOutAction();
    router.push(publicLogoutHref);
    router.refresh();
  }

  const nav = (
    <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto overscroll-contain px-2 py-1">
      {items.map((item) => {
        const Icon = ICONS[item.icon];
        const active = dashItemActive(internalPath, item.href);
        return (
          <Link
            key={item.href}
            href={toPublicPath(surface, item.href)}
            prefetch
            onClick={() => setDrawer(false)}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium transition-colors",
              active
                ? "bg-black/[0.06] text-ink"
                : "text-ink-muted hover:bg-black/[0.04] hover:text-ink",
              collapsed && "justify-center px-0"
            )}
            title={collapsed ? item.label : undefined}
          >
            <Icon className="h-4 w-4 shrink-0" strokeWidth={active ? 2.4 : 2} />
            {collapsed ? null : item.label}
          </Link>
        );
      })}
    </nav>
  );

  const hasMobileTabs = Boolean(mobileItems?.length);

  return (
    <div className="app-canvas min-h-dvh overflow-x-clip bg-canvas text-ink">
      {drawer ? (
        <button
          type="button"
          aria-label="Close menu"
          className="fixed inset-0 z-40 bg-black/30 md:hidden"
          onClick={() => setDrawer(false)}
        />
      ) : null}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-[min(20rem,calc(100vw-2.75rem))] flex-col border-r border-hairline-strong bg-white pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] transition-[width,transform] duration-200 md:w-[240px]",
          collapsed && "md:w-[72px]",
          drawer ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        )}
      >
        <div className={cn("flex h-14 shrink-0 items-center gap-2 px-4", collapsed && "md:justify-center md:px-0")}>
          <Link
            href={resolveBrandHomeHref({
              surface,
              pathname: internalPath,
              hostHeader: typeof window !== "undefined" ? window.location.host : undefined,
            })}
            className={cn("flex min-w-0 items-center", collapsed && "justify-center")}
            aria-label={isAdmin ? "FINDIT Admin" : "FINDIT Business"}
          >
            {collapsed ? (
              <BrandLogo kind="mark" className="h-8 w-auto" alt="" />
            ) : isAdmin ? (
              <span className="inline-flex items-center gap-2">
                <BrandLogo kind="mark" className="h-7 w-auto" alt="" />
                <span className="text-[15px] font-semibold tracking-tight">Admin</span>
              </span>
            ) : (
              <BrandLogo kind="business" className="h-7" />
            )}
          </Link>
          <button
            type="button"
            className={cn(
              "ml-auto hidden h-8 w-8 items-center justify-center rounded-lg text-ink-subtle hover:bg-black/[0.04] md:flex",
            )}
            onClick={() => setCollapsed((v) => !v)}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            <Menu className="h-4 w-4" />
          </button>
          <button
            type="button"
            className="ml-auto grid h-11 w-11 place-items-center rounded-lg md:hidden"
            onClick={() => setDrawer(false)}
            aria-label="Close menu"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        {nav}
        <div
          className={cn(
            "mt-auto overflow-y-auto border-t border-hairline-strong p-3",
          )}
        >
          <Link
            href={publicAccountHref}
            className={cn(
              "flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-black/[0.04]",
              collapsed && "justify-center px-0"
            )}
          >
            <span
              className={cn(
                "grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[var(--fd-black)] text-[11px] font-semibold text-ink-inverse",
              )}
            >
              {(identity || email || "F").slice(0, 1).toUpperCase()}
            </span>
            {collapsed ? null : (
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium">{identity}</span>
                <span
                  className={cn(
                    "block truncate text-xs text-ink-muted"
                  )}
                >
                  {role}
                </span>
              </span>
            )}
          </Link>
          <button
            type="button"
            onClick={logout}
            className={cn(
              "mt-1 flex min-h-11 w-full items-center rounded-xl px-3 py-2 text-left text-sm text-ink-muted hover:bg-black/[0.04] hover:text-ink",
              collapsed && "text-center"
            )}
          >
            {collapsed ? "Out" : "Log out"}
          </button>
        </div>
      </aside>

      <div className={cn("min-h-dvh", collapsed ? "md:pl-[72px]" : "md:pl-[240px]")}>
        <header className="glass-chrome sticky top-0 z-30 border-b border-hairline-strong px-3 pt-[env(safe-area-inset-top)] md:px-8">
          <div className="flex min-h-14 items-center gap-2 sm:gap-3">
            <button
              type="button"
              className="grid h-11 w-11 shrink-0 place-items-center rounded-xl hover:bg-black/[0.04] md:hidden"
              onClick={() => setDrawer(true)}
              aria-label="Open menu"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="min-w-0 flex-1">
              <h1 className="truncate text-[15px] font-semibold tracking-tight sm:text-sm">{title}</h1>
              {subtitle ? (
                <p className="truncate text-[11px] text-ink-muted sm:text-[12px]">{subtitle}</p>
              ) : null}
            </div>
            <div className="hidden max-w-[40%] items-center gap-2 truncate text-xs text-ink-muted sm:flex">
              <Shield className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{identity}</span>
            </div>
          </div>
        </header>
        <main
          className={cn(
            "px-4 pt-4 md:px-8 md:py-6",
            hasMobileTabs
              ? "pb-[calc(5.25rem+env(safe-area-inset-bottom))] md:pb-6"
              : "pb-[calc(1.25rem+env(safe-area-inset-bottom))] md:pb-6"
          )}
        >
          {children}
        </main>
      </div>

      {hasMobileTabs ? (
        <GlassTabBar className="z-30 md:hidden" aria-label={isAdmin ? "Admin" : "Store"}>
          <ul className="mx-auto flex max-w-lg items-stretch justify-around px-1 pb-[env(safe-area-inset-bottom)]">
            {mobileItems!.map((item) => {
              const Icon = ICONS[item.icon];
              const active = dashItemActive(internalPath, item.href);
              return (
                <li key={item.href} className="min-w-0 flex-1">
                  <Link
                    href={toPublicPath(surface, item.href)}
                    prefetch
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "relative flex min-h-14 flex-col items-center justify-center gap-0.5 px-0.5 py-2 text-[10px] font-semibold leading-tight sm:text-[11px]",
                      active ? "text-accent-ink" : "text-ink-subtle"
                    )}
                  >
                    <Icon className="h-5 w-5" strokeWidth={active ? 2.4 : 2} />
                    <span className="max-w-full truncate">{item.label}</span>
                    {active ? (
                      <span
                        aria-hidden
                        className="absolute inset-x-3 top-0 h-0.5 rounded-full bg-accent"
                      />
                    ) : null}
                  </Link>
                </li>
              );
            })}
          </ul>
        </GlassTabBar>
      ) : null}
    </div>
  );
}

export function MetricCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string | number;
  hint?: string;
}) {
  return (
    <div className="rounded-xl border border-hairline-strong bg-white px-3 py-3.5 sm:px-4">
      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-subtle">
        {label}
      </p>
      <p className="mt-2 text-2xl font-bold tabular-nums tracking-[-0.02em]">
        {value}
      </p>
      {hint ? <p className="mt-1 text-[11px] text-ink-muted">{hint}</p> : null}
    </div>
  );
}

export function Panel({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-hairline-strong bg-white">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-hairline-strong px-3 py-3 sm:px-4">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-subtle">
          {title}
        </h2>
        {action}
      </div>
      <div className="p-3 sm:p-4">{children}</div>
    </section>
  );
}

export function PendingNote({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-hairline-strong bg-white px-5 py-8 text-center">
      <p className="text-sm font-medium">Not available yet</p>
      <p className="mx-auto mt-2 max-w-md text-sm text-ink-muted">{children}</p>
    </div>
  );
}
