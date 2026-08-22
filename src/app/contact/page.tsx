import type { Metadata } from "next";
import { LegalShell } from "@/components/shared/legal-shell";
import { SUPPORT_EMAIL } from "@/lib/auth/admin";

export const metadata: Metadata = {
  title: "Contact",
  robots: { index: true },
};

export default function ContactPage() {
  return (
    <LegalShell title="Contact FINDIT" lastUpdated={null}>
      <p>
        Shoppers, stores, and the FINDIT operator can reach support at{" "}
        <a className="font-semibold text-ink underline" href={`mailto:${SUPPORT_EMAIL}`}>
          {SUPPORT_EMAIL}
        </a>
        .
      </p>
      <p>
        Store applications are submitted at <a className="font-semibold text-ink underline" href="/join">/join</a>.
        Account login for shoppers is on dashboard.askfindit.com; store login is on
        store.askfindit.com.
      </p>
    </LegalShell>
  );
}
