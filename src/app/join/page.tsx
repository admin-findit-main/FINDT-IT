"use client";

import Link from "next/link";
import { useState } from "react";
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
  formatEin,
  normalizeEin,
  passwordRejectReason,
  storeSelectionSuggestsCustomerId,
  US_STATES,
} from "@findit/domain";
import { submitStoreApplicationAction } from "@/lib/services/actions";
import { marketingHomeHref } from "@/lib/config/product-hosts";
import { PasswordStrengthMeter } from "@/components/auth/password-strength";

const STEPS = ["Account", "Legal", "Location", "Products", "Review"] as const;

export default function JoinAsStorePage() {
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [existingAccount, setExistingAccount] = useState(false);

  const [ownerName, setOwnerName] = useState("");
  const [ownerEmail, setOwnerEmail] = useState("");
  const [ownerPhone, setOwnerPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

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
      if (password.length < 8) {
        toast.error("Password must be at least 8 characters");
        return false;
      }
      const weak = passwordRejectReason(password, ownerEmail);
      if (weak) {
        toast.error(weak);
        return false;
      }
      if (password !== confirmPassword) {
        toast.error("Passwords do not match");
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
      if (streetAddress.trim().length < 3) {
        toast.error("Enter the street address");
        return false;
      }
      if (city.trim().length < 2) {
        toast.error("Enter the city");
        return false;
      }
      if (!/^\d{5}(-\d{4})?$/.test(postalCode.trim())) {
        toast.error("Enter a valid ZIP code");
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
    const result = await submitStoreApplicationAction({
      ownerName,
      ownerEmail,
      ownerPhone,
      password,
      confirmPassword,
      legalName,
      ein: normalizeEin(ein),
      entityType,
      businessName,
      businessType,
      streetAddress,
      city,
      state,
      postalCode,
      phone,
      website,
      whyLegit,
      requestCategories,
      requiresCustomerId: requiresCustomerId === true,
      confirmedLegitimate: true as const,
    });
    setLoading(false);
    if (result.error) {
      if ("code" in result && result.code === "existing_account") {
        setExistingAccount(true);
        return;
      }
      toast.error(result.error);
      return;
    }
    setSubmitted(true);
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
              <Link href={marketingHomeHref()}>Go back to askfindit.com</Link>
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
              </strong>{" "}
              — no credit card.
            </p>
            <Button asChild className="mt-8" size="lg">
              <Link href="/login/business">Store login</Link>
            </Button>
            <Button asChild variant="ghost" className="mt-3" size="lg">
              <Link href={marketingHomeHref()}>Go back to askfindit.com</Link>
            </Button>
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
          <Button asChild variant="ghost" size="sm">
            <Link href="/login/business">Already accepted? Log in</Link>
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-6 pb-20 pt-6 md:pt-10">
        <Overline>Stores</Overline>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-ink md:text-4xl">
          Apply your business
        </h1>
        <p className="mt-3 max-w-xl leading-relaxed text-ink-muted">
          Complete each step so we can verify you. After FINDIT accepts the
          application, you get a blue verified badge for shoppers, then you can
          open the dashboard and connect Hub. Employees join later with an invite.
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
                      This is the login you&apos;ll use after we accept you.
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
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <Label htmlFor="password">Password</Label>
                    <Input
                      id="password"
                      type="password"
                      minLength={8}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      autoComplete="new-password"
                    />
                    <PasswordStrengthMeter password={password} email={ownerEmail} />
                  </div>
                  <div>
                    <Label htmlFor="confirmPassword">Confirm password</Label>
                    <Input
                      id="confirmPassword"
                      type="password"
                      minLength={8}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                      autoComplete="new-password"
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
                        : "9 digits. Paste with or without the dash — FINDIT will read it."}
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
                <div>
                  <Label htmlFor="streetAddress">Street address</Label>
                  <Input
                    id="streetAddress"
                    value={streetAddress}
                    onChange={(e) => setStreetAddress(e.target.value)}
                    required
                  />
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-2">
                    <Label htmlFor="city">City</Label>
                    <Input
                      id="city"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="postalCode">ZIP</Label>
                    <Input
                      id="postalCode"
                      value={postalCode}
                      onChange={(e) => setPostalCode(e.target.value)}
                      required
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="state">State</Label>
                  <select
                    id="state"
                    className="mt-1.5 h-12 w-full rounded-2xl border border-hairline-strong bg-white px-4 text-sm text-ink"
                    value={state}
                    onChange={(e) => setState(e.target.value)}
                  >
                    {US_STATES.map((item) => (
                      <option key={item.code} value={item.code}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                </div>
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
                    I can open the dashboard and connect devices ({STORE_TRIAL_DAYS}
                    -day free trial — no credit card).
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
                  ? "Submitting…"
                  : step < STEPS.length - 1
                    ? "Continue"
                    : "Submit application"}
              </Button>
            </div>
          </form>
        </Card>
      </main>
    </div>
  );
}
