"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, Input, Label } from "@/components/ui/primitives";
import { GlassSelect } from "@/components/ui/glass";
import { BrandHomeLink } from "@/components/brand/logo";
import { STORE_CATEGORIES, STORE_TRIAL_DAYS } from "@/lib/config/constants";
import {
  OTP_RESEND_SECONDS,
  normalizeStoreLocation,
  storeSelectionSuggestsCustomerId,
} from "@findit/domain";
import { FINDIT_CATALOG } from "@findit/domain";
import {
  sendStoreJoinEmailCodeAction,
  submitStoreApplicationAction,
} from "@/lib/services/actions";
import { AuthAudienceSwitch, AuthIntentSwitch } from "@/components/auth/auth-audience";
import { StoreAddressFields } from "@/components/store/store-address-fields";
import {
  useMarketingHomeHref,
  useSurfaceHref,
} from "@/components/host/host-surface";

function defaultRequestCategories(businessType: string): string[] {
  const fromCatalog = FINDIT_CATALOG.find(
    (t) => t.name === businessType || t.id === businessType
  );
  if (fromCatalog) {
    return [fromCatalog.productCategory];
  }
  if (businessType === "Smoke Shop") return ["Tobacco & Vape"];
  if (businessType === "Dispensary") return ["Dispensary"];
  if (businessType === "Coffee Shop") return ["Coffee"];
  if (businessType === "Nail Salon") return ["Nails"];
  if (businessType === "Auto Parts") return ["Auto Parts"];
  return [businessType === "Specialty Retail" ? "Specialty" : businessType].filter(
    Boolean
  );
}

