"use client";

/** Compact one-line greeting so the Find home stays locked to the viewport. */
export function PoohHomeGreeting({
  firstName,
}: {
  firstName?: string | null;
}) {
  const name = (firstName || "").trim();
  return (
    <p className="mt-2 text-sm font-medium text-[#8a4f07]">
      {name ? `Hi ${name}` : "Hi there"}
      <span className="font-normal text-ink-muted"> · a cozy Find</span>
    </p>
  );
}
