import type { Metadata } from "next";
import { LegalShell } from "@/components/shared/legal-shell";
import { MailLink, PhoneLink } from "@/components/shared/site-footer";
import { PUBLIC_SUPPORT_EMAIL, SUPPORT_PHONE } from "@/lib/config/support";

export const metadata: Metadata = {
  title: "Contact",
  robots: { index: true },
};

export default function ContactPage() {
  return (
    <LegalShell title="Contact FINDIT" lastUpdated={null}>
      <p>
        Email <MailLink email={PUBLIC_SUPPORT_EMAIL} />
        {SUPPORT_PHONE ? (
          <>
            {" "}
            or call <PhoneLink phone={SUPPORT_PHONE} />
          </>
        ) : null}
        .
      </p>
      <p>
        FINDIT is waitlisting, so public sign-in is off. Join at{" "}
        <a className="font-semibold text-ink underline" href="/#waitlist">
          askfindit.com
        </a>
        .
      </p>
    </LegalShell>
  );
}
