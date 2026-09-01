import { BrandLogo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";

export function WelcomeStep({ onNext }: { onNext: () => void }) {
  return (
    <div className="flex flex-1 flex-col">
      <div className="flex flex-1 flex-col items-center justify-center text-center">
        <BrandLogo kind="mark" className="h-16 sm:h-20" />
        <h1 className="mt-10 max-w-[14ch] text-[2.15rem] font-bold leading-[1.08] tracking-tight text-ink sm:text-5xl">
          IT&apos;S CLOSER THAN YOU THINK.
        </h1>
        <p className="mt-5 max-w-sm text-base leading-relaxed text-ink-muted sm:text-lg">
          Looking for something? Ask once and let nearby stores tell you who has it.
        </p>
      </div>
      <Button type="button" size="xl" className="mt-8 w-full" onClick={onNext}>
        Get Started
      </Button>
    </div>
  );
}
