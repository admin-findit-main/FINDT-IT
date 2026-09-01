import { Bell, Search, Store } from "lucide-react";
import { Button } from "@/components/ui/button";

const STEPS = [
  {
    icon: Search,
    text: "Tell us what you're looking for.",
  },
  {
    icon: Store,
    text: "Nearby stores receive your request.",
  },
  {
    icon: Bell,
    text: "Get notified when a store responds.",
  },
] as const;

export function HowItWorksStep({ onNext }: { onNext: () => void }) {
  return (
    <div className="flex flex-1 flex-col">
      <div className="flex flex-1 flex-col justify-center">
        <h1 className="text-[2rem] font-bold leading-[1.12] tracking-tight text-ink sm:text-4xl">
          Ask. Stores answer. You go get it.
        </h1>
        <ol className="mt-10 space-y-6">
          {STEPS.map((step, index) => {
            const Icon = step.icon;
            return (
              <li key={step.text} className="flex items-start gap-4">
                <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-white text-ink shadow-[0_4px_16px_rgba(0,0,0,0.04)]">
                  <Icon className="h-5 w-5" strokeWidth={2.1} aria-hidden />
                </span>
                <span className="pt-2.5">
                  <span className="block text-[11px] font-semibold tracking-[0.14em] text-ink-muted">
                    STEP {index + 1}
                  </span>
                  <span className="mt-1 block text-[1.05rem] font-semibold leading-snug text-ink">
                    {step.text}
                  </span>
                </span>
              </li>
            );
          })}
        </ol>
        <p className="mt-10 text-base text-ink-muted">No calling store after store.</p>
      </div>
      <Button type="button" size="xl" className="mt-8 w-full" onClick={onNext}>
        Continue
      </Button>
    </div>
  );
}
