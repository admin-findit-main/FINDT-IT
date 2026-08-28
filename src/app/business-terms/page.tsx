import type { Metadata } from "next";
import Link from "next/link";
import { LegalShell } from "@/components/shared/legal-shell";
import { SUPPORT_EMAIL } from "@/lib/auth/admin";

export const metadata: Metadata = {
  title: "Business Terms",
  robots: { index: true },
};

export default function BusinessTermsPage() {
  return (
    <LegalShell title="Business Terms">
      <p>
        These terms apply to store owners, managers, employees, and anyone who
        applies to put a store on FINDIT. They add to the{" "}
        <Link href="/terms">Terms of Service</Link> and{" "}
        <Link href="/acceptable-use">Acceptable Use Policy</Link>.
      </p>
      <p>
        Applications open from the waitlist on <Link href="/join">askfindit.com/join</Link> when
        we start taking stores. Support:{" "}
        <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.
      </p>

      <h2>Joining FINDIT</h2>
      <p>
        Listing a store is not automatic. FINDIT reviews applications and may
        approve, request more information, or decline. During the closed
        pilot, FINDIT decides which stores are live. Approval does not
        guarantee a volume of Finds or any sale.
      </p>

      <h2>Your store workspace</h2>
      <p>
        The store owner is responsible for the FINDIT workspace: team invites,
        employee access, Hub devices, hours, service area, and replies. If an
        employee leaves, remove them from the team. Activity under your store
        is treated as your store’s activity.
      </p>

      <h2>Replies</h2>
      <p>
        Reply accurately and only about inventory you actually handle. An In
        Stock or Can Order reply is a statement from your store to the
        shopper, not a FINDIT-made promise. FINDIT does not complete the sale.
        Pricing, hold policies, and ID checks stay yours.
      </p>
      <p>
        Shoppers’ names, emails, and phone numbers are not shown to stores.
        Do not try to collect contact details through FINDIT in a way that
        circumvents that design.
      </p>

      <h2>Plans, trial, and auto-renewal</h2>
      <p>
        Store plans and routing caps may apply. The current pilot does not
        bill in-app. FINDIT may change plan limits with notice in the product
        or by email. FINDIT does not guarantee that paying later will produce
        a particular number of Finds or conversions.
      </p>
      <p>
        Approved stores receive a free trial from the approval date. We will
        disclose the trial length, the paid price, and the date a charge would
        occur before collecting payment. Paid plans, when offered, auto-renew
        until cancelled from Subscription or by emailing{" "}
        <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>. Cancel before
        renewal to avoid the next charge. If you subscribed through Apple or
        Google, cancel in that store&apos;s subscription settings.
      </p>
      <p>
        Cancellation is available at any time, with no cancellation fee. You
        keep access through the period already paid.
      </p>

      <h2>Demand information</h2>
      <p>
        Stores may see aggregated demand for products in their area (for
        example, request counts). That information is operational, not a
        warranty, and must not be scraped or resold.
      </p>

      <h2>Ending participation</h2>
      <p>
        You may stop using FINDIT by removing staff, disconnecting Hub
        devices, and asking FINDIT to close the store listing. The owner
        account cannot be self-deleted while it still owns a live store —
        transfer or close the store first, then delete the login from Account,
        or email <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>. FINDIT may also remove a store that violates
        these terms or that we cannot support.
      </p>
    </LegalShell>
  );
}
