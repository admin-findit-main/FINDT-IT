"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bell,
  Home,
  PackageSearch,
  User,
  Store,
  ChartNoAxesCombined,
  Settings,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { AppHeader } from "@/components/shared/app-header";
import { GlassTabBar } from "@/components/ui/glass";
import { roleLabel } from "@/lib/auth/store-role";
import type { StoreMemberRole } from "@/types/database";

const customerItems = [
  { href: "/home", label: "Home", icon: Home },
  { href: "/requests", label: "Requests", icon: PackageSearch },
  { href: "/notifications", label: "Alerts", icon: Bell },
  { href: "/profile", label: "Profile", icon: User },
];

type StoreNavItem = {
  href: string;
  label: string;
  icon: typeof PackageSearch;
};

function ownerStoreItems(): StoreNavItem[] {
  return [
    { href: "/store", label: "Requests", icon: PackageSearch },
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
    { href: "/store/notifications", label: "Alerts", icon: Bell },
    { href: "/store/account", label: "Account", icon: User },
  ];
}

/** Mobile: keep primary actions; Account always reachable for logout. */
function ownerMobileItems(): StoreNavItem[] {
  return [
    { href: "/store", label: "Requests", icon: PackageSearch },
    { href: "/store/demand", label: "Demand", icon: ChartNoAxesCombined },
    { href: "/store/team", label: "Team", icon: Users },
    { href: "/store/account", label: "Account", icon: User },
  ];
}

function isCustomerActive(pathname: string, href: string) {
  if (href === "/home") return pathname === "/home";
  return pathname === href || pathname.startsWith(href + "/");
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

export function CustomerTopBar() {
  const pathname = usePathname();
  return (
    <AppHeader brandHref="/home" className="z-40">
      <nav className="hidden items-center gap-1 md:flex" aria-label="Customer">
        {customerItems.map((item) => {
          const active = isCustomerActive(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "glass-press rounded-glass-md px-3 py-2 text-sm font-semibold transition-colors",
                active
                  ? "bg-accent text-ink-inverse shadow-accent"
                  : "text-ink-muted hover:bg-glass-2 hover:text-ink"
              )}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
    </AppHeader>
  );
}

export function CustomerNav() {
  const pathname = usePathname();
  return (
    <GlassTabBar className="md:hidden" aria-label="Customer">
      <ul className="mx-auto flex max-w-lg items-stretch justify-around px-2 pb-[env(safe-area-inset-bottom)]">
        {customerItems.map((item) => (
          <TabBarItem
            key={item.href}
            {...item}
            active={isCustomerActive(pathname, item.href)}
          />
        ))}
      </ul>
    </GlassTabBar>
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
  const items = canManageStore ? ownerStoreItems() : employeeStoreItems();
  const mobileItems = canManageStore ? ownerMobileItems() : employeeStoreItems();

  return (
    <>
      <aside className="glass-chrome hidden border-r border-hairline-strong md:sticky md:top-0 md:flex md:h-screen md:w-60 md:flex-col md:px-4 md:py-6">
        <Link
          href="/store"
          className="mb-2 flex items-center gap-1.5 px-3 text-xl font-bold tracking-tight text-ink"
          aria-label="Store home"
        >
          FINDIT
          <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-accent" />
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
            const active = isStoreActive(pathname, item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "glass-press flex min-h-11 items-center gap-3 rounded-glass-lg px-3 py-2.5 text-sm font-semibold transition-colors",
                  active
                    ? "bg-accent text-ink-inverse shadow-accent"
                    : "text-ink-muted hover:bg-glass-2 hover:text-ink"
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
              active={isStoreActive(pathname, item.href)}
            />
          ))}
        </ul>
      </GlassTabBar>
    </>
  );
}
