"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  BarChart3,
  Bell,
  Building2,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  Cpu,
  CreditCard,
  FileWarning,
  LayoutDashboard,
  Menu,
  MessageSquareReply,
  Monitor,
  PackageSearch,
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
import { toPublicPath, toInternalPath, matchProductSurface } from "@/lib/config/product-hosts";
import {
  dashItemActive,
  dashTitle,
  STORE_PROFILE_MENU,
  type DashItem,
} from "@/lib/dashboard/nav";
import { resolveBrandHomeHref } from "@/lib/config/product-hosts";

const ICONS: Record<DashItem["icon"], typeof LayoutDashboard> = {
  overview: LayoutDashboard,
  requests: PackageSearch,
  responses: MessageSquareReply,
  demand: BarChart3,
  staff: Users,
  hub: Tablet,
  devices: Monitor,
  store: Store,
  plan: CreditCard,
  alerts: Bell,
  account: User,
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
  accountHref,
  storeProfileHref,
  logoutHref = "/login/business",
  children,
}: {
  tone?: "business" | "admin";
  identity: string;
  role: string;
  email: string | null;
  items: DashItem[];
  accountHref: string;
  storeProfileHref?: string;
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
  const onStoreProfile = Boolean(
    storeProfileHref && internalPath.startsWith("/store/settings")
  );
  const [profileMenuOpen, setProfileMenuOpen] = useState(onStoreProfile);
  const { title, subtitle } = dashTitle(internalPath);
  const isAdmin = tone === "admin";
  const publicAccountHref = toPublicPath(surface, accountHref);
  const publicLogoutHref = toPublicPath(surface, logoutHref);
  const publicStoreProfileHref = storeProfileHref
    ? toPublicPath(surface, storeProfileHref)
    : "";

  useEffect(() => {
    if (onStoreProfile) setProfileMenuOpen(true);
  }, [onStoreProfile]);

  async function logout() {
    await signOutAction();
    router.push(publicLogoutHref);
    router.refresh();
  }

  const nav = (
    <nav className="flex flex-1 flex-col gap-0.5 px-2">
      {items.map((item) => {
        const Icon = ICONS[item.icon];
        const active = dashItemActive(internalPath, item.href);
        return (
          <Link
            key={item.href}
            href={toPublicPath(surface, item.href)}
            onClick={() => setDrawer(false)}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex min-h-10 items-center gap-3 rounded-xl px-3 text-sm font-medium transition-colors",
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

  return (
    <div className="app-canvas min-h-dvh bg-canvas text-ink">
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
          "fixed inset-y-0 left-0 z-50 flex flex-col border-r border-hairline-strong bg-white transition-[width,transform] duration-200",
          collapsed ? "w-[72px]" : "w-[240px]",
          drawer ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        )}
      >
        <div className={cn("flex h-14 items-center gap-2 px-4", collapsed && "justify-center px-0")}>
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
              <BrandLogo kind="business" className="h-6 w-auto" />
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
            className="ml-auto grid h-8 w-8 place-items-center rounded-lg md:hidden"
            onClick={() => setDrawer(false)}
            aria-label="Close menu"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        {nav}
        <div
          className={cn(
            "mt-auto border-t border-hairline-strong p-3",
          )}
        >
          {storeProfileHref ? (
            collapsed ? (
              <Link
                href={publicStoreProfileHref}
                title="Store profile"
                onClick={() => setDrawer(false)}
                className={cn(
                  "mb-1 grid h-10 place-items-center rounded-xl hover:bg-black/[0.04]",
                  onStoreProfile && "bg-black/[0.06]"
                )}
              >
                <Store className="h-4 w-4" />
              </Link>
            ) : (
              <div className="mb-1">
                <button
                  type="button"
                  aria-expanded={profileMenuOpen}
                  onClick={() => setProfileMenuOpen((open) => !open)}
                  className={cn(
                    "flex w-full items-center justify-between gap-2 rounded-xl px-2 py-2 text-left hover:bg-black/[0.04]",
                    onStoreProfile && "bg-black/[0.06]"
                  )}
                >
                  <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-ink">
                    Store profile
                  </span>
                  <ChevronDown
                    className={cn(
                      "h-4 w-4 shrink-0 text-ink-muted transition-transform",
                      profileMenuOpen && "rotate-180"
                    )}
                  />
                </button>
                {profileMenuOpen ? (
                  <div className="mt-0.5 space-y-0.5 pb-1">
                    {STORE_PROFILE_MENU.map((item) => (
                      <Link
                        key={item.href}
                        href={toPublicPath(surface, item.href)}
                        onClick={() => {
                          setDrawer(false);
                          if (internalPath.startsWith("/store/settings")) {
                            requestAnimationFrame(() => {
                              window.dispatchEvent(new Event("hashchange"));
                            });
                          }
                        }}
                        className="flex min-h-9 items-center justify-between gap-2 rounded-xl px-3 text-sm text-ink-muted hover:bg-black/[0.04] hover:text-ink"
                      >
                        {item.label}
                        <ChevronRight className="h-4 w-4 shrink-0 text-ink-subtle" />
                      </Link>
                    ))}
                  </div>
                ) : null}
              </div>
            )
          ) : null}
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
              "mt-1 w-full rounded-xl px-3 py-2 text-left text-sm text-ink-muted hover:bg-black/[0.04] hover:text-ink",
              collapsed && "text-center"
            )}
          >
            {collapsed ? "Out" : "Log out"}
          </button>
        </div>
      </aside>

      <div className={cn("min-h-dvh", collapsed ? "md:pl-[72px]" : "md:pl-[240px]")}>
        <header className="glass-chrome sticky top-0 z-40 flex h-14 items-center gap-3 border-b border-hairline-strong px-4 md:px-8">
          <button
            type="button"
            className="grid h-9 w-9 place-items-center rounded-lg hover:bg-black/[0.04] md:hidden"
            onClick={() => setDrawer(true)}
            aria-label="Open menu"
          >
            <Menu className="h-4 w-4" />
          </button>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-sm font-semibold tracking-tight">{title}</h1>
            {subtitle ? (
              <p className="truncate text-[12px] text-ink-muted">{subtitle}</p>
            ) : null}
          </div>
          <div className="hidden items-center gap-2 text-xs text-ink-muted sm:flex">
            <Shield className="h-3.5 w-3.5" />
            {identity}
          </div>
        </header>
        <main className="px-4 py-5 md:px-8 md:py-6">{children}</main>
      </div>
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
    <div className="rounded-xl border border-hairline-strong bg-white px-4 py-3">
      <p className="text-[11px] font-medium text-ink-muted">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums tracking-tight">{value}</p>
      {hint ? <p className="mt-0.5 text-[11px] text-ink-muted">{hint}</p> : null}
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
      <div className="flex items-center justify-between gap-3 border-b border-hairline-strong px-4 py-3">
        <h2 className="text-sm font-semibold">{title}</h2>
        {action}
      </div>
      <div className="p-4">{children}</div>
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
