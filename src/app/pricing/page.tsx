import type { Metadata } from "next";
import { BrandLogo } from "@/components/brand/logo";
import { LegalShell } from "@/components/shared/legal-shell";
import {
  CUSTOMER_PLANS,
  PLUS_PRICE_MONTHLY,
  STORE_TRIAL_DAYS,
} from "@/lib/config/constants";
import {
  DEFAULT_USAGE_PRICING,
  formatCents,
  usageTiers,
} from "@findit/domain";

export const metadata: Metadata = {
  title: "Pricing",
  robots: { index: true },
};

const PLUS_PRICE = Number.isInteger(PLUS_PRICE_MONTHLY)
  ? `$${PLUS_PRICE_MONTHLY}`
  : `$${PLUS_PRICE_MONTHLY.toFixed(2)}`;

export default function PricingPage() {
  const starter = formatCents(DEFAULT_USAGE_PRICING.baseMonthlyCents);
  const visit = formatCents(DEFAULT_USAGE_PRICING.visitCents);
  const cap = formatCents(DEFAULT_USAGE_PRICING.paygMaxCents);
  const tiers = usageTiers();

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
        FINDIT for stores starts at {starter}/month + {visit} per verified
        customer visit. You only pay more when FINDIT actually brings customers
        to your store. Usage is based on verified visits, not guaranteed sales.
      </p>
      {tiers.map((tier) => (
        <p key={tier.id}>
          <strong className="text-ink">
            {tier.id === "payg"
              ? "Starter / Pay as you grow."
              : tier.id === "enterprise"
                ? "Enterprise / High volume."
                : `${tier.name}.`}
          </strong>{" "}
          {tier.kind === "payg"
            ? `${starter}/month + ${visit} per verified customer, up to ${cap}/month.`
            : tier.kind === "contact"
              ? `${tier.minVisits.toLocaleString()}+ verified visits. Contact FINDIT — FINDIT does not auto-charge this volume.`
              : `${formatCents(tier.monthlyCents || 0)}/month for ${tier.minVisits.toLocaleString()}–${(
                  tier.maxVisits || 0
                ).toLocaleString()} verified visits.`}
        </p>
      ))}
      <p>
        {STORE_TRIAL_DAYS}-day free trial. No long-term contract. FINDIT Hub
        included. Apply at <a href="/join">askfindit.com/join</a>. We review
        before a store goes live.
      </p>
    </LegalShell>
  );
}
