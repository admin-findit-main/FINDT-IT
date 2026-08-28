import type { Metadata } from "next";
import Link from "next/link";
import { MarketingHeader } from "@/components/marketing/site-header";
import { SiteFooter } from "@/components/shared/site-footer";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/primitives";
import { marketingHomeHref } from "@/lib/config/product-hosts";

export const metadata: Metadata = {
  title: "Page not found",
};

export default function NotFound() {
  return (
    <div className="app-canvas flex min-h-dvh flex-col overflow-x-clip">
      <MarketingHeader />
      <main className="mx-auto flex w-full max-w-lg flex-1 flex-col justify-center px-6 py-16">
        <Card sheen className="p-8 text-center sm:p-10">
          <p className="text-sm font-semibold text-accent-ink">404</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-ink">
            That page isn’t here
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-ink-muted">
            The link may be old, or the page moved. Head back to FINDIT and ask
            nearby stores from there.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
            <Button asChild size="lg">
              <Link href={marketingHomeHref()}>Go to FINDIT</Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link href="/contact">Contact support</Link>
            </Button>
          </div>
        </Card>
      </main>
      <SiteFooter />
    </div>
  );
}