export default function JoinAsStorePage() {
  const homeHref = useMarketingHomeHref();
  const storeLogin = useSurfaceHref("store", "/login/business");
  const shopperSignup = useSurfaceHref("dashboard", "/signup");
  const joinHref = useSurfaceHref("www", "/join");
  const [phase, setPhase] = useState<"form" | "code" | "done">("form");
  const [loading, setLoading] = useState(false);
  const [existingAccount, setExistingAccount] = useState(false);
  const [emailCode, setEmailCode] = useState("");
  const [resendSeconds, setResendSeconds] = useState(0);

  const [ownerName, setOwnerName] = useState("");
  const [ownerEmail, setOwnerEmail] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [legalName, setLegalName] = useState("");
  const [businessType, setBusinessType] = useState<string>(STORE_CATEGORIES[0]!);
  const [streetAddress, setStreetAddress] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("VA");
  const [postalCode, setPostalCode] = useState("");
  const [phone, setPhone] = useState("");
  const [website, setWebsite] = useState("");
  const [confirmed, setConfirmed] = useState(false);

  useEffect(() => {
    if (resendSeconds <= 0) return;
    const id = window.setInterval(
      () => setResendSeconds((s) => Math.max(0, s - 1)),
      1000
    );
    return () => window.clearInterval(id);
  }, [resendSeconds]);

  function applicationPayload() {
    const location = normalizeStoreLocation({
      streetAddress,
      city,
      state,
      postalCode,
    });
    const requestCategories = defaultRequestCategories(businessType);
    const needsId = storeSelectionSuggestsCustomerId({
      businessType,
      requestCategories,
    });
    return {
      ownerName,
      ownerEmail,
      ownerPhone: "",
      legalName: legalName.trim() || businessName.trim(),
      ein: "",
      entityType: "Other" as const,
      businessName,
      businessType,
      streetAddress: location.street,
      city: location.city,
      state: location.state,
      postalCode: location.postalCode,
      phone: phone.trim(),
      website,
      whyLegit: "Pending FINDIT store review.",
      requestCategories:
        requestCategories.length > 0 ? requestCategories : ["Specialty"],
      requiresCustomerId: needsId,
      confirmedLegitimate: true as const,
    };
  }

  async function sendCode() {
    if (!confirmed) {
      toast.error("Confirm this is a real store to continue");
      return;
    }
    if (!businessName.trim()) {
      toast.error("Enter your store name");
      return;
    }
    if (!phone.trim()) {
      toast.error("Enter the store phone number");
      return;
    }
    if (!ownerName.trim() || !ownerEmail.trim()) {
      toast.error("Enter your name and work email");
      return;
    }
    setLoading(true);
    const result = await sendStoreJoinEmailCodeAction(ownerEmail);
    setLoading(false);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    setEmailCode("");
    setResendSeconds(OTP_RESEND_SECONDS);
    setPhase("code");
    toast.success("Code sent");
  }

  async function submitApplication() {
    setLoading(true);
    const result = await submitStoreApplicationAction({
      ...applicationPayload(),
      emailCode,
    });
    setLoading(false);
    if (result.error) {
      if ("code" in result && result.code === "existing_account") {
        setExistingAccount(true);
        setPhase("done");
        return;
      }
      toast.error(result.error);
      return;
    }
    setPhase("done");
  }

  return (
    <div className="app-canvas min-h-dvh">
      <header className="sticky top-0 z-40 border-b border-hairline-strong bg-white/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-lg items-center justify-between px-5 py-3.5">
          <BrandHomeLink href={homeHref} kind="business" />
          <Link
            href={storeLogin}
            className="text-sm font-semibold text-ink-muted underline-offset-2 hover:text-ink hover:underline"
          >
            Sign in
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-lg px-5 py-8 pb-16 sm:py-10">
        {phase === "done" ? (
          <Card className="p-6 sm:p-8">
            <p className="text-[12px] font-semibold tracking-[0.14em] text-ink-muted">
              FINDIT BUSINESS
            </p>
            <h1 className="mt-3 text-2xl font-bold tracking-tight text-ink">
              {existingAccount ? "You already have an account" : "Application received"}
            </h1>
            <p className="mt-3 text-sm leading-relaxed text-ink-muted">
              {existingAccount
                ? "Sign in with that email. If you already applied, we are still reviewing your store."
                : `Thanks. We review each store before it goes live. Approved stores get ${STORE_TRIAL_DAYS} days free. Check your email for next steps.`}
            </p>
            <Button asChild className="mt-6 w-full" size="lg">
              <Link href={storeLogin}>Sign in to FINDIT Business</Link>
            </Button>
          </Card>
        ) : null}

        {phase === "code" ? (
          <Card className="p-6 sm:p-8">
            <p className="text-[12px] font-semibold tracking-[0.14em] text-ink-muted">
              CONFIRM EMAIL
            </p>
            <h1 className="mt-3 text-2xl font-bold tracking-tight text-ink">
              Enter your code
            </h1>
            <p className="mt-2 text-sm text-ink-muted">
              We sent a 6-digit code to{" "}
              <span className="font-medium text-ink">{ownerEmail.trim()}</span>.
            </p>
            <form
              className="mt-6 space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                void submitApplication();
              }}
            >
              <div>
                <Label htmlFor="join-code">Code</Label>
                <Input
                  id="join-code"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  value={emailCode}
                  onChange={(e) =>
                    setEmailCode(e.target.value.replace(/\D/g, "").slice(0, 6))
                  }
                  className="mt-1.5 tracking-[0.35em]"
                  autoFocus
                  required
                />
              </div>
              <Button
                type="submit"
                className="w-full"
                size="lg"
                disabled={loading || emailCode.length !== 6}
              >
                {loading ? "Submitting…" : "Submit application"}
              </Button>
              <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-ink-muted">
                <button
                  type="button"
                  className="font-medium text-ink underline-offset-2 hover:underline"
                  onClick={() => setPhase("form")}
                >
                  Edit details
                </button>
                <button
                  type="button"
                  className="font-medium text-ink underline-offset-2 hover:underline disabled:text-ink-muted disabled:no-underline"
                  disabled={loading || resendSeconds > 0}
                  onClick={() => void sendCode()}
                >
                  {resendSeconds > 0
                    ? `Resend in ${resendSeconds}s`
                    : "Resend code"}
                </button>
              </div>
            </form>
          </Card>
        ) : null}

        {phase === "form" ? (
          <div className="space-y-5">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-subtle">
                Account type
              </p>
              <div className="mt-2">
                <AuthAudienceSwitch
                  audience="store"
                  shopperHref={shopperSignup}
                  storeHref={joinHref}
                />
              </div>
              <AuthIntentSwitch audience="store" intent="create" />
              <h1 className="mt-6 text-3xl font-bold tracking-tight text-ink">
                Apply your store
              </h1>
              <p className="mt-2 text-sm leading-relaxed text-ink-muted">
                One short form. We review each business before it goes live.
              </p>
            </div>

            <Card className="space-y-5 p-5 sm:p-6">
              <section className="space-y-4">
                <h2 className="text-sm font-semibold text-ink">Store</h2>
                <div>
                  <Label htmlFor="join-store-name">Store name</Label>
                  <Input
                    id="join-store-name"
                    value={businessName}
                    onChange={(e) => setBusinessName(e.target.value)}
                    placeholder="What customers see"
                    className="mt-1.5"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="join-legal-name">
                    Company name{" "}
                    <span className="font-normal text-ink-muted">(optional)</span>
                  </Label>
                  <Input
                    id="join-legal-name"
                    value={legalName}
                    onChange={(e) => setLegalName(e.target.value)}
                    placeholder="Leave blank if same as store name"
                    className="mt-1.5"
                  />
                  <p className="mt-1 text-xs text-ink-muted">
                    Legal name from your business papers, if different.
                  </p>
                </div>
                <div>
                  <Label htmlFor="join-type">Store type</Label>
                  <GlassSelect
                    id="join-type"
                    className="mt-1.5"
                    value={businessType}
                    onChange={(e) => setBusinessType(e.target.value)}
                  >
                    {STORE_CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </GlassSelect>
                </div>
              </section>

              <section className="space-y-4 border-t border-hairline-strong pt-5">
                <h2 className="text-sm font-semibold text-ink">You</h2>
                <div>
                  <Label htmlFor="join-owner">Your name</Label>
                  <Input
                    id="join-owner"
                    value={ownerName}
                    onChange={(e) => setOwnerName(e.target.value)}
                    className="mt-1.5"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="join-email">Work email</Label>
                  <Input
                    id="join-email"
                    type="email"
                    autoComplete="email"
                    value={ownerEmail}
                    onChange={(e) => setOwnerEmail(e.target.value)}
                    className="mt-1.5"
                    required
                  />
                </div>
              </section>

              <section className="space-y-4 border-t border-hairline-strong pt-5">
                <h2 className="text-sm font-semibold text-ink">Location</h2>
                <StoreAddressFields
                  idPrefix="join"
                  street={streetAddress}
                  city={city}
                  state={state}
                  postalCode={postalCode}
                  onChange={(next) => {
                    setStreetAddress(next.street);
                    setCity(next.city);
                    setState(next.state);
                    setPostalCode(next.postalCode);
                  }}
                />
                <div>
                  <Label htmlFor="join-phone">Phone</Label>
                  <Input
                    id="join-phone"
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="Store phone"
                    className="mt-1.5"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="join-web">
                    Website{" "}
                    <span className="font-normal text-ink-muted">(optional)</span>
                  </Label>
                  <Input
                    id="join-web"
                    value={website}
                    onChange={(e) => setWebsite(e.target.value)}
                    placeholder="yourstore.com"
                    className="mt-1.5"
                  />
                </div>
              </section>

              <label className="flex items-start gap-3 rounded-xl border border-hairline-strong px-3 py-3 text-sm text-ink">
                <input
                  type="checkbox"
                  className="mt-1 h-4 w-4 rounded border-hairline-strong"
                  checked={confirmed}
                  onChange={(e) => setConfirmed(e.target.checked)}
                />
                <span>
                  This is a real store. FINDIT will review before anything goes
                  live.
                </span>
              </label>

              <Button
                type="button"
                className="w-full"
                size="lg"
                disabled={loading}
                onClick={() => void sendCode()}
              >
                {loading ? "Sending code…" : "Continue with email code"}
              </Button>
            </Card>
          </div>
        ) : null}
      </main>
    </div>
  );
}
