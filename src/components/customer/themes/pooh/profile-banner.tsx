"use client";

import { HoneyPotMark } from "@/components/customer/themes/pooh/marks";

export function PoohProfileBanner({
  firstName,
}: {
  firstName?: string | null;
}) {
  const name = (firstName || "").trim();
  return (
    <div className="mb-6 overflow-hidden rounded-2xl border border-[rgba(163,95,8,0.16)] bg-gradient-to-br from-[#fff8ea] via-[#ffe9b8]/70 to-[#fff3dc] px-4 py-4">
      <div className="flex items-center gap-3">
        <HoneyPotMark size={44} className="pooh-float shrink-0" />
        <div className="min-w-0">
          <p className="text-sm font-semibold text-[#8a4f07]">
            {name ? `${name}'s corner` : "Your corner"}
          </p>
          <p className="mt-1 text-xs leading-relaxed text-ink-muted">
            A private storybook look, just for this account.
          </p>
        </div>
      </div>
    </div>
  );
}
