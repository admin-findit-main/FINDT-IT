import Link from "next/link";
import { BrandLockup } from "@/components/brand/logo";
import { PUBLIC_SUPPORT_EMAIL, SUPPORT_PHONE, mailHref, telHref } from "@/lib/config/support";
import { productUrl } from "@/lib/config/product-hosts";

const YEAR = new Date().getFullYear();

const PRODUCT = [
  { href: "/#how", label: "How it works" },
  { href: "/#start", label: "Get started" },
  { href: "/#faq", label: "Q&A" },
  { href: "/pricing", label: "Pricing" },
] as const;

const STORES = [
  { href: "/join", label: "Apply your store" },
  { href: productUrl("store", "/login/business"), label: "Store sign in" },
  { href: "/business-terms", label: "Business Terms" },
] as const;

const LEGAL = [
  { href: "/privacy", label: "Privacy" },
  { href: "/terms", label: "Terms" },
  { href: "/acceptable-use", label: "Acceptable Use" },
  { href: "/contact", label: "Support" },
] as const;

export function SiteFooter({ tone = "light" }: { tone?: "light" | "dark" }) {
  const muted = tone === "dark" ? "text-ink-inverse/70" : "text-ink-muted";
  const hover = tone === "dark" ? "hover:text-ink-inverse" : "hover:text-ink";
  const company = tone === "dark" ? "text-ink-inverse" : "text-ink";
  const hair = tone === "dark" ? "border-white/15" : "border-hairline-strong";
  const phone = telHref(SUPPORT_PHONE);

  return (
    <footer className={`border-t ${hair}`}>
      <div className={`mx-auto w-full max-w-6xl px-5 py-12 sm:px-6 ${muted}`}>
        <div className="grid gap-10 md:grid-cols-4">
          <div className="space-y-3 md:col-span-1">
            <BrandLockup tone={tone} />
            <p className={`text-sm font-semibold ${company}`}>FIND IT LLC</p>
            <p className="text-sm">© {YEAR} FIND IT LLC</p>
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
          <FooterCol title="Product" links={PRODUCT} hover={hover} />
          <FooterCol title="Stores" links={STORES} hover={hover} />
          <FooterCol title="Legal" links={LEGAL} hover={hover} />
        </div>
      </div>
    </footer>
  );
}

function FooterCol({
  title,
  links,
  hover,
}: {
  title: string;
  links: readonly { href: string; label: string }[];
  hover: string;
}) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-ink-subtle">
        {title}
      </p>
      <ul className="mt-3 space-y-2">
        {links.map((link) => (
          <li key={link.href}>
            <Link href={link.href} className={`text-sm transition-colors ${hover}`}>
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
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
