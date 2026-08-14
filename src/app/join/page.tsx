"use client";

import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { GlassChip, GlassNotice, Overline } from "@/components/ui/glass";
import { Card, Input, Label, Textarea } from "@/components/ui/primitives";
import { STORE_CATEGORIES, STORE_TRIAL_DAYS } from "@/lib/config/constants";
import { JOIN_REQUEST_CATEGORIES } from "@/lib/services/category-routing";
import { submitStoreApplicationAction } from "@/lib/services/actions";

export default function JoinAsStorePage() {
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [businessType, setBusinessType] = useState<string>(STORE_CATEGORIES[0]);
  const [requestCategories, setRequestCategories] = useState<string[]>([
    "Grocery",
    "Convenience",
  ]);
  const [confirmed, setConfirmed] = useState(false);

  function toggleCategory(c: string) {
    setRequestCategories((prev) =>
      prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]
    );
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
      whyLegit: String(fd.get("whyLegit")),
      requestCategories,
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
        <header className="mx-auto flex max-w-3xl items-center justify-between px-6 py-5">
          <Link
            href="/"
            className="flex items-center gap-1.5 text-2xl font-bold tracking-tight text-ink"
          >
            FINDIT
            <span aria-hidden className="h-2 w-2 rounded-full bg-accent" />
          </Link>
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
              You won&apos;t get store dashboard access until you&apos;re approved.
            </p>
            <Button asChild className="mt-8" size="lg">
              <Link href="/login">Log in after approval</Link>
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
      <header className="mx-auto flex max-w-3xl items-center justify-between px-6 py-5">
        <Link
          href="/"
          className="flex items-center gap-1.5 text-2xl font-bold tracking-tight text-ink"
        >
          FINDIT
          <span aria-hidden className="h-2 w-2 rounded-full bg-accent" />
        </Link>
        <Button asChild variant="ghost" size="sm">
          <Link href="/login">Already approved? Log in</Link>
        </Button>
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
                    onClick={() => setBusinessType(c)}
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
                      Use the email you&apos;ll sign in with after approval.
                    </p>
                  </div>
                  <div>
                    <Label htmlFor="ownerPhone">Phone (optional)</Label>
                    <Input id="ownerPhone" name="ownerPhone" type="tel" />
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
