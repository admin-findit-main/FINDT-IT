import { MarketingHeader } from "@/components/marketing/site-header";
import { SiteFooter } from "@/components/shared/site-footer";
import { GlassCard } from "@/components/ui/glass";

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
      <div className="mx-auto w-full max-w-2xl flex-1 px-5 py-10 sm:px-6">
        <GlassCard sheen className="rounded-glass-2xl p-6 sm:p-9">
          <h1 className="text-3xl font-bold tracking-tight text-ink">{title}</h1>
          {lastUpdated ? (
            <p className="mt-2 text-xs text-ink-subtle">Last updated {lastUpdated}</p>
          ) : null}
          <div className="mt-6 space-y-4 text-sm leading-relaxed text-ink-muted [&_a]:font-semibold [&_a]:text-ink [&_a]:underline [&_h2]:mt-8 [&_h2]:text-base [&_h2]:font-semibold [&_h2]:text-ink [&_ul]:list-disc [&_ul]:space-y-1.5 [&_ul]:pl-5">
            {children}
          </div>
        </GlassCard>
      </div>
      <SiteFooter />
    </div>
  );
}
