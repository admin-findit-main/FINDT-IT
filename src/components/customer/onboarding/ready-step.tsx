import { BrandLogo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";

export function ReadyStep({ onFinish }: { onFinish: () => void }) {
  return (
    <div className="flex flex-1 flex-col">
      <div className="flex flex-1 flex-col items-center justify-center text-center">
        <span className="findit-onboard-check relative grid h-20 w-20 place-items-center">
          <BrandLogo kind="mark" className="h-16" />
        </span>
        <h1 className="mt-8 text-[2.15rem] font-bold leading-[1.08] tracking-tight text-ink sm:text-5xl">
          You&apos;re ready.
        </h1>
        <p className="mt-4 max-w-sm text-base leading-relaxed text-ink-muted sm:text-lg">
          Ask FINDIT what you&apos;re looking for and we&apos;ll take it from here.
        </p>
      </div>
      <Button type="button" size="xl" className="mt-8 w-full" onClick={onFinish}>
        Find Something
      </Button>
    </div>
  );
}
