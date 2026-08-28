"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Camera, ChevronLeft, MapPin } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/primitives";
import { GlassSheet } from "@/components/ui/dialog";
import { GlassChip, GlassNotice } from "@/components/ui/glass";
import { PlusUpgradeCard } from "@/components/customer/plus-upgrade";
import { useCustomerProfile } from "@/components/customer/session";
import { PlaceFields } from "@/components/customer/place-fields";
import { LocateMeButton } from "@/components/customer/locate-me-button";
import { geolocateUsPlace } from "@/lib/customer/geolocate";
import { marketingHomeHref } from "@/lib/config/product-hosts";
import {
  AGE_RESTRICTED_FIND_HINT,
  AGE_RESTRICTED_ID_BODY,
  AGE_RESTRICTED_ID_CONFIRM,
  AGE_RESTRICTED_ID_TITLE,
  CUSTOMER_PLANS,
  PRODUCT_CATEGORIES,
  RADIUS_OPTIONS,
  findPlaceholderForCategory,
  getConsumerEntitlements,
  isAgeRestrictedCategory,
  isAgeRestrictedFind,
  planLimitReachedMessage,
} from "@/lib/config/constants";
import {
  createCustomerRequestAction,
  getCustomerPlanUsageAction,
  updateProfileAction,
} from "@/lib/services/actions";
import {
  compressImageFile,
  uploadRequestImage,
  validateImageFile,
} from "@/lib/services/storage";
import { cn } from "@/lib/utils";
import type { Profile } from "@/types/database";
import {
  formatCityState,
  formatShortPlace,
  isCompleteShortPlace,
  lookupUsZip,
  shortPlaceFromProfile,
  type ShortPlace,
  classifyRequest,
  classificationLabel,
} from "@findit/domain";

type Step = "query" | "radius";

