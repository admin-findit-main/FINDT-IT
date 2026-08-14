"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Camera, MapPin } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/primitives";
import {
  GlassBadge,
  GlassChip,
  GlassNotice,
  Overline,
} from "@/components/ui/glass";
import { BottomSheet } from "@/components/ui/dialog";
import {
  CUSTOMER_PLANS,
  EXPIRATION_OPTIONS,
  PRODUCT_CATEGORIES,
  RADIUS_OPTIONS,
} from "@/lib/config/constants";
import {
  createCustomerRequestAction,
  getCurrentProfile,
  getCustomerPlanUsageAction,
  isPilotModeAction,
} from "@/lib/services/actions";
import {
  compressImageFile,
  uploadRequestImage,
  validateImageFile,
} from "@/lib/services/storage";
import type { Profile } from "@/types/database";

export default function CustomerHomePage() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [pilot, setPilot] = useState(false);
  const [usageLabel, setUsageLabel] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);
  const [duplicateId, setDuplicateId] = useState<string | null>(null);

  const [productName, setProductName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [city, setCity] = useState("Falls Church");
  const [postalCode, setPostalCode] = useState("22044");
  const [radiusMiles, setRadiusMiles] = useState(10);
  const [expirationHours, setExpirationHours] = useState(24);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imageStoragePath, setImageStoragePath] = useState<string | null>(null);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);

  useEffect(() => {
    getCurrentProfile().then((p) => {
      setProfile(p);
      if (p?.default_city) setCity(p.default_city);
      if (p?.default_postal_code) setPostalCode(p.default_postal_code);
    });
    isPilotModeAction().then(setPilot);
    getCustomerPlanUsageAction().then((u) => {
      if (!u || u.bypassed || u.limit == null) return;
      setUsageLabel(`${u.remaining} of ${u.limit} free requests left this month`);
    });
  }, []);

  function startRequest(name?: string) {
    const value = (name ?? query).trim();
    if (!value) {
      toast.error("Tell us what you're looking for");
      return;
    }
    if (!profile) {
      router.push(`/login?next=/home`);
      return;
    }
    setProductName(value);
    setDuplicateId(null);
    setOpen(true);
  }

  async function onImageChange(file: File | null) {
    if (!file) return;
    const validation = validateImageFile(file);
    if (!validation.ok) {
      toast.error(validation.error);
      return;
    }
    if (!profile) {
      toast.error("Sign in to attach a photo");
      return;
    }
    const compressed = await compressImageFile(file);
    const previewUrl = URL.createObjectURL(compressed);
    setImagePreview(previewUrl);

    const uploaded = await uploadRequestImage({
      userId: profile.id,
      file: compressed,
      contentType: file.type === "image/png" ? "image/png" : "image/jpeg",
      fileNameHint: file.name,
    });
    if ("error" in uploaded) {
      setImagePreview(null);
      setImageUrl(null);
      setImageStoragePath(null);
      toast.error(
        uploaded.error === "DEMO_STORAGE"
          ? "Photo upload needs Supabase Storage."
          : uploaded.error
      );
      return;
    }
    setImageUrl(uploaded.publicUrl);
    setImageStoragePath(uploaded.path);
  }

  function useMyLocation() {
    if (!navigator.geolocation) {
      toast.error("Location isn’t available on this device. Enter a ZIP instead.");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setLocating(false);
        toast.success("Location added — confirm or edit your ZIP below");
      },
      () => {
        setLocating(false);
        toast.error("Couldn’t get location. Enter a ZIP code instead.");
      },
      { enableHighAccuracy: false, timeout: 10000 }
    );
  }

  async function submitRequest(forceDuplicate = false) {
    setLoading(true);
    const result = await createCustomerRequestAction({
      productName,
      description,
      category: category || undefined,
      city,
      state: "VA",
      postalCode,
      radiusMiles,
      expirationHours,
      imageUrl,
      imageStoragePath,
      forceDuplicate,
      latitude: coords?.lat ?? null,
      longitude: coords?.lng ?? null,
    });
    setLoading(false);
    if (result.duplicateOf && !forceDuplicate) {
      setDuplicateId(result.duplicateOf);
      toast.message("You already have an active request for this.");
      return;
    }
    if (result.error) {
      if (result.needsAuth) {
        router.push("/login?next=/home");
        return;
      }
      toast.error(result.error);
      return;
    }
    setOpen(false);
    router.push(`/requests/${result.request!.id}`);
  }

  const plan = CUSTOMER_PLANS[profile?.subscription_plan === "plus" ? "plus" : "free"];
  const radiusChoices = RADIUS_OPTIONS.filter(
    (r) => r.miles <= plan.maxRadiusMiles || profile?.subscription_plan === "plus"
  );

  return (
    <div className="flex min-h-[calc(100vh-3.5rem-5rem)] flex-col px-5 pt-6 md:min-h-[calc(100vh-3.5rem)] md:px-8 md:pt-10 lg:px-10">
      <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center md:max-w-3xl">
        {pilot ? (
          <GlassBadge tone="accent" className="mb-4 self-start">
            Beta
          </GlassBadge>
        ) : null}

        <h1 className="text-3xl font-bold tracking-tight text-ink md:text-5xl lg:text-6xl">
          What are you looking for?
        </h1>
        <p className="mt-3 max-w-xl text-base text-ink-muted md:text-lg">
          Ask nearby stores at once. Who has it? FINDIT.
        </p>

        <div className="mt-8 space-y-4 md:mt-10">
          <Input
            className="h-14 rounded-glass-xl text-base shadow-glass md:h-16 md:text-lg"
            placeholder="Search or describe…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") startRequest();
            }}
          />

          <div className="flex flex-col gap-3 sm:flex-row">
            <label className="sm:w-44">
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                capture="environment"
                className="hidden"
                onChange={(e) => onImageChange(e.target.files?.[0] || null)}
              />
              <span className="glass glass-press inline-flex h-14 w-full cursor-pointer items-center justify-center gap-2 rounded-glass-xl text-sm font-semibold text-ink md:h-16">
                <Camera className="h-4 w-4" aria-hidden />
                Add Photo
              </span>
            </label>
            <button
              type="button"
              className="glass-subtle glass-press flex flex-1 items-center gap-3 rounded-glass-xl px-4 py-3 text-left sm:px-5"
              onClick={() => {
                if (!productName.trim() && !query.trim()) {
                  toast.message("Enter a product first", {
                    description: "Then you can set where to search.",
                  });
                  return;
                }
                startRequest(productName.trim() || query.trim());
              }}
            >
              <MapPin className="h-5 w-5 shrink-0 text-accent" aria-hidden />
              <div className="min-w-0">
                <Overline>Searching near</Overline>
                <p className="truncate font-semibold text-ink">{city}, VA</p>
              </div>
            </button>
          </div>

          {imagePreview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={imagePreview}
              alt="Product preview"
              className="h-28 w-full rounded-glass-xl border border-hairline-strong object-cover md:h-36"
            />
          ) : null}

          <Button
            className="w-full"
            size="xl"
            onClick={() => startRequest()}
          >
            FIND IT
          </Button>

          {usageLabel ? (
            <p className="text-center text-xs text-ink-muted">{usageLabel}</p>
          ) : null}
        </div>
      </div>

      <BottomSheet
        open={open}
        onOpenChange={setOpen}
        title="Ask nearby stores"
        description="Stores will see what you're looking for, but your personal contact information stays private."
      >
        <div className="space-y-4 pb-6">
          <div>
            <Label htmlFor="productName">Product name</Label>
            <Input
              id="productName"
              value={productName}
              onChange={(e) => setProductName(e.target.value)}
              placeholder="Cherry Coke Zero 12 Pack"
              required
            />
          </div>
          <div>
            <Label htmlFor="description">Product description (optional)</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Looking specifically for the 12-pack cans."
            />
          </div>
          {imagePreview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={imagePreview}
              alt="Product preview"
              className="h-32 w-full rounded-glass-lg border border-hairline-strong object-cover"
            />
          ) : (
            <label className="flex cursor-pointer items-center justify-center gap-2 rounded-glass-lg border border-dashed border-hairline-strong bg-glass-1 py-8 text-sm text-ink-muted transition-colors hover:bg-glass-2 hover:text-ink">
              <Camera className="h-4 w-4" aria-hidden />
              Take photo or upload
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                capture="environment"
                className="hidden"
                onChange={(e) => onImageChange(e.target.files?.[0] || null)}
              />
            </label>
          )}
          <div>
            <Label>Category (optional)</Label>
            <div className="mt-2 flex flex-wrap gap-2">
              {PRODUCT_CATEGORIES.map((c) => (
                <GlassChip
                  key={c}
                  selected={category === c}
                  onClick={() => setCategory(category === c ? "" : c)}
                >
                  {c}
                </GlassChip>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="city">City</Label>
              <Input id="city" value={city} onChange={(e) => setCity(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="zip">ZIP code</Label>
              <Input
                id="zip"
                value={postalCode}
                onChange={(e) => setPostalCode(e.target.value)}
              />
            </div>
          </div>
          <Button
            type="button"
            variant="outline"
            className="w-full"
            disabled={locating}
            onClick={useMyLocation}
          >
            {locating ? "Getting location…" : "Use my location"}
          </Button>
          {coords ? (
            <p className="text-xs text-ink-muted">
              Location attached. ZIP stays the primary search area.
            </p>
          ) : null}
          {duplicateId ? (
            <GlassNotice tone="order">
              <p className="font-semibold">
                You already have an active request for this.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => router.push(`/requests/${duplicateId}`)}
                >
                  View existing request
                </Button>
                <Button
                  size="sm"
                  onClick={() => submitRequest(true)}
                  disabled={loading}
                >
                  Create another anyway
                </Button>
              </div>
            </GlassNotice>
          ) : null}
          <div>
            <Label>Search area</Label>
            <div className="mt-2 flex flex-wrap gap-2">
              {radiusChoices.map((r) => (
                <GlassChip
                  key={r.label}
                  selected={radiusMiles === r.miles}
                  onClick={() => setRadiusMiles(r.miles)}
                >
                  {r.label}
                </GlassChip>
              ))}
            </div>
          </div>
          <div>
            <Label>Request expiration</Label>
            <div className="mt-2 flex flex-wrap gap-2">
              {EXPIRATION_OPTIONS.map((o) => (
                <GlassChip
                  key={o.hours}
                  selected={expirationHours === o.hours}
                  onClick={() => setExpirationHours(o.hours)}
                >
                  {o.label}
                </GlassChip>
              ))}
            </div>
          </div>
          <p className="text-xs leading-relaxed text-ink-muted">
            Stores will see what you&apos;re looking for, but your personal contact
            information stays private.
          </p>
          <Button
            className="w-full"
            size="xl"
            disabled={loading}
            onClick={() => submitRequest()}
          >
            {loading ? "Sending…" : "Ask Nearby Stores"}
          </Button>
        </div>
      </BottomSheet>
    </div>
  );
}
