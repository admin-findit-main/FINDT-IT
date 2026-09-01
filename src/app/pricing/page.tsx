import type { Metadata } from "next";
import { BrandLogo } from "@/components/brand/logo";
import { LegalShell } from "@/components/shared/legal-shell";
import {
  BUSINESS_PRICE_MONTHLY,
  CUSTOMER_PLANS,
  PLUS_PRICE_MONTHLY,
  STORE_TRIAL_DAYS,
} from "@/lib/config/constants";

export const metadata: Metadata = {
  title: "Pricing",
  robots: { index: true },
};

const STORE_PRICE = Number.isInteger(BUSINESS_PRICE_MONTHLY)
  ? `$${BUSINESS_PRICE_MONTHLY}`
  : `$${BUSINESS_PRICE_MONTHLY.toFixed(2)}`;

const PLUS_PRICE = Number.isInteger(PLUS_PRICE_MONTHLY)
  ? `$${PLUS_PRICE_MONTHLY}`
  : `$${PLUS_PRICE_MONTHLY.toFixed(2)}`;

export default function PricingPage() {
  return (
    <LegalShell title="FINDIT pricing">
      <p>
        Shoppers start free. Stores get a {STORE_TRIAL_DAYS}-day trial after
        approval. Payments are coming soon. You’ll be notified before any paid
        subscription begins.
      </p>
      <BrandLogo kind="plus" className="mt-2 h-6" />
      <h2>Shoppers</h2>
      <p>
        <strong className="text-ink">{CUSTOMER_PLANS.free.name}.</strong>{" "}
        {CUSTOMER_PLANS.free.tagline}. Free.
      </p>
      <p>
        <strong className="text-ink">{CUSTOMER_PLANS.plus.name}.</strong>{" "}
        {CUSTOMER_PLANS.plus.tagline}. {PLUS_PRICE}/month.
      </p>
      <BrandLogo kind="business" className="mt-6 h-6" />
      <h2>Stores</h2>
      <p>
        The store app is {STORE_PRICE}/month per location after trial. That
        includes the Hub, incoming Finds, demand, team, and settings.
      </p>
      <p>
        Apply at <a href="/join">askfindit.com/join</a>. We review before a
        store goes live.
      </p>
    </LegalShell>
  );
}
