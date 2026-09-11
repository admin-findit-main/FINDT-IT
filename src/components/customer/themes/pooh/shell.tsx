"use client";

import { useState, type ReactNode } from "react";
import { toast } from "sonner";
import { HoneyPotMark, SoftBearMark } from "@/components/customer/themes/pooh/marks";
import "./theme.css";

export function PoohThemeShell({ children }: { children: ReactNode }) {
  const [taps, setTaps] = useState(0);

  return (
    <div data-customer-theme="pooh" className="relative min-h-dvh">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 z-0 h-40 overflow-hidden"
      >
        <div className="pooh-float absolute -left-2 top-8 opacity-80">
          <HoneyPotMark size={48} />
        </div>
        <div className="pooh-float absolute right-3 top-10 opacity-75 [animation-delay:1.2s]">
          <SoftBearMark size={44} />
        </div>
      </div>

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

      <div className="relative z-10">{children}</div>
    </div>
  );
}
