import type { Metadata } from "next";
import { LegalShell } from "@/components/shared/legal-shell";

export const metadata: Metadata = { title: "Acceptable Use Policy" };

export default function AcceptableUsePage() {
  return (
    <LegalShell title="Acceptable Use Policy">
      <p>
        Placeholder Acceptable Use Policy. Not attorney-reviewed. Replace before
        production.
      </p>
      <p>
        Do not use FINDIT to request illegal controlled products, harass store
        staff, spam requests, or attempt to access another store&apos;s private
        data.
      </p>
      <p>FINDIT may suspend accounts or stores that violate these rules.</p>
    </LegalShell>
  );
}
