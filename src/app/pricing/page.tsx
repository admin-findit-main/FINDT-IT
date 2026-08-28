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
      <h2>Auto-renewal</h2>
      <p>
        When paid billing is live, FINDIT+ and store plans renew automatically
        each period until you cancel. We will show the price and next charge
        date before taking payment. Nothing auto-renews during the unpaid
        pilot.
      </p>
      <h2>Apple and Google</h2>
      <p>
        Subscriptions bought in the iOS or Android app are billed by Apple or
        Google. Cancel those in Apple ID subscriptions or Google Play. FINDIT
        cannot cancel an app-store subscription for you.
      </p>
      <h2>Cancel</h2>
      <p>
        Cancel any time in Plan (shoppers) or Subscription (stores). No
        cancellation fee. Access continues through the paid period.
      </p>
      <h2>Free trial</h2>
      <p>
        Store trial is {STORE_TRIAL_DAYS} days from approval. Cancel before it
        ends if you do not want a paid plan. The trial does not auto-charge
        while FINDIT is in unpaid pilot.
      </p>
    </LegalShell>
  );
}
