import type { Metadata } from "next";
import { LegalShell } from "@/components/shared/legal-shell";

export const metadata: Metadata = {
  title: "Privacy Policy",
  robots: { index: true },
};

export default function PrivacyPage() {
  return (
    <LegalShell title="Privacy Policy">
      <p>
        This is a placeholder Privacy Policy for the FINDIT MVP. It is not
        attorney-reviewed. Replace this content before production launch.
      </p>
      <p>
        FINDIT collects account information, product requests, store responses,
        and usage events needed to operate the product request network. Customer
        contact details are not shared with stores.
      </p>
      <p>
        You may request account deletion. Where practical, personal identifiers
        are anonymized while aggregate demand analytics may be retained.
      </p>
    </LegalShell>
  );
}
