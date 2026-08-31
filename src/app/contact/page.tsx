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
        Shoppers create an account at{" "}
        <a className="font-semibold text-ink underline" href="https://dashboard.askfindit.com/signup">
          dashboard.askfindit.com/signup
        </a>
        . Stores apply at{" "}
        <a className="font-semibold text-ink underline" href="/join">
          askfindit.com/join
        </a>
        , then sign in at store.askfindit.com.
      </p>
    </LegalShell>
  );
}
