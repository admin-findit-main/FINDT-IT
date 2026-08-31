import Link from "next/link";
import { BrandLockup } from "@/components/brand/logo";
import { PUBLIC_SUPPORT_EMAIL, SUPPORT_PHONE, mailHref, telHref } from "@/lib/config/support";

const YEAR = new Date().getFullYear();

const LINKS = [
  { href: "/#waitlist", label: "Waitlist" },
  { href: "/pricing", label: "Pricing" },
  { href: "/contact", label: "Support" },
  { href: "/privacy", label: "Privacy" },
  { href: "/terms", label: "Terms" },
  { href: "/acceptable-use", label: "Acceptable Use" },
  { href: "/business-terms", label: "Business Terms" },
] as const;

export function SiteFooter({ tone = "light" }: { tone?: "light" | "dark" }) {
  const muted = tone === "dark" ? "text-ink-inverse/70" : "text-ink-muted";
  const hover = tone === "dark" ? "hover:text-ink-inverse" : "hover:text-ink";
  const phone = telHref(SUPPORT_PHONE);

  return (
    <footer
      className={`mx-auto flex w-full max-w-6xl flex-col gap-4 px-6 py-12 text-sm ${muted} sm:flex-row sm:items-center sm:justify-between`}
    >
      <div className="space-y-3">
        <BrandLockup tone={tone} />
        <p>© {YEAR} FINDIT</p>
        <p className="flex flex-wrap gap-x-3 gap-y-1">
          <a className={`font-medium ${hover}`} href={mailHref(PUBLIC_SUPPORT_EMAIL)}>
            {PUBLIC_SUPPORT_EMAIL}
          </a>
          {SUPPORT_PHONE && phone ? (
            <a className={`font-medium ${hover}`} href={phone}>
              {SUPPORT_PHONE}
            </a>
          ) : null}
        </p>
      </div>
      <div className="flex flex-wrap gap-4">
        {LINKS.map((link) => (
          <Link key={link.href} href={link.href} className={`transition-colors ${hover}`}>
            {link.label}
          </Link>
        ))}
      </div>
    </footer>
  );
}

export function MailLink({
  email = PUBLIC_SUPPORT_EMAIL,
  children,
}: {
  email?: string;
  children?: React.ReactNode;
}) {
  return (
    <a className="font-semibold text-ink underline underline-offset-2" href={mailHref(email)}>
      {children || email}
    </a>
  );
}

export function PhoneLink({
  phone,
  children,
}: {
  phone: string;
  children?: React.ReactNode;
}) {
  const href = telHref(phone);
  if (!href) return <span>{children || phone}</span>;
  return (
    <a className="font-semibold text-ink underline underline-offset-2" href={href}>
      {children || phone}
    </a>
  );
}
