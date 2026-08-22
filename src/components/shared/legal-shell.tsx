import { BrandHomeLink } from "@/components/brand/logo";
import { GlassCard } from "@/components/ui/glass";

const LEGAL_EFFECTIVE = "August 21, 2026";

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
    <div className="app-canvas min-h-screen">
      <div className="mx-auto max-w-2xl px-6 py-10">
        <BrandHomeLink href="/" />
        <GlassCard sheen className="mt-8 rounded-glass-2xl p-6 sm:p-9">
          <h1 className="text-3xl font-bold tracking-tight text-ink">{title}</h1>
          {lastUpdated ? (
            <p className="mt-2 text-xs text-ink-subtle">Last updated {lastUpdated}</p>
          ) : null}
          <div className="mt-6 space-y-4 text-sm leading-relaxed text-ink-muted [&_a]:font-semibold [&_a]:text-ink [&_a]:underline [&_h2]:mt-8 [&_h2]:text-base [&_h2]:font-semibold [&_h2]:text-ink [&_ul]:list-disc [&_ul]:space-y-1.5 [&_ul]:pl-5">
            {children}
          </div>
        </GlassCard>
      </div>
    </div>
  );
}
