"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { GlassChip, GlassNotice, Overline } from "@/components/ui/glass";
import { Card, Input, Label, Textarea } from "@/components/ui/primitives";
import {
  BUSINESS_ENTITY_TYPES,
  STORE_CATEGORIES,
  STORE_TRIAL_DAYS,
} from "@/lib/config/constants";
import { BrandHomeLink } from "@/components/brand/logo";
import { JOIN_REQUEST_CATEGORIES } from "@/lib/services/category-routing";
import {
  OTP_RESEND_SECONDS,
  formatEin,
  normalizeEin,
  normalizeStoreLocation,
  storeSelectionSuggestsCustomerId,
} from "@findit/domain";
import {
  sendStoreJoinEmailCodeAction,
  submitStoreApplicationAction,
} from "@/lib/services/actions";
import { AuthAudienceSwitch } from "@/components/auth/auth-audience";
import { StoreAddressFields } from "@/components/store/store-address-fields";
import {
  useMarketingHomeHref,
  useSurfaceHref,
} from "@/components/host/host-surface";

const STEPS = ["Account", "Legal", "Location", "Products", "Review"] as const;

export default function JoinAsStorePage() {
  const homeHref = useMarketingHomeHref();
  const shopperSignup = useSurfaceHref("dashboard", "/signup");
  const shopperLogin = useSurfaceHref("dashboard", "/login");
  const storeLogin = useSurfaceHref("store", "/login/business");
  const joinHref = useSurfaceHref("www", "/join");
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [existingAccount, setExistingAccount] = useState(false);
  const [awaitingCode, setAwaitingCode] = useState(false);
  const [emailCode, setEmailCode] = useState("");
  const [resendSeconds, setResendSeconds] = useState(0);

  const [ownerName, setOwnerName] = useState("");
  const [ownerEmail, setOwnerEmail] = useState("");
  const [ownerPhone, setOwnerPhone] = useState("");

  const [legalName, setLegalName] = useState("");
  const [ein, setEin] = useState("");
  const [entityType, setEntityType] = useState<(typeof BUSINESS_ENTITY_TYPES)[number]>(
    "LLC"
  );
  const [businessName, setBusinessName] = useState("");
  const [businessType, setBusinessType] = useState<string>(STORE_CATEGORIES[0]);

  const [streetAddress, setStreetAddress] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("VA");
  const [postalCode, setPostalCode] = useState("");
  const [phone, setPhone] = useState("");
  const [website, setWebsite] = useState("");

  const [requestCategories, setRequestCategories] = useState<string[]>([
    "Grocery",
    "Convenience",
  ]);
  const [requiresCustomerId, setRequiresCustomerId] = useState<boolean | null>(null);
  const [whyLegit, setWhyLegit] = useState("");
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
    return {
      ownerName,
      ownerEmail,
      ownerPhone,
      legalName,
      ein: normalizeEin(ein),
      entityType,
      businessName,
      businessType,
      streetAddress: location.street,
      city: location.city,
      state: location.state,
      postalCode: location.postalCode,
      phone,
      website,
      whyLegit,
      requestCategories,
      requiresCustomerId: requiresCustomerId === true,
      confirmedLegitimate: true as const,
    };
  }

  function setType(next: string) {
    setBusinessType(next);
    if (next === "Smoke Shop") {
      setRequestCategories((prev) =>
        prev.includes("Tobacco & Vape") ? prev : [...prev, "Tobacco & Vape"]
      );
      if (requiresCustomerId == null) setRequiresCustomerId(true);
    }
    if (next === "Coffee Shop") {
      setRequestCategories((prev) => (prev.includes("Coffee") ? prev : [...prev, "Coffee"]));
    }
    if (next === "Nail Salon") {
      setRequestCategories((prev) => (prev.includes("Nails") ? prev : [...prev, "Nails"]));
    }
    if (next === "Auto Parts") {
      setRequestCategories((prev) =>
        prev.includes("Auto Parts") ? prev : [...prev, "Auto Parts"]
      );
    }
  }

  function toggleCategory(c: string) {
    setRequestCategories((prev) => {
      const next = prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c];
      if (c === "Tobacco & Vape" && !prev.includes(c) && requiresCustomerId == null) {
        setRequiresCustomerId(true);
      }
      return next;
    });
  }

  function validateStep(index: number): boolean {
    if (index === 0) {
      if (ownerName.trim().length < 2) {
        toast.error("Enter the owner or manager name");
        return false;
      }
      if (!ownerEmail.includes("@")) {
        toast.error("Enter a valid email");
        return false;
      }
    }
    if (index === 1) {
      if (legalName.trim().length < 2) {
        toast.error("Enter the legal business name on your EIN");
        return false;
      }
      if (!normalizeEin(ein) || normalizeEin(ein).length !== 9) {
        toast.error("Enter the 9-digit EIN");
        return false;
      }
      if (businessName.trim().length < 2) {
        toast.error("Enter the storefront name customers will see");
        return false;
      }
    }
    if (index === 2) {
      const location = normalizeStoreLocation({
        streetAddress,
        city,
        state,
        postalCode,
      });
      setStreetAddress(location.street);
      setCity(location.city);
      setState(location.state);
      setPostalCode(location.postalCode);
      if (location.street.length < 3) {
        toast.error("Enter the street, not the full mailing line");
        return false;
      }
      if (location.city.length < 2) {
        toast.error("Enter the city");
        return false;
      }
      if (!/^\d{5}$/.test(location.postalCode)) {
        toast.error("Enter a valid ZIP code");
        return false;
      }
      if (!location.state) {
        toast.error("Pick a state");
        return false;
      }
      if (phone.trim().length < 7) {
        toast.error("Enter the business phone");
        return false;
      }
    }
    if (index === 3) {
      if (!requestCategories.length) {
        toast.error("Select at least one product category to receive");
        return false;
      }
      if (requiresCustomerId == null) {
        toast.error("Tell us whether customers must show a government ID");
        return false;
      }
    }
    if (index === 4) {
      if (whyLegit.trim().length < 20) {
        toast.error("Tell us a bit more about the business");
        return false;
      }
      if (!confirmed) {
        toast.error("Confirm you are a legitimate business");
        return false;
      }
    }
    return true;
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (step < STEPS.length - 1) {
      if (!validateStep(step)) return;
      setStep((n) => n + 1);
      return;
    }
    if (!validateStep(4)) return;
    setLoading(true);
    const sent = await sendStoreJoinEmailCodeAction(ownerEmail);
    setLoading(false);
    if (sent.error) {
      if ("code" in sent && sent.code === "existing_account") {
        setExistingAccount(true);
        return;
      }
      toast.error(sent.error);
      return;
    }
    setEmailCode("");
    setResendSeconds(OTP_RESEND_SECONDS);
    setAwaitingCode(true);
    toast.success(
      "message" in sent && sent.message
        ? sent.message
        : "Check your email for a 6-digit code"
    );
  }

  async function onConfirmCode(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (emailCode.replace(/\D/g, "").length !== 6) {
      toast.error("Enter the 6-digit code from your email");
      return;
    }
    setLoading(true);
    const result = await submitStoreApplicationAction({
      ...applicationPayload(),
      emailCode,
    });
    setLoading(false);
    if ("error" in result && result.error) {
      if ("code" in result && result.code === "existing_account") {
        setExistingAccount(true);
        return;
      }
      toast.error(result.error);
      return;
    }
    setSubmitted(true);
  }

  async function resendCode() {
    if (resendSeconds > 0) return;
    setLoading(true);
    const sent = await sendStoreJoinEmailCodeAction(ownerEmail);
    setLoading(false);
    if (sent.error) {
      toast.error(sent.error);
      return;
    }
    setResendSeconds(OTP_RESEND_SECONDS);
    toast.success(
      "message" in sent && sent.message
        ? sent.message
        : "We sent another code"
    );
  }

  if (existingAccount) {
    return (
      <div className="app-canvas min-h-screen">
        <header className="glass-chrome sticky top-0 z-50 border-b border-hairline-strong">
          <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-4">
            <BrandHomeLink href="/" />
          </div>
        </header>
        <main className="mx-auto max-w-xl px-6 py-16">
          <Card level="strong" sheen className="p-8 text-center">
            <h1 className="text-2xl font-bold tracking-tight text-ink">
              That email already has an account
            </h1>
            <p className="mt-4 leading-relaxed text-ink-muted">
              FINDIT does not create a second login for the same email. Go back
              to askfindit.com.
            </p>
            <Button asChild className="mt-8" size="lg">
              <Link href={shopperLogin}>Shopper sign in</Link>
            </Button>
            <Button asChild variant="outline" className="mt-3" size="lg">
              <Link href={storeLogin}>Store sign in</Link>
            </Button>
            <Button asChild variant="ghost" className="mt-3" size="lg">
              <Link href={homeHref}>Go back to askfindit.com</Link>
            </Button>
          </Card>
        </main>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="app-canvas min-h-screen">
        <header className="glass-chrome sticky top-0 z-50 border-b border-hairline-strong">
          <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-4">
            <BrandHomeLink href="/" />
          </div>
        </header>
        <main className="mx-auto max-w-xl px-6 py-16">
          <Card level="strong" sheen className="p-8 text-center">
            <h1 className="text-2xl font-bold tracking-tight text-ink">
              Application received
            </h1>
            <p className="mt-4 leading-relaxed text-ink-muted">
              FINDIT will review your EIN and business details. After we accept
              you, log in to open your dashboard, connect FINDIT Hub, and start
              answering nearby Asks. Approved stores get{" "}
              <strong className="font-semibold text-ink">
                {STORE_TRIAL_DAYS} days free
              </strong>
              .
            </p>
            <Button asChild className="mt-8" size="lg">
              <Link href={storeLogin}>Store login</Link>
            </Button>
            <Button asChild variant="outline" className="mt-3" size="lg">
              <Link href={shopperLogin}>Shopper sign in</Link>
            </Button>
            <Button asChild variant="ghost" className="mt-3" size="lg">
              <Link href={homeHref}>Go back to askfindit.com</Link>
            </Button>
          </Card>
        </main>
      </div>
    );
  }

  if (awaitingCode) {
    return (
      <div className="app-canvas min-h-screen">
        <header className="glass-chrome sticky top-0 z-50 border-b border-hairline-strong">
          <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-4">
            <BrandHomeLink href="/" />
          </div>
        </header>
        <main className="mx-auto max-w-xl px-6 py-16">
          <Card level="strong" sheen className="p-8">
            <h1 className="text-2xl font-bold tracking-tight text-ink">
              Confirm your email
            </h1>
            <p className="mt-3 text-sm leading-relaxed text-ink-muted">
              We emailed a 6-digit code to{" "}
              <span className="font-semibold text-ink">{ownerEmail}</span>.
              Enter it here to create your store login and send the application.
              Until you do, nothing is set up. Phone confirmation can come later.
            </p>
            <form onSubmit={onConfirmCode} className="mt-6 space-y-4">
              <div>
                <Label htmlFor="join-email-code">6-digit code</Label>
                <Input
                  id="join-email-code"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  pattern="[0-9]*"
                  maxLength={6}
                  value={emailCode}
                  onChange={(e) =>
                    setEmailCode(e.target.value.replace(/\D/g, "").slice(0, 6))
                  }
                  required
                  autoFocus
                  className="mt-1 tracking-[0.4em]"
                />
              </div>
              <Button
                type="submit"
                className="w-full"
                size="lg"
                disabled={loading || emailCode.length !== 6}
              >
                {loading ? "Sending application…" : "Confirm and send application"}
              </Button>
            </form>
            <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-sm text-ink-muted">
              <button
                type="button"
                className="font-semibold text-ink underline-offset-2 hover:underline disabled:opacity-50"
                disabled={loading || resendSeconds > 0}
                onClick={() => void resendCode()}
              >
                {resendSeconds > 0
                  ? `Send another code in ${resendSeconds}s`
                  : "Send another code"}
              </button>
              <button
                type="button"
                className="font-semibold text-ink underline-offset-2 hover:underline"
                onClick={() => {
                  setAwaitingCode(false);
                  setEmailCode("");
                  setStep(0);
                }}
              >
                Use a different email
              </button>
            </div>
          </Card>
        </main>
      </div>
    );
  }

  return (
    <div className="app-canvas min-h-screen">
      <header className="glass-chrome sticky top-0 z-50 border-b border-hairline-strong">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-4">
          <BrandHomeLink href="/" />
          <div className="flex items-center gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href={shopperLogin}>Shopper sign in</Link>
            </Button>
            <Button asChild variant="ghost" size="sm">
              <Link href={storeLogin}>Already accepted? Log in</Link>
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-6 pb-20 pt-6 md:pt-10">
        <AuthAudienceSwitch
          audience="store"
          shopperHref={shopperSignup}
          storeHref={joinHref}
        />
        <Overline className="mt-6">Stores</Overline>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-ink md:text-4xl">
          Apply your business
        </h1>
        <p className="mt-3 max-w-xl leading-relaxed text-ink-muted">
          Complete each step so we can verify you. We email a 6-digit code to
          confirm this address before we send the application. After we accept
          you, sign in with another email code — FINDIT does not use passwords.
        </p>
        <GlassNotice tone="accent" className="mt-4 font-semibold">
          {STORE_TRIAL_DAYS} DAYS FREE · NO CREDIT CARD REQUIRED
        </GlassNotice>

        <div className="mt-8 flex gap-2" aria-hidden>
          {STEPS.map((label, i) => (
            <span
              key={label}
              className={
                i <= step
                  ? "h-1.5 flex-1 rounded-full bg-accent"
                  : "h-1.5 flex-1 rounded-full bg-black/[0.08]"
              }
            />
          ))}
        </div>
        <p className="mt-3 text-sm font-semibold text-ink">
          Step {step + 1} of {STEPS.length} · {STEPS[step]}
        </p>

        <Card level="strong" sheen className="mt-4 p-6 md:p-8">
          <form onSubmit={onSubmit} className="space-y-5">
            {step === 0 ? (
              <>
                <p className="text-sm font-semibold text-ink">Owner login</p>
                <div>
                  <Label htmlFor="ownerName">Owner / manager name</Label>
                  <Input
                    id="ownerName"
                    value={ownerName}
                    onChange={(e) => setOwnerName(e.target.value)}
                    required
                  />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <Label htmlFor="ownerEmail">Email</Label>
                    <Input
                      id="ownerEmail"
                      type="email"
                      value={ownerEmail}
                      onChange={(e) => setOwnerEmail(e.target.value)}
                      required
                    />
                    <p className="mt-1 text-xs text-ink-muted">
                      After we accept you, we&apos;ll email a 6-digit code to
                      this address to sign in. No password.
                    </p>
                  </div>
                  <div>
                    <Label htmlFor="ownerPhone">Phone (optional)</Label>
                    <Input
                      id="ownerPhone"
                      type="tel"
                      value={ownerPhone}
                      onChange={(e) => setOwnerPhone(e.target.value)}
                    />
                  </div>
                </div>
              </>
            ) : null}

            {step === 1 ? (
              <>
                <p className="text-sm font-semibold text-ink">Legal identity</p>
                <p className="text-xs text-ink-muted">
                  Use the name and EIN on your IRS paperwork. Shoppers see the
                  storefront name, not your EIN.
                </p>
                <div>
                  <Label htmlFor="legalName">Legal business name</Label>
                  <Input
                    id="legalName"
                    value={legalName}
                    onChange={(e) => setLegalName(e.target.value)}
                    placeholder="As it appears on the EIN"
                    required
                  />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <Label htmlFor="ein">EIN</Label>
                    <Input
                      id="ein"
                      name="ein"
                      type="text"
                      inputMode="numeric"
                      autoComplete="off"
                      value={ein}
                      onChange={(e) => setEin(normalizeEin(e.target.value))}
                      placeholder="123456789"
                    />
                    <p className="mt-1 text-xs text-ink-muted">
                      {ein
                        ? `Reading ${formatEin(ein)}${ein.length === 9 ? " · 9 digits" : ` · ${ein.length} of 9 digits`}`
                        : "9 digits. Paste with or without the dash. FINDIT will read it."}
                    </p>
                  </div>
                  <div>
                    <Label htmlFor="entityType">Entity type</Label>
                    <select
                      id="entityType"
                      className="mt-1.5 h-12 w-full rounded-2xl border border-hairline-strong bg-white px-4 text-sm text-ink"
                      value={entityType}
                      onChange={(e) =>
                        setEntityType(
                          e.target.value as (typeof BUSINESS_ENTITY_TYPES)[number]
                        )
                      }
                    >
                      {BUSINESS_ENTITY_TYPES.map((type) => (
                        <option key={type} value={type}>
                          {type}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div>
                  <Label htmlFor="businessName">Storefront name</Label>
                  <Input
                    id="businessName"
                    value={businessName}
                    onChange={(e) => setBusinessName(e.target.value)}
                    placeholder="What customers will see"
                    required
                  />
                </div>
                <div>
                  <Label>Business type</Label>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {STORE_CATEGORIES.map((c) => (
                      <GlassChip
                        key={c}
                        selected={businessType === c}
                        onClick={() => setType(c)}
                      >
                        {c}
                      </GlassChip>
                    ))}
                  </div>
                </div>
              </>
            ) : null}

            {step === 2 ? (
              <>
                <p className="text-sm font-semibold text-ink">Store location</p>
                <StoreAddressFields
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
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <Label htmlFor="phone">Business phone</Label>
                    <Input
                      id="phone"
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="website">Website (optional)</Label>
                    <Input
                      id="website"
                      value={website}
                      onChange={(e) => setWebsite(e.target.value)}
                      placeholder="yourstore.com"
                    />
                  </div>
                </div>
              </>
            ) : null}

            {step === 3 ? (
              <>
                <div>
                  <Label>Receive customer requests for</Label>
                  <p className="mt-1 text-xs text-ink-muted">
                    Only matching product requests will be sent to your store.
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {JOIN_REQUEST_CATEGORIES.map((c) => (
                      <GlassChip
                        key={c}
                        selected={requestCategories.includes(c)}
                        onClick={() => toggleCategory(c)}
                      >
                        {c}
                      </GlassChip>
                    ))}
                  </div>
                </div>
                <div>
                  <Label>Do customers need a government ID?</Label>
                  <p className="mt-1 text-xs text-ink-muted">
                    Tobacco, vape, and similar products. FINDIT will ask those
                    customers to confirm they are 21+ before the Find goes out. You
                    still check ID in the store.
                  </p>
                  {storeSelectionSuggestsCustomerId({
                    businessType,
                    requestCategories,
                  }) ? (
                    <p className="mt-1 text-xs font-medium text-ink">
                      Smoke shops and Tobacco & Vape requests almost always need this.
                    </p>
                  ) : null}
                  <div className="mt-2 flex flex-wrap gap-2">
                    <GlassChip
                      selected={requiresCustomerId === true}
                      onClick={() => setRequiresCustomerId(true)}
                    >
                      Yes, we check ID
                    </GlassChip>
                    <GlassChip
                      selected={requiresCustomerId === false}
                      onClick={() => setRequiresCustomerId(false)}
                    >
                      No
                    </GlassChip>
                  </div>
                </div>
              </>
            ) : null}

            {step === 4 ? (
              <>
                <div className="rounded-2xl border border-hairline-strong bg-white p-4 text-sm">
                  <p className="font-semibold text-ink">{businessName || "Storefront"}</p>
                  <p className="mt-1 text-ink-muted">
                    {legalName} · {entityType} · EIN {formatEin(ein) || "—"}
                  </p>
                  <p className="mt-1 text-ink-muted">
                    {streetAddress}
                    {city ? ` · ${city}, ${state} ${postalCode}` : ""}
                  </p>
                  <p className="mt-1 text-ink-muted">
                    {requestCategories.join(", ") || "No categories yet"}
                  </p>
                </div>
                <div>
                  <Label htmlFor="whyLegit">Why is this a legitimate business?</Label>
                  <Textarea
                    id="whyLegit"
                    value={whyLegit}
                    onChange={(e) => setWhyLegit(e.target.value)}
                    required
                    placeholder="Licensed location, years in business, what you sell…"
                    className="min-h-28"
                  />
                </div>
                <label className="flex items-start gap-3 rounded-glass-lg border border-hairline-strong bg-glass-1 p-4 text-sm leading-relaxed text-ink-muted">
                  <input
                    type="checkbox"
                    className="mt-0.5 h-4 w-4 accent-[var(--accent)]"
                    checked={confirmed}
                    onChange={(e) => setConfirmed(e.target.checked)}
                  />
                  <span>
                    I confirm this is a real, legitimate business. The EIN and
                    legal name are accurate. After FINDIT accepts this application
                    I can open the dashboard and connect devices. Approved stores
                    get a {STORE_TRIAL_DAYS}-day free trial.
                  </span>
                </label>
              </>
            ) : null}

            <div className="flex gap-3 pt-2">
              {step > 0 ? (
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  size="xl"
                  onClick={() => setStep((n) => n - 1)}
                >
                  Back
                </Button>
              ) : null}
              <Button type="submit" className="flex-1" size="xl" disabled={loading}>
                {loading
                  ? step < STEPS.length - 1
                    ? "Continuing…"
                    : "Sending code…"
                  : step < STEPS.length - 1
                    ? "Continue"
                    : "Email me a code"}
              </Button>
            </div>
          </form>
        </Card>
      </main>
    </div>
  );
}
