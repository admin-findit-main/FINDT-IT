"use client";

import { cn } from "@/lib/utils";

export function IosSwitch({
  checked,
  onCheckedChange,
  disabled = false,
  label,
  decorative = false,
}: {
  checked: boolean;
  onCheckedChange?: (next: boolean) => void;
  disabled?: boolean;
  label: string;
  /** When the parent row owns the tap. */
  decorative?: boolean;
}) {
  const className = cn(
    "relative isolate h-[31px] w-[51px] shrink-0 rounded-full p-[2px]",
    "transition-colors duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
    checked ? "bg-[#34C759] dark:bg-[#30D158]" : "bg-[#E9E9EA] dark:bg-[#39393D]",
    disabled && "opacity-50",
    !decorative &&
      "cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-ring"
  );
  const thumb = (
    <>
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-full ring-1 ring-inset ring-black/[0.04] dark:ring-white/12"
      />
      <span
        className={cn(
          "relative block h-[27px] w-[27px] rounded-full bg-white",
          "shadow-[0_3px_8px_rgba(0,0,0,0.15),0_1px_1px_rgba(0,0,0,0.08)]",
          "transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
          checked ? "translate-x-5" : "translate-x-0"
        )}
      />
    </>
  );

  if (decorative) {
    return (
      <span className={className} aria-hidden>
        {thumb}
      </span>
    );
  }

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={onCheckedChange ? () => onCheckedChange(!checked) : undefined}
      className={className}
    >
      {thumb}
    </button>
  );
}
