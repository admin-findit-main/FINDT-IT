"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, Input, Label } from "@/components/ui/primitives";
import { IosSwitch } from "@/components/ui/ios-switch";
import { PlaceFields } from "@/components/customer/place-fields";
import { SUPPORT_EMAIL } from "@/lib/auth/admin";
import {
  getCurrentProfile,
  signOutAction,
  updateProfileAction,
} from "@/lib/services/actions";
import type { Profile } from "@/types/database";

export default function ProfilePage() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getCurrentProfile().then(setProfile);
  }, []);

  if (!profile) {
    return <div className="px-5 pt-8 text-sm text-ink-muted">Loading profile…</div>;
  }

  return (
    <div className="mx-auto max-w-xl px-5 py-8 pb-12 sm:px-8">
      <h1 className="text-2xl font-bold tracking-tight text-ink">Profile</h1>
      <p className="mt-2 text-sm text-ink-muted">
        Your name, place, and alerts. Plans live on the Plan page.
      </p>

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
          <Label>{profile.email ? "Email" : "Phone"}</Label>
          <Input
            value={profile.email || profile.phone_e164 || ""}
            disabled
          />
        </div>
        <div>
          <Label>Place</Label>
          <p className="mb-2 text-xs text-ink-subtle">
            City, state, ZIP — the short form FINDIT uses to ask nearby stores.
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
        </div>
        <div className="space-y-3 border-t border-hairline-strong pt-4">
          <p className="text-sm font-semibold text-ink">Alerts</p>
          {(
            [
              ["notify_in_stock", "In Stock replies"],
              ["notify_can_order", "Can Order replies"],
              ["notify_request_expired", "Request expiration"],
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
            const result = await updateProfileAction({
              firstName: profile.first_name || "",
              lastName: profile.last_name || "",
              city: profile.default_city || "",
              state: profile.default_state || "VA",
              postalCode: profile.default_postal_code || "",
              notifyInStock: profile.notify_in_stock,
              notifyCanOrder: profile.notify_can_order,
              notifyRequestExpired: profile.notify_request_expired,
            });
            setSaving(false);
            if (result.error) toast.error(result.error);
            else toast.success("Saved");
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
          Need help, or want to leave FINDIT? Email{" "}
          <a className="underline" href={`mailto:${SUPPORT_EMAIL}`}>
            {SUPPORT_EMAIL}
          </a>
          . We don&apos;t offer text support during the pilot.
        </p>
      </Card>
    </div>
  );
}
