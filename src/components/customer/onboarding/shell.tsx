import { cn } from "@/lib/utils";

export function OnboardingShell({
  children,
  className,
}: {
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex min-h-dvh flex-col overflow-x-clip overflow-y-auto bg-canvas text-ink",
        "px-6 pt-[max(1.25rem,env(safe-area-inset-top))]",
        "pb-[max(1.25rem,env(safe-area-inset-bottom))]",
        className
      )}
    >
      {children}
    </div>
  );
}

export function OnboardingProgress({
  index,
  total,
}: {
  index: number;
  total: number;
}) {
  return (
    <div
      className="flex items-center justify-center gap-2"
      role="progressbar"
      aria-valuenow={index + 1}
      aria-valuemin={1}
      aria-valuemax={total}
      aria-label={`Step ${index + 1} of ${total}`}
    >
      {Array.from({ length: total }, (_, i) => (
        <span
          key={i}
          className={cn(
            "h-2 w-2 rounded-full transition-colors duration-300",
            i === index ? "bg-ink" : "bg-ink/20"
          )}
        />
      ))}
    </div>
  );
}

export function OnboardingEnter({
  stepKey,
  children,
}: {
  stepKey: string;
  children: React.ReactNode;
}) {
  return (
    <div key={stepKey} className="findit-onboard-enter flex min-h-0 flex-1 flex-col">
      {children}
    </div>
  );
}
