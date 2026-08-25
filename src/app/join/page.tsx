"use client";

import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { GlassChip, GlassNotice, Overline } from "@/components/ui/glass";
import { Card, Input, Label, Textarea } from "@/components/ui/primitives";
import { STORE_CATEGORIES, STORE_TRIAL_DAYS } from "@/lib/config/constants";
import { BrandHomeLink } from "@/components/brand/logo";
import { JOIN_REQUEST_CATEGORIES } from "@/lib/services/category-routing";
import { storeSelectionSuggestsCustomerId } from "@findit/domain";
import { submitStoreApplicationAction } from "@/lib/services/actions";

export default function JoinAsStorePage() {
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [businessType, setBusinessType] = useState<string>(STORE_CATEGORIES[0]);
  const [requestCategories, setRequestCategories] = useState<string[]>([
    "Grocery",
    "Convenience",
  ]);
  const [requiresCustomerId, setRequiresCustomerId] = useState<boolean | null>(
    null
  );
  const [confirmed, setConfirmed] = useState(false);

  function setType(next: string) {
    setBusinessType(next);
    if (next === "Smoke Shop") {
      setRequestCategories((prev) =>
        prev.includes("Tobacco & Vape") ? prev : [...prev, "Tobacco & Vape"]
      );
      if (requiresCustomerId == null) setRequiresCustomerId(true);
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

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!confirmed) {
      toast.error("Confirm you are a legitimate business");
      return;
    }
    if (!requestCategories.length) {
      toast.error("Select at least one product category to receive");
      return;
    }
    if (requiresCustomerId == null) {
      toast.error("Tell us whether customers must show a government ID");
      return;
    }
    setLoading(true);
    const fd = new FormData(e.currentTarget);
    const result = await submitStoreApplicationAction({
      businessName: String(fd.get("businessName")),
      businessType,
      streetAddress: String(fd.get("streetAddress")),
      city: String(fd.get("city")),
      state: String(fd.get("state") || "VA"),
      postalCode: String(fd.get("postalCode")),
      phone: String(fd.get("phone")),
      website: String(fd.get("website") || ""),
      ownerName: String(fd.get("ownerName")),
      ownerEmail: String(fd.get("ownerEmail")),
      ownerPhone: String(fd.get("ownerPhone") || ""),
      password: String(fd.get("password") || ""),
      confirmPassword: String(fd.get("confirmPassword") || ""),
      whyLegit: String(fd.get("whyLegit")),
      requestCategories,
      requiresCustomerId: requiresCustomerId,
      confirmedLegitimate: true as const,
    });
    setLoading(false);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    setSubmitted(true);
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
              We&apos;ll review your application. Approved stores get{" "}
              <strong className="font-semibold text-ink">
                {STORE_TRIAL_DAYS} days free
              </strong>{" "}
              — no credit card required — to answer nearby customer requests and
              see local demand.
            </p>
            <p className="mt-3 text-sm text-ink-muted">
              Use the password you just chose on the store login after you&apos;re
              approved. You can also email yourself a sign-in link from that page.
            </p>
            <Button asChild className="mt-8" size="lg">
              <Link href="/login/business">Store login</Link>
            </Button>
            <Button asChild variant="ghost" className="mt-3" size="lg">
              <Link href="/">Back to FINDIT</Link>
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
            <Link href="/login">Already approved? Log in</Link>
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-6 pb-20 pt-6 md:pt-10">
        <Overline>Stores</Overline>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-ink md:text-4xl">
          Apply your business
        </h1>
        <p className="mt-3 max-w-xl leading-relaxed text-ink-muted">
          Confirm your business and apply for a {STORE_TRIAL_DAYS}-day free pilot.
          No credit card required. We review applications before granting access.
          Employees join later through an invite from the owner — not this form.
        </p>
        <GlassNotice tone="accent" className="mt-4 font-semibold">
          {STORE_TRIAL_DAYS} DAYS FREE · NO CREDIT CARD REQUIRED
        </GlassNotice>

        <Card level="strong" sheen className="mt-8 p-6 md:p-8">
          <form onSubmit={onSubmit} className="space-y-5">
            <div>
              <Label htmlFor="businessName">Business name</Label>
              <Input id="businessName" name="businessName" required />
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
            <div>
              <Label htmlFor="streetAddress">Street address</Label>
              <Input id="streetAddress" name="streetAddress" required />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2">
                <Label htmlFor="city">City</Label>
                <Input id="city" name="city" defaultValue="Falls Church" required />
              </div>
              <div>
                <Label htmlFor="postalCode">ZIP</Label>
                <Input id="postalCode" name="postalCode" defaultValue="22044" required />
              </div>
            </div>
            <input type="hidden" name="state" value="VA" />
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label htmlFor="phone">Business phone</Label>
                <Input id="phone" name="phone" type="tel" required />
              </div>
              <div>
                <Label htmlFor="website">Website (optional)</Label>
                <Input id="website" name="website" type="url" placeholder="https://" />
              </div>
            </div>
            <div className="border-t border-hairline-strong pt-5">
              <p className="text-sm font-semibold text-ink">Owner contact</p>
              <div className="mt-3 space-y-4">
                <div>
                  <Label htmlFor="ownerName">Owner / manager name</Label>
                  <Input id="ownerName" name="ownerName" required />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <Label htmlFor="ownerEmail">Email</Label>
                    <Input id="ownerEmail" name="ownerEmail" type="email" required />
                    <p className="mt-1 text-xs text-ink-muted">
                      This is the login you&apos;ll use after approval. We create
                      the password now — FINDIT does not wait on a magic-link
                      email to finish signup.
                    </p>
                  </div>
                  <div>
                    <Label htmlFor="ownerPhone">Phone (optional)</Label>
                    <Input id="ownerPhone" name="ownerPhone" type="tel" />
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <Label htmlFor="password">Password</Label>
                    <Input
                      id="password"
                      name="password"
                      type="password"
                      minLength={8}
                      required
                      autoComplete="new-password"
                    />
                  </div>
                  <div>
                    <Label htmlFor="confirmPassword">Confirm password</Label>
                    <Input
                      id="confirmPassword"
                      name="confirmPassword"
                      type="password"
                      minLength={8}
                      required
                      autoComplete="new-password"
                    />
                  </div>
                </div>
              </div>
            </div>
            <div>
              <Label htmlFor="whyLegit">Why is this a legitimate business?</Label>
              <Textarea
                id="whyLegit"
                name="whyLegit"
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
                I confirm this is a real, legitimate business applying for the FINDIT
                store pilot ({STORE_TRIAL_DAYS}-day free trial after approval — no
                credit card).
              </span>
            </label>
            <Button type="submit" className="w-full" size="xl" disabled={loading}>
              {loading ? "Submitting…" : "Submit join request"}
            </Button>
          </form>
        </Card>
      </main>
    </div>
  );
}
