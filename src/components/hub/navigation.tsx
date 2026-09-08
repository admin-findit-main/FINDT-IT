"use client";

import {
  Clock3,
  MessageCircle,
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
  return (
    <aside className="z-20 flex shrink-0 bg-[#171315] text-white md:w-60 md:flex-col md:border-r md:border-black/10">
      <nav
        aria-label="Hub navigation"
        className="grid w-full grid-cols-4 gap-1 p-2 md:flex md:flex-col md:gap-2 md:p-4"
      >
        {ITEMS.map((item) => {
          const Icon = item.icon;
          const selected = item.id === active;
          return (
            <button
              key={item.id}
              type="button"
              aria-current={selected ? "page" : undefined}
              onClick={() => onChange(item.id)}
              className={`relative flex min-h-14 items-center justify-center gap-3 rounded-xl px-3 text-sm font-semibold transition-colors md:min-h-14 md:justify-start md:px-4 ${
                selected
                  ? "bg-white text-[#171315]"
                  : "text-white/70 hover:bg-white/10 hover:text-white"
              }`}
            >
              <Icon className="h-5 w-5 shrink-0" />
              <span className="hidden md:inline">{item.label}</span>
              <span className="text-[10px] md:hidden">{item.label}</span>
              {item.id === "requests" && waitingCount > 0 ? (
                <span className="absolute right-2 top-1.5 grid min-h-5 min-w-5 place-items-center rounded-full bg-[#B42332] px-1 text-[10px] font-bold leading-none text-white md:static md:ml-auto">
                  {waitingCount > 99 ? "99+" : waitingCount}
                </span>
              ) : null}
            </button>
          );
        })}
      </nav>
    </aside>
  );
}
