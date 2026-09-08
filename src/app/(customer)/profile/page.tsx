"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, Input, Label } from "@/components/ui/primitives";
import { IosSwitch } from "@/components/ui/ios-switch";
import { PlaceFields } from "@/components/customer/place-fields";
import { NotificationDeniedHint } from "@/components/customer/notification-denied-hint";
import { LocateMeButton } from "@/components/customer/locate-me-button";
import { geolocateUsPlace } from "@/lib/customer/geolocate";
import { SUPPORT_EMAIL } from "@/lib/auth/admin";
import { DeleteAccountCard } from "@/components/account/delete-account-card";
import { ShopperFinditPoints } from "@/components/customer/findit-points";
import { SupportReportForm } from "@/components/shared/support-report-form";
import {
  getCurrentProfile,
  signOutAction,
  updateProfileAction,
} from "@/lib/services/actions";
import { saveShopperPhoneAction } from "@/lib/services/loyalty";
import type { Profile } from "@/types/database";
import {
  formatShortPlace,
  isCompleteShortPlace,
} from "@findit/domain";

export default function ProfilePage() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [saving, setSaving] = useState(false);
  const [locating, setLocating] = useState(false);
  const [phone, setPhone] = useState("");

  useEffect(() => {
    getCurrentProfile().then(setProfile);
  }, []);

  useEffect(() => {
    if (profile) setPhone(profile.phone_e164 || "");
  }, [profile]);

  if (!profile) {
    return <div className="px-5 pt-8 text-sm text-ink-muted">Loading profile…</div>;
  }

  return (
    <div className="mx-auto max-w-xl px-5 py-8 pb-12 sm:px-8">
      <h1 className="text-2xl font-bold tracking-tight text-ink">Profile</h1>
      <p className="mt-2 text-sm text-ink-muted">
        Your name, place, and alerts. Plans live on the Plan page.
      </p>

      <ShopperFinditPoints />

      <Card className="mt-6 space-y-4 p-5">
        <div>
          <Label>Name</Label>
          <Input
            value={profile.first_name || ""}
            onChange={(e) =>
              setProfile({ ...profile, first_name: e.target.value })
            }
          />
        </div>
        <div>
          <Label>Email</Label>
          <Input
            value={profile.email || ""}
            disabled
          />
        </div>
        <div>
          <Label htmlFor="shopper-phone">Phone for in-store rewards (optional)</Label>
          <Input
            id="shopper-phone"
            type="tel"
            autoComplete="tel"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            placeholder="(571) 259-9714"
          />
          <p className="mt-1 text-xs text-ink-muted">
            This number is self-reported and remains unverified. For convenience,
            stores can find an email-confirmed account by an exact phone match.
            Store-only rewards remain at that store until secure phone
            verification is available.
          </p>
        </div>
        <div>
          <Label>Place</Label>
          <p className="mb-2 text-xs text-ink-subtle">
            Type your city, or tap Locate me and we’ll add the ZIP. You don’t have to know it.
          </p>
          <PlaceFields
            value={{
              city: profile.default_city || "",
              state: profile.default_state || "VA",
              postalCode: profile.default_postal_code || "",
            }}
            onChange={(place) =>
              setProfile({
                ...profile,
                default_city: place.city,
                default_state: place.state,
                default_postal_code: place.postalCode,
              })
            }
          />
          <LocateMeButton
            className="mt-3"
            busy={locating}
            emphasized={!profile.default_postal_code}
            onPress={async () => {
              setLocating(true);
              const result = await geolocateUsPlace();
              setLocating(false);
              if (!result.ok) {
                toast.error(result.error);
                return;
              }
              setProfile({
                ...profile,
                default_city: result.place.city,
                default_state: result.place.state,
                default_postal_code: result.place.postalCode,
              });
              toast.success(
                isCompleteShortPlace(result.place)
                  ? `Using ${formatShortPlace(result.place)}`
                  : "Location added. Confirm your city above"
              );
            }}
          />
        </div>
        <div className="space-y-3 border-t border-hairline-strong pt-4">
          <p className="text-sm font-semibold text-ink">Alerts</p>
          <NotificationDeniedHint />
          {(
            [
              ["notify_in_stock", "In Stock replies"],
              ["notify_can_order", "Can Order replies"],
              ["notify_request_expired", "Request expiration"],
              ["notify_store_promotions", "Store promotions"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              role="switch"
              aria-checked={Boolean(profile[key])}
              onClick={() =>
                setProfile({ ...profile, [key]: !profile[key] })
              }
              className="flex min-h-11 w-full items-center justify-between gap-3 rounded-glass-md bg-glass-1 px-3 py-2 text-left text-sm text-ink"
            >
              <span>{label}</span>
              <IosSwitch
                decorative
                label={label}
                checked={Boolean(profile[key])}
              />
            </button>
          ))}
        </div>
        <Button
          className="w-full"
          disabled={saving}
          onClick={async () => {
            setSaving(true);
            const [result, phoneResult] = await Promise.all([
              updateProfileAction({
                firstName: profile.first_name || "",
                lastName: profile.last_name || "",
                city: profile.default_city || "",
                state: profile.default_state || "VA",
                postalCode: profile.default_postal_code || "",
                notifyInStock: profile.notify_in_stock,
                notifyCanOrder: profile.notify_can_order,
                notifyRequestExpired: profile.notify_request_expired,
                notifyStorePromotions: profile.notify_store_promotions,
              }),
              saveShopperPhoneAction(phone),
            ]);
            setSaving(false);
            if (result.error) {
              toast.error(result.error);
              return;
            }
            if (!phoneResult.ok) {
              toast.error(phoneResult.error);
              return;
            }
            if (result.profile) {
              setProfile({
                ...result.profile,
                phone_e164: phoneResult.phoneE164,
                phone_verified: phoneResult.verified,
                phone_verified_at: phoneResult.verified
                  ? result.profile.phone_verified_at
                  : null,
              });
            }
            toast.success("Saved");
          }}
        >
          Save changes
        </Button>
      </Card>

      <Card level="subtle" className="mt-4 space-y-3 p-5">
        <p className="text-sm font-semibold text-ink">Account</p>
        <Button
          variant="outline"
          className="w-full"
          onClick={async () => {
            await signOutAction();
            router.push("/");
            router.refresh();
          }}
        >
          Log out
        </Button>
        <p className="text-xs leading-relaxed text-ink-muted">
          Need help? Email{" "}
          <a className="underline" href={`mailto:${SUPPORT_EMAIL}`}>
            {SUPPORT_EMAIL}
          </a>
          .
        </p>
        <div className="pt-1">
          <SupportReportForm />
        </div>
      </Card>

      <div className="mt-4">
        <DeleteAccountCard />
      </div>
    </div>
  );
}
