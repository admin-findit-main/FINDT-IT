"use client";

import { SoftBearMark } from "@/components/customer/themes/pooh/marks";

export function PoohHomeGreeting({
  firstName,
}: {
  firstName?: string | null;
}) {
  const name = (firstName || "").trim();
  return (
    <div className="mb-5 flex items-start gap-3 rounded-2xl border border-[rgba(163,95,8,0.14)] bg-[#fff8ea]/90 px-4 py-3 shadow-[0_8px_24px_rgba(163,95,8,0.08)]">
      <span className="pooh-float mt-0.5 shrink-0">
        <SoftBearMark size={40} />
      </span>
      <div className="min-w-0">
        <p className="text-[12px] font-semibold tracking-[0.12em] text-[#A35F08]">
          A cozy Find
        </p>
        <p className="mt-1 text-sm leading-relaxed text-ink">
          {name ? `Hi ${name}. ` : null}
          Ask nearby stores with a little extra warmth today.
        </p>
      </div>
    </div>
  );
}
