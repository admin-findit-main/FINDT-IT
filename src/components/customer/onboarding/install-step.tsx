"use client";

import { useState } from "react";
import { Check, Plus, Share } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePwaInstall } from "@/lib/pwa-install";
import { trackShopperOnboardingEventAction } from "@/lib/services/onboarding-actions";
import type { InstallSurface } from "@/lib/pwa";

function IosShareGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden fill="none">
      <path
        d="M12 3v11"
        stroke="currentColor"
        strokeWidth="2.15"
        strokeLinecap="round"
      />
      <path
        d="M8.2 6.8 12 3l3.8 3.8"
        stroke="currentColor"
        strokeWidth="2.15"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M6.5 10.5v8A2.5 2.5 0 0 0 9 21h6a2.5 2.5 0 0 0 2.5-2.5v-8"
        stroke="currentColor"
        strokeWidth="2.15"
        strokeLinecap="round"
      />
    </svg>
  );
}

const IOS_STEPS = [
  {
    icon: IosShareGlyph,
    title: "Tap the Share button",
    body: "It’s the square with the arrow pointing up, at the bottom of Safari.",
  },
  {
    icon: Plus,
    title: "Select Add to Home Screen",
    body: "Scroll the share sheet if you need to — then tap it.",
  },
  {
    icon: Check,
    title: "Tap Add",
    body: "FINDIT appears on your Home Screen, just like an app.",
  },
] as const;

export function InstallStep({
  surface,
  onContinue,
  onSkip,
}: {
  surface: InstallSurface;
  onContinue: () => void;
  onSkip: () => void;
}) {
  const { canInstall, promptInstall } = usePwaInstall();
  const [busy, setBusy] = useState(false);
  const [promptGone, setPromptGone] = useState(false);

  async function install() {
    setBusy(true);
    void trackShopperOnboardingEventAction("pwa_install_clicked");
    const result = await promptInstall();
    setBusy(false);
    if (result === "accepted") {
      void trackShopperOnboardingEventAction("pwa_installed");
      onContinue();
      return;
    }
    if (result === "dismissed") {
      void trackShopperOnboardingEventAction("pwa_install_dismissed");
      setPromptGone(true);
      return;
    }
    setPromptGone(true);
  }

  if (surface === "ios-safari") {
    return (
      <div className="flex flex-1 flex-col">
        <div className="flex flex-1 flex-col justify-center">
          <h1 className="text-[2rem] font-bold leading-[1.12] tracking-tight text-ink sm:text-4xl">
            Keep FINDIT one tap away
          </h1>
          <p className="mt-4 text-base leading-relaxed text-ink-muted">
            Add FINDIT to your Home Screen so it opens just like an app.
          </p>
          <ol className="mt-8 space-y-5">
            {IOS_STEPS.map((step, index) => {
              const Icon = step.icon;
              return (
                <li key={step.title} className="flex items-start gap-4">
                  <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-white text-ink shadow-[0_4px_16px_rgba(0,0,0,0.04)]">
                    {index === 0 ? (
                      <IosShareGlyph className="h-6 w-6" />
                    ) : (
                      <Icon className="h-5 w-5" strokeWidth={2.1} aria-hidden />
                    )}
                  </span>
                  <span className="pt-1">
                    <span className="block text-[11px] font-semibold tracking-[0.14em] text-ink-muted">
                      {index + 1}
                    </span>
                    <span className="mt-0.5 block text-[1.05rem] font-semibold leading-snug text-ink">
                      {step.title}
                    </span>
                    <span className="mt-1 block text-sm leading-relaxed text-ink-muted">
                      {step.body}
                    </span>
                  </span>
                </li>
              );
            })}
          </ol>
        </div>
        <div className="mt-8 space-y-2">
          <Button type="button" size="xl" className="w-full" onClick={onContinue}>
            I&apos;ve Added FINDIT
          </Button>
          <Button
            type="button"
            size="lg"
            variant="ghost"
            className="h-12 w-full"
            onClick={onSkip}
          >
            Do this later
          </Button>
        </div>
      </div>
    );
  }

  if (surface === "android-prompt" || (surface === "android-manual" && canInstall)) {
    return (
      <div className="flex flex-1 flex-col">
        <div className="flex flex-1 flex-col justify-center">
          <span className="grid h-14 w-14 place-items-center rounded-2xl bg-white text-ink shadow-[0_4px_16px_rgba(0,0,0,0.04)]">
            <Share className="h-6 w-6" strokeWidth={2} aria-hidden />
          </span>
          <h1 className="mt-8 text-[2rem] font-bold leading-[1.12] tracking-tight text-ink sm:text-4xl">
            Install FINDIT
          </h1>
          <p className="mt-4 max-w-sm text-base leading-relaxed text-ink-muted">
            Get faster access and use FINDIT like an app.
          </p>
          {promptGone ? (
            <p className="mt-6 text-sm leading-relaxed text-ink-muted">
              You can install FINDIT later from your browser menu, or skip for now.
            </p>
          ) : null}
        </div>
        <div className="mt-8 space-y-2">
          {!promptGone && (canInstall || surface === "android-prompt") ? (
            <Button
              type="button"
              size="xl"
              className="w-full"
              disabled={busy}
              onClick={() => void install()}
            >
              {busy ? "Installing…" : "Install FINDIT"}
            </Button>
          ) : (
            <Button type="button" size="xl" className="w-full" onClick={onContinue}>
              Continue
            </Button>
          )}
          <Button
            type="button"
            size="lg"
            variant="ghost"
            className="h-12 w-full"
            onClick={onSkip}
          >
            Do this later
          </Button>
        </div>
      </div>
    );
  }

  if (surface === "android-manual") {
    return (
      <div className="flex flex-1 flex-col">
        <div className="flex flex-1 flex-col justify-center">
          <h1 className="text-[2rem] font-bold leading-[1.12] tracking-tight text-ink sm:text-4xl">
            Install FINDIT
          </h1>
          <p className="mt-4 text-base leading-relaxed text-ink-muted">
            Get faster access and use FINDIT like an app.
          </p>
          <p className="mt-6 text-base leading-relaxed text-ink-muted">
            Open your browser menu and choose Add to Home screen or Install app.
          </p>
        </div>
        <div className="mt-8 space-y-2">
          <Button type="button" size="xl" className="w-full" onClick={onContinue}>
            Continue
          </Button>
          <Button
            type="button"
            size="lg"
            variant="ghost"
            className="h-12 w-full"
            onClick={onSkip}
          >
            Do this later
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col">
      <div className="flex flex-1 flex-col justify-center">
        <h1 className="text-[2rem] font-bold leading-[1.12] tracking-tight text-ink sm:text-4xl">
          FINDIT works in this browser
        </h1>
        <p className="mt-4 max-w-sm text-base leading-relaxed text-ink-muted">
          On a phone, you can add FINDIT to your Home Screen for one-tap access.
          You can keep going here.
        </p>
      </div>
      <Button type="button" size="xl" className="mt-8 w-full" onClick={onContinue}>
        Continue
      </Button>
    </div>
  );
}
