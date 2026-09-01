"use client";

import { useState } from "react";
import { MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { geolocateUsPlace } from "@/lib/customer/geolocate";
import { updateProfileAction } from "@/lib/services/actions";
import { useCustomerProfile } from "@/components/customer/session";
import { isCompleteShortPlace } from "@findit/domain";

export function LocationStep({ onContinue }: { onContinue: () => void }) {
  const profile = useCustomerProfile();
  const [busy, setBusy] = useState(false);
  const [hint, setHint] = useState<string | null>(null);

  async function allowLocation() {
    setBusy(true);
    setHint(null);
    const result = await geolocateUsPlace();
    if (!result.ok) {
      setBusy(false);
      setHint(result.error);
      return;
    }
    if (profile && isCompleteShortPlace(result.place)) {
      await updateProfileAction({
        firstName: profile.first_name || "",
        lastName: profile.last_name || "",
        city: result.place.city,
        state: result.place.state,
        postalCode: result.place.postalCode,
        notifyInStock: profile.notify_in_stock,
        notifyCanOrder: profile.notify_can_order,
        notifyRequestExpired: profile.notify_request_expired,
      });
    } else if (!isCompleteShortPlace(result.place)) {
      setHint("We found you, but confirm your city on Home if it looks off.");
    }
    setBusy(false);
    onContinue();
  }

  return (
    <div className="flex flex-1 flex-col">
      <div className="flex flex-1 flex-col justify-center">
        <span className="grid h-14 w-14 place-items-center rounded-2xl bg-white text-ink shadow-[0_4px_16px_rgba(0,0,0,0.04)]">
          <MapPin className="h-6 w-6" strokeWidth={2.1} aria-hidden />
        </span>
        <h1 className="mt-8 text-[2rem] font-bold leading-[1.12] tracking-tight text-ink sm:text-4xl">
          Find stores near you
        </h1>
        <p className="mt-4 text-base leading-relaxed text-ink-muted">
          Allow location so FINDIT can ask nearby stores. You can still type a
          city later if you prefer.
        </p>
        {hint ? (
          <p className="mt-6 text-sm leading-relaxed text-ink-muted">{hint}</p>
        ) : null}
      </div>
      <div className="mt-8 space-y-2">
        <Button
          type="button"
          size="xl"
          className="w-full"
          disabled={busy}
          onClick={() => void allowLocation()}
        >
          {busy ? "Finding you…" : "Allow Location"}
        </Button>
        <Button
          type="button"
          size="lg"
          variant="ghost"
          className="h-12 w-full"
          onClick={onContinue}
        >
          Not now
        </Button>
      </div>
    </div>
  );
}