export default function CustomerHomePage() {
  const router = useRouter();
  const sessionProfile = useCustomerProfile();
  const [profile, setProfile] = useState<Profile | null>(sessionProfile);
  const [step, setStep] = useState<Step>("query");
  const [loading, setLoading] = useState(false);
  const [usageLabel, setUsageLabel] = useState<string | null>(null);
  const [upgrade, setUpgrade] = useState<{ used: number; limit: number } | null>(
    null
  );
  const [locating, setLocating] = useState(false);
  const [duplicateId, setDuplicateId] = useState<string | null>(null);
  const [editPlace, setEditPlace] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [ageGateOpen, setAgeGateOpen] = useState(false);
  const [pendingCategory, setPendingCategory] = useState("");
  const [uploading, setUploading] = useState(false);

  const [productName, setProductName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [idConfirmed, setIdConfirmed] = useState(false);
  const [categoryConfirmed, setCategoryConfirmed] = useState(false);
  const [place, setPlace] = useState<ShortPlace>({
    city: "",
    state: "VA",
    postalCode: "",
  });
  const [radiusMiles, setRadiusMiles] = useState(10);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imageStoragePath, setImageStoragePath] = useState<string | null>(null);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const autoLocated = useRef(false);
  const pendingSubmit = useRef<{ forceDuplicate: boolean } | null>(null);
  const ageGateAfterClose = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (sessionProfile) {
      setProfile(sessionProfile);
      setPlace(shortPlaceFromProfile(sessionProfile));
    }
    getCustomerPlanUsageAction().then((u) => {
      if (!u || u.bypassed) return;
      const word = u.entitlements.planId === "plus" ? "FINDIT+ Finds" : "free Finds";
      setUsageLabel(`${u.remaining} of ${u.limit} ${word} left this month`);
      if (u.remaining === 0) {
        setUpgrade({ used: u.used, limit: u.limit });
        setStep("query");
      }
    });
  }, []);

  useEffect(() => {
    return () => {
      document.body.style.removeProperty("pointer-events");
    };
  }, []);

  const entitlements = getConsumerEntitlements(profile?.subscription_plan);
  const radiusChoices = RADIUS_OPTIONS;
  const plus = CUSTOMER_PLANS.plus;
  const restricted = isAgeRestrictedFind({
    category,
    productName,
    description,
  });
  const guessed = classifyRequest({
    productName,
    description,
    category,
    confirmed: categoryConfirmed || Boolean(category),
  });
  const needsCategoryConfirm =
    guessed.status === "needs_confirm" && !categoryConfirmed && !category;

  function goNextFromQuery() {
    if (upgrade) {
      toast.error(planLimitReachedMessage(entitlements));
      return;
    }
    const value = productName.trim();
    if (!value && !imagePreview) {
      toast.error("Type a product name or add a photo");
      return;
    }
    if (!profile) {
      router.push(`/login?next=/home`);
      return;
    }
    setDuplicateId(null);
    setEditPlace(!place.postalCode.trim() || !place.city.trim() || !place.state.trim());
    if (restricted && idConfirmed) setShowDetails(true);
    setStep("radius");
  }

  function onAgeGateOpenChange(open: boolean) {
    setAgeGateOpen(open);
    if (open) return;
    const run = ageGateAfterClose.current;
    ageGateAfterClose.current = null;
    document.body.style.removeProperty("pointer-events");
    if (!run) {
      setPendingCategory("");
      pendingSubmit.current = null;
      return;
    }
    window.setTimeout(run, 50);
  }

  function confirmAgeGate() {
    const nextCategory = pendingCategory;
    const pending = pendingSubmit.current;
    pendingSubmit.current = null;
    setPendingCategory("");
    setIdConfirmed(true);
    if (nextCategory) setCategory(nextCategory);
    setShowDetails(true);
    ageGateAfterClose.current = pending
      ? () => {
          void submitRequest(pending.forceDuplicate, true);
        }
      : null;
    setAgeGateOpen(false);
  }

  function chooseCategory(item: string) {
    const next = category === item ? "" : item;
    if (isAgeRestrictedCategory(next) && !idConfirmed) {
      setPendingCategory(next);
      setAgeGateOpen(true);
      return;
    }
    setCategory(next);
    if (next) setCategoryConfirmed(true);
  }

  useEffect(() => {
    if (step !== "radius" || autoLocated.current) return;
    if (isCompleteShortPlace(place)) return;
    autoLocated.current = true;
    void fillFromLocation();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- one-shot when the radius step opens
  }, [step]);

  function useMyLocation() {
    void fillFromLocation();
  }

  async function fillFromLocation() {
    setLocating(true);
    const result = await geolocateUsPlace();
    setLocating(false);
    if (!result.ok) {
      toast.error(result.error);
      setEditPlace(true);
      return;
    }
    setCoords(result.coords);
    setPlace(result.place);
    setEditPlace(!isCompleteShortPlace(result.place));
    toast.success(
      result.place.postalCode
        ? `Using ${formatShortPlace(result.place)}`
        : "Location added — confirm your city below"
    );
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
    setUploading(true);

    const uploaded = await uploadRequestImage({
      file: compressed,
      contentType: file.type === "image/png" ? "image/png" : "image/jpeg",
      fileNameHint: file.name,
    });
    setUploading(false);
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

  async function submitRequest(forceDuplicate = false, ageOk = idConfirmed) {
    if (upgrade) {
      setStep("query");
      toast.error(planLimitReachedMessage(entitlements));
      return;
    }
    if (restricted && !ageOk) {
      pendingSubmit.current = { forceDuplicate };
      setAgeGateOpen(true);
      return;
    }
    if (needsCategoryConfirm) {
      toast.error("Confirm the category so we send this to the right stores.");
      return;
    }
    setLoading(true);
    let nextPlace = place;
    if (!nextPlace.city.trim() && nextPlace.postalCode.trim()) {
      const found = await lookupUsZip(nextPlace.postalCode);
      if (found) {
        nextPlace = found;
        setPlace(found);
      }
    }
    if (!isCompleteShortPlace(nextPlace)) {
      setLoading(false);
      setEditPlace(true);
      toast.error("Add your city so we can ask nearby stores.");
      return;
    }
    const result = await createCustomerRequestAction({
      productName: productName.trim() || "Item in photo",
      description,
      category: category || guessed.productCategory || "",
      categoryConfirmed:
        categoryConfirmed || Boolean(category) || guessed.status === "confident",
      city: nextPlace.city,
      state: nextPlace.state || "VA",
      postalCode: nextPlace.postalCode,
      radiusMiles,
      expirationHours: 24,
      imageUrl,
      imageStoragePath,
      forceDuplicate,
      latitude: coords?.lat ?? null,
      longitude: coords?.lng ?? null,
      ageRestrictedConfirmed: !restricted || ageOk,
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
      if ("code" in result && result.code === "plan_limit") {
        setStep("query");
        setUpgrade({
          used: entitlements.monthlyRequestLimit,
          limit: entitlements.monthlyRequestLimit,
        });
        getCustomerPlanUsageAction().then((u) => {
          if (u && !u.bypassed) setUpgrade({ used: u.used, limit: u.limit });
        });
        toast.error(result.error);
        return;
      }
      toast.error(result.error);
      return;
    }
    router.push(`/requests/${result.request!.id}`);
    if (profile) {
      void updateProfileAction({
        firstName: profile.first_name || "",
        lastName: profile.last_name || "",
        city: nextPlace.city,
        state: nextPlace.state || "VA",
        postalCode: nextPlace.postalCode,
        notifyInStock: profile.notify_in_stock,
        notifyCanOrder: profile.notify_can_order,
        notifyRequestExpired: profile.notify_request_expired,
      });
    }
  }

  return (
    <div className="flex min-h-[calc(100vh-3.5rem)] flex-col px-5 py-8 sm:px-8 md:py-12">
      <div className="mx-auto flex w-full max-w-xl flex-1 flex-col">
        {step === "query" ? (
          <div className="flex flex-1 flex-col justify-center pb-16">
            <p className="text-[12px] font-semibold tracking-[0.14em] text-ink-muted">
              FINDIT
            </p>
            <h1 className="mt-3 text-[2.15rem] font-bold leading-[1.12] tracking-tight text-ink sm:text-5xl">
              What are you looking for?
            </h1>
            <p className="mt-4 max-w-md text-base leading-relaxed text-ink-muted sm:text-lg">
              Ask nearby stores at once. They tell you if they have it.
            </p>

            <form
              className="mt-10 space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                goNextFromQuery();
              }}
            >
              <Input
                autoFocus={!upgrade}
                disabled={Boolean(upgrade)}
                className="h-16 rounded-2xl border-hairline-strong bg-white px-5 text-lg shadow-[0_4px_16px_rgba(0,0,0,0.04)]"
                placeholder={findPlaceholderForCategory(null)}
                value={productName}
                onChange={(e) => {
                  setProductName(e.target.value);
                }}
              />
              <label className="flex min-h-[140px] cursor-pointer flex-col items-center justify-center overflow-hidden rounded-2xl border border-hairline-strong bg-white text-center">
                {imagePreview ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={imagePreview}
                    alt="Product preview"
                    className="h-44 w-full object-cover"
                  />
                ) : (
                  <span className="px-5 py-8">
                    <Camera className="mx-auto h-5 w-5 text-ink-muted" />
                    <span className="mt-2 block text-sm font-semibold text-ink">
                      Add a photo
                    </span>
                    <span className="mt-1 block text-xs text-ink-muted">
                      Optional — or just type the name above
                    </span>
                  </span>
                )}
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  capture="environment"
                  className="hidden"
                  disabled={Boolean(upgrade)}
                  onChange={(e) => onImageChange(e.target.files?.[0] || null)}
                />
              </label>
              {imagePreview ? (
                <button
                  type="button"
                  className="text-sm font-medium text-ink-muted hover:text-ink"
                  onClick={() => {
                    setImagePreview(null);
                    setImageUrl(null);
                    setImageStoragePath(null);
                  }}
                >
                  Remove photo
                </button>
              ) : null}
              {upgrade ? (
                <PlusUpgradeCard used={upgrade.used} limit={upgrade.limit} />
              ) : null}
              {upgrade ? null : (
                <Button
                  className="w-full"
                  size="xl"
                  type="submit"
                  disabled={uploading || (!productName.trim() && !imagePreview)}
                >
                  {uploading ? "Uploading photo…" : "Continue"}
                </Button>
              )}
              {usageLabel ? (
                <p className="text-center text-xs text-ink-muted">{usageLabel}</p>
              ) : null}
            </form>
          </div>
        ) : (
          <div className="pb-10">
            <button
              type="button"
              onClick={() => setStep("query")}
              className="mb-6 inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-ink-muted hover:text-ink"
            >
              <ChevronLeft className="h-4 w-4" />
              Back
            </button>

            <button
              type="button"
              onClick={() => setStep("query")}
              className="w-full rounded-2xl border border-hairline-strong bg-white px-5 py-4 text-left"
            >
              <p className="text-[12px] font-semibold tracking-wide text-ink-muted">
                Looking for
              </p>
              <p className="mt-1 text-xl font-semibold tracking-tight text-ink">
                {productName.trim() || "Item in photo"}
              </p>
              {imagePreview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={imagePreview}
                  alt=""
                  className="mt-3 h-16 w-16 rounded-xl object-cover"
                />
              ) : null}
              <p className="mt-2 text-sm font-semibold text-accent-ink">Edit</p>
            </button>
            {restricted ? (
              <p className="mt-3 text-sm leading-relaxed text-ink-muted">
                {AGE_RESTRICTED_FIND_HINT}
              </p>
            ) : null}

            <h2 className="mt-8 text-2xl font-bold tracking-tight text-ink">
              Category
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-ink-muted">
              Optional — helps us ask the right stores. Tobacco & vape asks for ID first.
            </p>
            {needsCategoryConfirm ? (
              <div className="mt-4 rounded-2xl border border-hairline-strong bg-white p-4">
                <p className="text-sm font-semibold text-ink">
                  We think you&apos;re looking for:
                </p>
                <p className="mt-1 text-base font-bold text-ink">
                  {classificationLabel(guessed)}
                </p>
                <p className="mt-1 text-xs text-ink-muted">{guessed.reason}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => {
                      if (guessed.productCategory) setCategory(guessed.productCategory);
                      setCategoryConfirmed(true);
                    }}
                    disabled={!guessed.productCategory}
                  >
                    Yes, search nearby
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setCategoryConfirmed(false)}
                  >
                    Change category
                  </Button>
                </div>
              </div>
            ) : guessed.businessTypeName && (category || categoryConfirmed) ? (
              <p className="mt-3 text-sm text-ink-muted">
                Sending to {classificationLabel(guessed)} stores nearby.
              </p>
            ) : null}
            <div className="mt-3 flex flex-wrap gap-2">
              {PRODUCT_CATEGORIES.map((item) => (
                <GlassChip
                  key={item}
                  selected={category === item}
                  onClick={() => chooseCategory(item)}
                >
                  {item}
                </GlassChip>
              ))}
            </div>

            <h2 className="mt-8 text-2xl font-bold tracking-tight text-ink">
              How far should we look?
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-ink-muted">
              We’ll look this far from your location — up to 40 miles.
            </p>

            <div className="mt-4 overflow-hidden rounded-2xl border border-hairline-strong bg-white">
              {radiusChoices.map((r, i) => {
                const selected = radiusMiles === r.miles;
                return (
                  <button
                    key={r.miles}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => setRadiusMiles(r.miles)}
                    className={cn(
                      "flex min-h-14 w-full items-center justify-between px-5 text-left text-sm transition-colors",
                      i < radiusChoices.length - 1 ? "border-b border-hairline-strong" : "",
                      selected ? "font-bold text-ink" : "font-medium text-ink-muted hover:bg-black/[0.02] hover:text-ink"
                    )}
                  >
                    {r.label}
                    <span
                      className={cn(
                        "grid h-[22px] w-[22px] place-items-center rounded-full border-2",
                        selected ? "border-accent" : "border-hairline"
                      )}
                    >
                      {selected ? (
                        <span className="h-2.5 w-2.5 rounded-full bg-accent" />
                      ) : null}
                    </span>
                  </button>
                );
              })}
            </div>
            {entitlements.planId !== "plus" ? (
              <p className="mt-2 px-1 text-xs text-ink-subtle">
                FINDIT+ searches up to {plus.maxRadiusMiles} miles.
              </p>
            ) : null}

            <h2 className="mt-8 text-2xl font-bold tracking-tight text-ink">Near</h2>
            <p className="mt-2 text-sm leading-relaxed text-ink-muted">
              Don’t know your ZIP? Tap Locate me and we’ll fill it in.
            </p>
            <div className="mt-4 overflow-hidden rounded-2xl border border-hairline-strong bg-white">
              <button
                type="button"
                onClick={() => setEditPlace((v) => !v)}
                className="flex min-h-14 w-full items-center gap-3 px-5 py-3 text-left"
              >
                <MapPin className="h-4 w-4 shrink-0 text-ink-muted" />
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold text-ink">
                    {formatCityState(place) || "Add your city"}
                  </span>
                  <span className="mt-0.5 block truncate text-xs tabular-nums text-ink-subtle">
                    {place.postalCode
                      ? place.postalCode
                      : locating
                        ? "Adding your ZIP…"
                        : coords
                          ? "Adding your ZIP…"
                          : "We’ll add your ZIP"}
                  </span>
                </span>
                <span className="text-sm font-semibold text-accent-ink">
                  {editPlace ? "Done" : "Change"}
                </span>
              </button>
              <div className="space-y-3 border-t border-hairline-strong px-5 py-4">
                <LocateMeButton
                  busy={locating}
                  emphasized={!place.postalCode.trim()}
                  onPress={useMyLocation}
                />
                {editPlace ? (
                  <PlaceFields value={place} onChange={setPlace} />
                ) : null}
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowDetails((v) => !v)}
              className="mt-5 min-h-11 text-sm font-medium text-ink-muted hover:text-ink"
            >
              {showDetails ? "Hide details" : "Add details (optional)"}
            </button>
            {showDetails ? (
              <div className="mt-2 space-y-3 rounded-2xl border border-hairline-strong bg-white p-4">
                <Textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder={
                    restricted
                      ? AGE_RESTRICTED_FIND_HINT
                      : "Details stores should know (optional)"
                  }
                />
              </div>
            ) : null}

            {upgrade ? (
              <div className="mt-6">
                <PlusUpgradeCard used={upgrade.used} limit={upgrade.limit} />
              </div>
            ) : null}
            {duplicateId ? (
              <GlassNotice tone="order" className="mt-6">
                <p className="font-semibold">You already have an active request for this.</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => router.push(`/requests/${duplicateId}`)}
                  >
                    View existing request
                  </Button>
                  <Button size="sm" asChild>
                    <Link href={marketingHomeHref()}>Go back to askfindit.com</Link>
                  </Button>
                </div>
              </GlassNotice>
            ) : null}

            <Button
              className="mt-8 w-full"
              size="xl"
              disabled={loading || Boolean(upgrade)}
              onClick={() => submitRequest()}
            >
              {loading ? "Sending…" : "Find it"}
            </Button>
            <p className="mt-3 text-center text-xs leading-relaxed text-ink-subtle">
              We’ll ask participating stores near your ZIP. Your contact stays private.
            </p>
          </div>
        )}
      </div>
      <GlassSheet
        open={ageGateOpen}
        onOpenChange={onAgeGateOpenChange}
        title={AGE_RESTRICTED_ID_TITLE}
        description={AGE_RESTRICTED_ID_BODY}
      >
        <p className="text-sm leading-relaxed text-ink">
          {AGE_RESTRICTED_FIND_HINT}
        </p>
        <Button
          className="mt-6 h-auto min-h-14 w-full whitespace-normal text-center"
          size="xl"
          onClick={confirmAgeGate}
        >
          {AGE_RESTRICTED_ID_CONFIRM}
        </Button>
      </GlassSheet>
    </div>
  );
}
