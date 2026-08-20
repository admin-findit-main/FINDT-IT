import { GlassCard } from "@/components/ui/glass";
import { BrandHomeLink } from "@/components/brand/logo";

export function LegalShell({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="app-canvas min-h-screen">
      <div className="mx-auto max-w-2xl px-6 py-10">
        <BrandHomeLink href="/" />
        <GlassCard sheen className="mt-8 rounded-glass-2xl p-6 sm:p-9">
          <h1 className="text-3xl font-bold tracking-tight text-ink">{title}</h1>
          <div className="mt-6 space-y-4 text-sm leading-relaxed text-ink-muted">
            {children}
          </div>
          <p className="mt-10 text-xs text-ink-subtle">
            Pilot summary — final legal language will replace this before public
            launch.
          </p>
        </GlassCard>
      </div>
    </div>
  );
}
