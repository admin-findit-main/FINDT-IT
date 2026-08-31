import type { Metadata } from "next";
import Link from "next/link";
import { LegalShell } from "@/components/shared/legal-shell";
import { SUPPORT_EMAIL } from "@/lib/auth/admin";

export const metadata: Metadata = {
  title: "Terms of Service",
  robots: { index: true },
};

export default function TermsPage() {
  return (
    <LegalShell title="Terms of Service">
      <p>
        These Terms govern your use of FINDIT — the websites at askfindit.com
        and related hosts, and any FINDIT mobile apps. By creating an account
        or using FINDIT, you agree to them. The{" "}
        <Link href="/privacy">Privacy Policy</Link>,{" "}
        <Link href="/acceptable-use">Acceptable Use Policy</Link>, and{" "}
        <Link href="/business-terms">Business Terms</Link> are part of this
        agreement. This is how FINDIT currently operates. It is not legal
        advice.
      </p>
      <p>
        Contact: <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.
      </p>

      <h2>The service</h2>
      <p>
        FINDIT lets shoppers ask nearby participating stores whether a product
        is available. Stores may reply In Stock, Can Order, Out of Stock, or
        similar statuses. FINDIT is not a retailer, marketplace checkout,
        payment processor, or delivery service. A reply is information from
        that store, not a FINDIT guarantee that the item will still be there,
        at a particular price, or sold to you.
      </p>

      <h2>Accounts</h2>
      <p>
        You must provide accurate account information and keep your login
        confidential. Shopper accounts live on dashboard.askfindit.com. Store
        accounts live on store.askfindit.com. The same login can be used as a
        shopper and, if invited or approved, as store staff. You can delete
        your account from Profile or Account, with the limits described in the
        Privacy Policy (store owners must transfer or close the store first).
      </p>
      <p>
        FINDIT may refuse, suspend, or close an account that violates these
        Terms, the Acceptable Use Policy, or applicable law, or that we
        reasonably believe is abusive or a security risk.
      </p>

      <h2>Shopper Finds</h2>
      <p>
        You are responsible for the content of your Finds, including photos.
        Do not request anything illegal to obtain. Age-restricted items may
        require the store to check ID in person — FINDIT does not complete that
        check. Usage caps may apply (including during the pilot). FINDIT does
        not promise that a store will reply, or that a reply is still accurate
        when you arrive.
      </p>

      <h2>Stores</h2>
      <p>
        Store participation requires an application and FINDIT approval. Store
        owners are responsible for their staff, Hub devices, and the accuracy
        of replies sent from their workspace. Additional terms for stores are
        in the <Link href="/business-terms">Business Terms</Link>.
      </p>

      <h2>Plans and billing</h2>
      <p>
        Shoppers can use FINDIT on the free plan. Stores apply and, if
        approved, get a trial. There is currently no live card charging. Plan
        names, Find caps, and store routing limits may change. If we start
        charging, we will say so in the product before collecting payment.
      </p>

      <h2>Auto-renewal</h2>
      <p>
        Paid FINDIT subscriptions (when billing is live) renew automatically
        at the end of each billing period until you cancel. Before we take a
        payment we will show the price, the length of the period, and the date
        of the next charge. Until paid billing is turned on, nothing auto-renews
        and no card is charged.
      </p>

      <h2>Apple App Store and Google Play billing</h2>
      <p>
        If you subscribe through Apple or Google, Apple or Google — not FINDIT —
        charges you, renews the subscription, and handles refunds under their
        terms. Cancel or change that subscription in your Apple ID subscriptions
        (Settings → Apple ID → Subscriptions) or in Google Play → Payments &
        subscriptions. FINDIT cannot cancel an Apple or Google subscription for
        you. Web billing, when offered, is cancelled in FINDIT (Plan or
        Subscription).
      </p>

      <h2>Simple cancellation</h2>
      <p>
        Cancel any time from Plan (shoppers) or Subscription (stores), or email{" "}
        <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>. There is no
        cancellation fee. Cancellation stops the next renewal; you keep access
        through the period you already paid. If you subscribed through Apple or
        Google, cancel there as described above.
      </p>

      <h2>Free trial</h2>
      <p>
        Approved stores receive a free trial of limited length (currently 30
        days from approval). We will tell you when the trial ends and what the
        paid price would be before any charge. Cancel before the trial ends if
        you do not want to continue. While FINDIT is in unpaid pilot, the trial
        does not convert into an automatic paid charge.
      </p>

      <h2>Intellectual property</h2>
      <p>
        FINDIT, the FINDIT mark, and the product are owned by FINDIT. You keep
        rights in content you submit, and you grant FINDIT a license to host
        and display that content as needed to run the request network
        (including showing a Find photo to stores that receive it).
      </p>

      <h2>Disclaimers</h2>
      <p>
        FINDIT is provided “as is.” We do not warrant uninterrupted service,
        error-free replies, or that using FINDIT will result in a purchase.
        Stores — not FINDIT — are responsible for their inventory, pricing,
        and sales.
      </p>

      <h2>Limitation of liability</h2>
      <p>
        To the fullest extent allowed by law, FINDIT is not liable for
        indirect, incidental, special, consequential, or lost-profit damages,
        or for a store’s failure to have an item, honor a price, or complete a
        sale. Our total liability for a claim relating to FINDIT will not
        exceed the greater of fifty U.S. dollars or the amount you paid FINDIT
        in the twelve months before the claim (currently zero during the
        unpaid pilot).
      </p>

      <h2>Changes</h2>
      <p>
        We may update these Terms. The date at the top will change, and
        continued use after posting means you accept the update. If you do not
        agree, stop using FINDIT and delete your account.
      </p>
    </LegalShell>
  );
}
