import type { Metadata } from "next";
import { MarketingHeader } from "@/components/marketing/site-header";
import { WaitlistForm } from "@/components/marketing/waitlist-form";
import { SiteFooter } from "@/components/shared/site-footer";
import { BUSINESS_PRICE_MONTHLY } from "@/lib/config/constants";

export const metadata: Metadata = {
  title: "Stores",
  description: "Join the FINDIT store waitlist. $99/month for the full store app when we open.",
};

const STORE_PRICE = Number.isInteger(BUSINESS_PRICE_MONTHLY)
  ? `$${BUSINESS_PRICE_MONTHLY}`
  : `$${BUSINESS_PRICE_MONTHLY.toFixed(2)}`;

export default function JoinAsStorePage() {
  return (
    <div className="min-h-screen bg-[var(--canvas)]">
      <MarketingHeader />
      <main className="mx-auto grid max-w-6xl gap-12 px-5 py-12 sm:px-6 md:grid-cols-2 md:py-20">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-ink sm:text-4xl">
            FINDIT for stores
          </h1>
          <p className="mt-4 text-base leading-relaxed text-ink-muted">
            {STORE_PRICE}/month per location, and you get the whole store app —
            Hub, Finds, demand, team. We’re not taking applications yet. Join
            the waitlist and we’ll email you when it’s time.
          </p>
        </div>
        <WaitlistForm defaultAudience="store" id="waitlist" />
      </main>
      <SiteFooter />
    </div>
  );
}
