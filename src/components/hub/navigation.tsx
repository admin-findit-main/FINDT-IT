"use client";

import { useState } from "react";
import {
  Clock3,
  MessageCircle,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
  UserRound,
  type LucideIcon,
} from "lucide-react";

export type HubSection = "customers" | "requests" | "history" | "settings";

const ITEMS: { id: HubSection; label: string; icon: LucideIcon }[] = [
  { id: "customers", label: "Customers", icon: UserRound },
  { id: "requests", label: "Requests", icon: MessageCircle },
  { id: "history", label: "History", icon: Clock3 },
  { id: "settings", label: "Settings", icon: Settings },
];

export function HubNavigation({
  active,
  waitingCount,
  onChange,
}: {
  active: HubSection;
  waitingCount: number;
  onChange: (section: HubSection) => void;
}) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      className={`z-20 flex shrink-0 bg-[#171315] text-white transition-[width] duration-300 ease-in-out md:flex-col md:border-r md:border-black/10 ${
        collapsed ? "md:w-20" : "md:w-60"
      }`}
    >
      <nav
        aria-label="Hub navigation"
        className="grid w-full grid-cols-4 gap-1 p-2 [@media(max-height:500px)]:p-1 md:flex md:flex-1 md:flex-col md:gap-2 md:p-4 [@media(max-height:500px)]:md:p-2"
      >
        {ITEMS.map((item) => {
          const Icon = item.icon;
          const selected = item.id === active;
          return (
            <button
              key={item.id}
              type="button"
              aria-current={selected ? "page" : undefined}
              aria-label={item.label}
              onClick={() => onChange(item.id)}
              className={`relative flex min-h-14 items-center justify-center gap-3 rounded-xl px-3 text-sm font-semibold transition-colors [@media(max-height:500px)]:min-h-11 md:min-h-14 ${
                collapsed ? "md:px-0" : "md:justify-start md:px-4"
              } ${
                selected
                  ? "bg-white text-[#171315]"
                  : "text-white/70 hover:bg-white/10 hover:text-white"
              }`}
            >
              <Icon className="h-5 w-5 shrink-0" />
              {!collapsed ? (
                <span className="hidden whitespace-nowrap md:inline">
                  {item.label}
                </span>
              ) : null}
              <span className="text-[10px] md:hidden">{item.label}</span>
              {item.id === "requests" && waitingCount > 0 ? (
                <span
                  className={`absolute right-2 top-1.5 min-h-5 min-w-5 place-items-center rounded-full bg-[#B42332] px-1 text-[10px] font-bold leading-none text-white ${
                    collapsed ? "grid md:hidden" : "grid md:static md:ml-auto"
                  }`}
                >
                  {waitingCount > 99 ? "99+" : waitingCount}
                </span>
              ) : null}
            </button>
          );
        })}
      </nav>
      <div className="hidden border-t border-white/10 p-3 md:block">
        <button
          type="button"
          aria-label={collapsed ? "Expand Hub sidebar" : "Collapse Hub sidebar"}
          aria-expanded={!collapsed}
          onClick={() => setCollapsed((value) => !value)}
          className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl text-sm font-semibold text-white/70 transition-colors hover:bg-white/10 hover:text-white"
        >
          {collapsed ? (
            <PanelLeftOpen className="h-5 w-5" />
          ) : (
            <>
              <PanelLeftClose className="h-5 w-5" />
              <span>Collapse</span>
            </>
          )}
        </button>
        {!collapsed ? (
          <p className="mt-3 whitespace-nowrap text-center text-xs text-white/50">
            Powered by FINDIT+
          </p>
        ) : null}
      </div>
    </aside>
  );
}
