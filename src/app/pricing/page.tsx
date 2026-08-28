import type { Metadata } from "next";
import { LegalShell } from "@/components/shared/legal-shell";
import { BUSINESS_PRICE_MONTHLY } from "@/lib/config/constants";

export const metadata: Metadata = {
  title: "Pricing",
  robots: { index: true },
};

const STORE_PRICE = Number.isInteger(BUSINESS_PRICE_MONTHLY)
  ? `$${BUSINESS_PRICE_MONTHLY}`
  : `$${BUSINESS_PRICE_MONTHLY.toFixed(2)}`;

export default function PricingPage() {
  return (
    <LegalShell title="FINDIT pricing">
      <p>
        FINDIT is waitlisting. Public shopper and store sign-in is off until we
        open. Join from{" "}
        <a href="/#waitlist">askfindit.com</a>.
      </p>
      <h2>Shoppers</h2>
      <p>
        The FINDIT app is how you ask nearby stores if they have a product.
        Pricing for shoppers will be shown in the app when sign-up opens. Nothing
        is billed while we waitlist.
      </p>
      <h2>Stores</h2>
      <p>
        The store app is {STORE_PRICE}/month per location. That includes every
        store feature: Hub at the counter, incoming Finds, demand, team, and
        settings. There aren’t extra paid tiers.
      </p>
      <p>
        We are not charging stores while FINDIT is waitlisting. When billing
        starts, checkout will show the price before anything is due.
      </p>
      <h2>Cancel</h2>
      <p>
        When paid billing is live, cancel any time in the store subscription
        screen. No cancellation fee. Access continues through the paid period.
      </p>
    </LegalShell>
  );
}
