import type { Metadata } from "next";
import { LegalShell } from "@/components/shared/legal-shell";
import { CUSTOMER_PLANS, STORE_PLANS, STORE_TRIAL_DAYS } from "@/lib/config/constants";

export const metadata: Metadata = {
  title: "Pricing",
  robots: { index: true },
};

export default function PricingPage() {
  const plus = CUSTOMER_PLANS.plus;
  const business = STORE_PLANS.starter;
  return (
    <LegalShell title="FINDIT pricing">
      <p>
        Pilot stores are not charged yet. Checkout will use Stripe when FINDIT
        leaves pilot mode.
      </p>
      <p>
        <strong className="text-ink">{CUSTOMER_PLANS.free.name}.</strong>{" "}
        {CUSTOMER_PLANS.free.tagline}.
      </p>
      <p>
        <strong className="text-ink">{plus.name}.</strong> {plus.tagline}.
        Paid billing is not live.
      </p>
      <p>
        <strong className="text-ink">{business.name}.</strong> Approved stores
        get a {STORE_TRIAL_DAYS}-day trial. {business.tagline}.
      </p>
    </LegalShell>
  );
}
