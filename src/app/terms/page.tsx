import type { Metadata } from "next";
import { LegalShell } from "@/components/shared/legal-shell";

export const metadata: Metadata = { title: "Terms of Service" };

export default function TermsPage() {
  return (
    <LegalShell title="Terms of Service">
      <p>
        Placeholder Terms of Service for FINDIT. Not attorney-reviewed. Replace
        before production.
      </p>
      <p>
        FINDIT helps customers ask nearby stores about product availability.
        FINDIT does not sell products, process checkout, or provide delivery.
      </p>
      <p>
        Users agree not to abuse the platform, submit prohibited requests, or
        misuse store employee access.
      </p>
    </LegalShell>
  );
}
