import { MarketingHeader } from "@/components/marketing/site-header";
import { SiteFooter } from "@/components/shared/site-footer";

const LEGAL_EFFECTIVE = "August 28, 2026";

export function LegalShell({
  title,
  lastUpdated = LEGAL_EFFECTIVE,
  children,
}: {
  title: string;
  lastUpdated?: string | null;
  children: React.ReactNode;
}) {
  return (
    <div className="app-canvas flex min-h-dvh flex-col overflow-x-clip">
      <MarketingHeader />
      {/* Long-form copy reads as a document, not as a card on a tray. */}
      <div className="mx-auto w-full max-w-2xl flex-1 px-5 py-12 sm:px-6 md:py-16">
        <h1 className="text-3xl font-bold leading-[1.05] tracking-[-0.03em] text-ink md:text-[2.5rem]">
          {title}
        </h1>
        {lastUpdated ? (
          <p className="mt-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-subtle">
            Last updated {lastUpdated}
          </p>
        ) : null}
        <div className="mt-8 space-y-4 border-t border-ink pt-8 text-sm leading-relaxed text-ink-muted [&_a]:font-semibold [&_a]:text-ink [&_a]:underline [&_h2]:mt-10 [&_h2]:text-base [&_h2]:font-semibold [&_h2]:tracking-[-0.01em] [&_h2]:text-ink [&_ul]:list-disc [&_ul]:space-y-1.5 [&_ul]:pl-5">
          {children}
        </div>
      </div>
      <SiteFooter />
    </div>
  );
}
