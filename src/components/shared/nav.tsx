"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bell,
  PackageSearch,
  User,
  Store,
  ChartNoAxesCombined,
  Settings,
  Tablet,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { AppHeader } from "@/components/shared/app-header";
import { BrandLogo } from "@/components/brand/logo";
import { GlassTabBar } from "@/components/ui/glass";
import { roleLabel } from "@/lib/auth/store-role";
import { useHostSurface } from "@/components/host/host-surface";
import {
  matchProductSurface,
  toInternalPath,
  toPublicPath,
} from "@/lib/config/product-hosts";
import type { StoreMemberRole } from "@/types/database";

type StoreNavItem = {
  href: string;
  label: string;
  icon: typeof PackageSearch;
};

function ownerStoreItems(): StoreNavItem[] {
  return [
    { href: "/store", label: "Requests", icon: PackageSearch },
    { href: "/store/hub", label: "Hub", icon: Tablet },
    { href: "/store/demand", label: "Demand", icon: ChartNoAxesCombined },
    { href: "/store/notifications", label: "Alerts", icon: Bell },
    { href: "/store/settings", label: "Store", icon: Store },
    { href: "/store/team", label: "Team", icon: Users },
    { href: "/store/account", label: "Account", icon: Settings },
  ];
}

function employeeStoreItems(): StoreNavItem[] {
  return [
    { href: "/store", label: "Requests", icon: PackageSearch },
    { href: "/store/hub", label: "Hub", icon: Tablet },
    { href: "/store/notifications", label: "Alerts", icon: Bell },
    { href: "/store/account", label: "Account", icon: User },
  ];
}

/** Mobile: keep primary actions; Account always reachable for logout. */
function ownerMobileItems(): StoreNavItem[] {
  return [
    { href: "/store/hub", label: "Hub", icon: Tablet },
    { href: "/store", label: "Requests", icon: PackageSearch },
    { href: "/store/team", label: "Team", icon: Users },
    { href: "/store/account", label: "Account", icon: User },
  ];
}

function isStoreActive(pathname: string, href: string) {
  if (href === "/store") {
    return pathname === "/store" || pathname.startsWith("/store/requests");
  }
  return pathname === href || pathname.startsWith(href + "/");
}

/** Shared tab-bar item: icon over label, with a red dot marking the active tab. */
function TabBarItem({
  href,
  label,
  icon: Icon,
  active,
}: StoreNavItem & { active: boolean }) {
  return (
    <li className="flex-1">
      <Link
        href={href}
        aria-current={active ? "page" : undefined}
        className={cn(
          "glass-press relative flex min-h-14 flex-col items-center justify-center gap-1 py-2 text-[11px] font-semibold transition-colors",
          active ? "text-accent-ink" : "text-ink-subtle hover:text-ink"
        )}
      >
        <Icon className="h-5 w-5" strokeWidth={active ? 2.4 : 2} />
        {label}
        {active ? (
          <span
            aria-hidden
            className="absolute inset-x-4 top-0 h-0.5 rounded-full bg-accent"
          />
        ) : null}
      </Link>
    </li>
  );
}

type StoreChromeProps = {
  storeName: string | null;
  role: StoreMemberRole;
  canManageStore: boolean;
};

export function StoreTopBar({ storeName, role }: StoreChromeProps) {
  return (
    <AppHeader
      brandHref="/store"
      className="z-40 md:hidden"
      contentClassName="max-w-3xl md:max-w-3xl"
    >
      <p className="max-w-56 truncate text-right text-[11px] font-medium leading-tight text-ink-muted">
        Working as {storeName || "Store"}
        <span className="block font-semibold text-ink">{roleLabel(role)}</span>
      </p>
    </AppHeader>
  );
}

export function StoreNav({ storeName, role, canManageStore }: StoreChromeProps) {
  const pathname = usePathname();
  const contextSurface = useHostSurface();
  const surface =
    typeof window !== "undefined"
      ? matchProductSurface(window.location.host)
      : contextSurface;
  const internalPath = toInternalPath(surface, pathname);
  const items = canManageStore ? ownerStoreItems() : employeeStoreItems();
  const mobileItems = canManageStore ? ownerMobileItems() : employeeStoreItems();

  return (
    <>
      <aside className="glass-chrome hidden border-r border-hairline-strong md:sticky md:top-0 md:flex md:h-screen md:w-60 md:flex-col md:px-4 md:py-6">
        <Link
          href={toPublicPath(surface, "/store")}
          className="mb-3 flex items-center px-3"
          aria-label="FINDIT Business"
        >
          <BrandLogo kind="business" className="h-6 w-auto" />
        </Link>
        <p className="mb-6 px-3 text-xs leading-snug text-ink-muted">
          Working as{" "}
          <span className="font-semibold text-ink">{storeName || "Store"}</span>
          <span className="mt-0.5 block font-semibold text-accent-ink">
            {roleLabel(role)}
          </span>
        </p>
        <nav className="flex flex-col gap-1" aria-label="Store">
          {items.map((item) => {
            const active = isStoreActive(internalPath, item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={toPublicPath(surface, item.href)}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "glass-press flex min-h-11 items-center gap-3 rounded-glass-lg px-3 py-2.5 text-sm font-semibold transition-colors",
                  active
                    ? "bg-black/[0.06] text-ink"
                    : "text-ink-muted hover:bg-black/[0.04] hover:text-ink"
                )}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>
      <GlassTabBar className="md:hidden" aria-label="Store">
        <ul className="mx-auto flex max-w-lg items-stretch justify-around px-2 pb-[env(safe-area-inset-bottom)]">
          {mobileItems.map((item) => (
            <TabBarItem
              key={item.href}
              {...item}
              active={isStoreActive(internalPath, item.href)}
              href={toPublicPath(surface, item.href)}
            />
          ))}
        </ul>
      </GlassTabBar>
    </>
  );
}
