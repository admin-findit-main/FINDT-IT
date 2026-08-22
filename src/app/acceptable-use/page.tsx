import type { Metadata } from "next";
import { LegalShell } from "@/components/shared/legal-shell";
import { SUPPORT_EMAIL } from "@/lib/auth/admin";

export const metadata: Metadata = {
  title: "Acceptable Use Policy",
  robots: { index: true },
};

export default function AcceptableUsePage() {
  return (
    <LegalShell title="Acceptable Use Policy">
      <p>
        This policy applies to everyone who uses FINDIT: shoppers, store staff,
        Hub terminals, and applicants. FINDIT may suspend or close accounts
        or stores that break it. Report abuse to{" "}
        <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.
      </p>

      <h2>Do not use FINDIT to</h2>
      <ul>
        <li>
          Request or arrange anything that is illegal to obtain, possess, or
          sell where you are, including illegal controlled substances and
          stolen goods.
        </li>
        <li>
          Harass, threaten, or impersonate store staff, other shoppers, or
          FINDIT.
        </li>
        <li>
          Spam Finds, scrape the service, probe other stores&apos; private
          data, or attempt to bypass login, routing, or usage caps.
        </li>
        <li>
          Upload malware, or photos you do not have the right to use.
        </li>
        <li>
          Use another person’s account, invite, Hub pairing code, or device
          without permission.
        </li>
        <li>
          Interfere with FINDIT infrastructure, or with a store’s ability to
          answer real shoppers.
        </li>
      </ul>

      <h2>Age-restricted products</h2>
      <p>
        Some Finds (for example alcohol or tobacco, where allowed) may be
        flagged so stores know an in-person ID check is required. FINDIT does
        not sell those items and does not verify age for the store. Do not use
        FINDIT to get around ID laws.
      </p>

      <h2>Store staff</h2>
      <p>
        Reply only for your assigned store. Do not use FINDIT Hub or the store
        app to view or act on another store’s queue. Keep pairing codes and
        employee invites inside your team.
      </p>

      <h2>Enforcement</h2>
      <p>
        FINDIT may remove content, rate-limit Finds, revoke Hub devices, or
        suspend accounts without prior notice when we reasonably believe this
        policy or the law is being broken. Repeat or severe abuse can lead to
        a permanent ban.
      </p>
    </LegalShell>
  );
}
