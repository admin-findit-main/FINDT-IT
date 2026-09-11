"use client";

import { useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { toast } from "sonner";
import { HoneyPotMark } from "@/components/customer/themes/pooh/marks";
import "./theme.css";

export function PoohThemeShell({ children }: { children: ReactNode }) {
  const [taps, setTaps] = useState(0);
  const pathname = usePathname();
  const path = (pathname || "").replace(/\/$/, "") || "/";
  const findHome = path === "/home" || path.endsWith("/home");

  return (
    <div
      data-customer-theme="pooh"
      className={findHome ? "relative h-dvh overflow-hidden" : "relative min-h-dvh"}
    >
      {!findHome ? (
        <button
          type="button"
          aria-label="A little honey"
          className="pooh-float absolute bottom-[max(1rem,env(safe-area-inset-bottom))] right-3 z-20 rounded-full border border-[rgba(163,95,8,0.18)] bg-[#fff8ea]/90 p-2 shadow-[0_6px_18px_rgba(163,95,8,0.14)] backdrop-blur-sm"
          onClick={() => {
            const next = taps + 1;
            setTaps(next);
            if (next >= 5) {
              setTaps(0);
              toast.message("A little something sweet", {
                description: "Just for you.",
              });
            }
          }}
        >
          <HoneyPotMark size={28} />
        </button>
      ) : (
        <button
          type="button"
          aria-label="A little honey"
          className="absolute right-3 top-[max(0.65rem,env(safe-area-inset-top))] z-20 rounded-full border border-[rgba(163,95,8,0.18)] bg-[#fff8ea]/90 p-1.5 shadow-[0_4px_12px_rgba(163,95,8,0.12)] backdrop-blur-sm"
          onClick={() => {
            const next = taps + 1;
            setTaps(next);
            if (next >= 5) {
              setTaps(0);
              toast.message("A little something sweet", {
                description: "Just for you.",
              });
            }
          }}
        >
          <HoneyPotMark size={22} />
        </button>
      )}

      <div className={findHome ? "relative z-10 h-full" : "relative z-10"}>
        {children}
      </div>
    </div>
  );
}
