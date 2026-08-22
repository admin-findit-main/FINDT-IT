import type { Metadata } from "next";
import { LegalShell } from "@/components/shared/legal-shell";
import { SUPPORT_EMAIL } from "@/lib/auth/admin";

export const metadata: Metadata = {
  title: "Privacy Policy",
  robots: { index: true },
};

export default function PrivacyPage() {
  return (
    <LegalShell title="Privacy Policy">
      <p>
        This policy describes how FINDIT collects, uses, and shares information
        when you use askfindit.com, dashboard.askfindit.com, store.askfindit.com,
        app.askfindit.com, and related FINDIT apps. It reflects how the product
        works today. It is not legal advice.
      </p>
      <p>
        Questions:{" "}
        <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.
      </p>

      <h2>What FINDIT is</h2>
      <p>
        FINDIT is a product-request network. Shoppers tell FINDIT what they are
        looking for. Nearby participating stores can reply with availability.
        FINDIT does not sell the product, process checkout, or provide delivery.
        Store staff never receive a shopper&apos;s email, phone number, or name
        through FINDIT.
      </p>

      <h2>Information we collect</h2>
      <ul>
        <li>
          <strong className="text-ink">Account.</strong> Name, email and/or
          phone, password (stored by our auth provider, not in FINDIT source),
          city, state, ZIP, and notification preferences.
        </li>
        <li>
          <strong className="text-ink">Finds.</strong> Product name, details,
          optional photo, place, and status of each request and store reply.
        </li>
        <li>
          <strong className="text-ink">Store accounts.</strong> Store name,
          address, hours, categories, service area, team invites, and replies
          staff send on a Find.
        </li>
        <li>
          <strong className="text-ink">Device and session.</strong> Login
          cookies, optional mobile push tokens, and Hub device pairing for
          in-store terminals.
        </li>
        <li>
          <strong className="text-ink">Support and operations.</strong> Emails
          you send us, and diagnostic events needed to keep the service running.
        </li>
      </ul>

      <h2>How we use it</h2>
      <p>
        We use this information to create and secure your account, route Finds
        to nearby stores, show replies, send the alerts you opted into, operate
        store workspaces, review store applications, prevent abuse, and improve
        FINDIT. Aggregated, de-identified demand (for example, how often a
        product is requested in an area) may be retained to help stores
        understand local demand.
      </p>

      <h2>What we do not do</h2>
      <ul>
        <li>We do not sell your personal information.</li>
        <li>
          We do not give stores your contact details, name, or exact street
          address. Stores see the Find (product, photo, and the place used to
          route it).
        </li>
        <li>We do not use advertising cookies or session replay.</li>
      </ul>

      <h2>Processors</h2>
      <p>
        FINDIT runs on infrastructure we do not own. Depending on configuration,
        that currently includes:
      </p>
      <ul>
        <li>Vercel — hosting the website and apps.</li>
        <li>Supabase — authentication, database, and photo storage.</li>
        <li>Resend — transactional email such as invites and alerts.</li>
        <li>Expo — optional push notifications on mobile.</li>
      </ul>
      <p>
        Payments: FINDIT does not currently charge through the app. If billing
        is added later, this policy will name the payment processor before
        cards are collected.
      </p>

      <h2>Cookies</h2>
      <p>
        We use cookies and similar storage to keep you signed in across
        FINDIT hosts on askfindit.com. We do not use third-party advertising
        cookies.
      </p>

      <h2>Account deletion</h2>
      <p>
        You can delete your FINDIT account yourself from Profile (shoppers) or
        Account (store staff). Deletion signs you out, removes your login, and
        deletes or anonymizes personal identifiers we store. Photos you
        uploaded are removed from storage where we can identify them as yours.
        Store replies you sent may be reassigned to the store so the Find
        history still makes sense. Aggregate demand analytics that no longer
        identify you may be kept.
      </p>
      <p>
        If you own a store, transfer or close it first — the owner record cannot
        be deleted while the store still exists. The FINDIT operator account
        cannot be deleted in-app. You can also email{" "}
        <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a> and we will
        handle the request.
      </p>

      <h2>Children</h2>
      <p>
        FINDIT is not directed at children under 13, and we do not knowingly
        collect personal information from them.
      </p>

      <h2>Retention and security</h2>
      <p>
        We keep account and Find data while the account is open and as needed
        to operate the network, resolve disputes, and meet legal duties. We use
        access controls and encrypted transport. No method of transmission or
        storage is perfectly secure.
      </p>

      <h2>Your choices</h2>
      <p>
        You can update your name, place, and alert preferences in Profile; log
        out; delete your account; and email us to access or correct information
        we hold. Depending on where you live, you may have additional privacy
        rights. Contact us to exercise them.
      </p>

      <h2>Changes</h2>
      <p>
        If we change this policy in a material way, we will update the date
        above and post the new version at this URL.
      </p>
    </LegalShell>
  );
}
