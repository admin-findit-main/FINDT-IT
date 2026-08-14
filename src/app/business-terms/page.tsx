import type { Metadata } from "next";
import { LegalShell } from "@/components/shared/legal-shell";

export const metadata: Metadata = { title: "Business Terms" };

export default function BusinessTermsPage() {
  return (
    <LegalShell title="Business Terms">
      <p>
        Placeholder Business Terms for store owners. Not attorney-reviewed.
        Replace before production.
      </p>
      <p>
        Stores are responsible for accurate responses. FINDIT does not guarantee
        sales. Subscription plans and request limits may apply.
      </p>
      <p>
        Store owners may invite employees and remain responsible for their
        activity on the account.
      </p>
    </LegalShell>
  );
}
