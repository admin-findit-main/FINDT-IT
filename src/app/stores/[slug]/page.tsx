import Link from "next/link";
import { notFound } from "next/navigation";
import { ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/primitives";
import { GlassBadge, GlassNav } from "@/components/ui/glass";
import { getStoreBySlugAction } from "@/lib/services/actions";
import { DAYS_OF_WEEK } from "@/lib/config/constants";
import { mapsDirectionsUrl } from "@/lib/utils";
import type { Metadata } from "next";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const store = await getStoreBySlugAction(slug);
  if (!store) return { title: "Store not found" };
  return {
    title: store.name,
    description: `${store.name} on FINDIT — ${store.city}, ${store.state}`,
  };
}

export default async function PublicStorePage({ params }: Props) {
  const { slug } = await params;
  const store = await getStoreBySlugAction(slug);
  if (!store) notFound();

  const hours = "hours" in store ? store.hours : [];
  const categories = "categories" in store ? store.categories : [];

  return (
    <div className="app-canvas min-h-screen">
      <GlassNav>
        <div className="mx-auto flex max-w-2xl items-center justify-between px-5 py-3">
          <Link
            href="/"
            className="flex items-center gap-1.5 text-xl font-bold tracking-tight text-ink"
          >
            FINDIT
            <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-accent" />
          </Link>
          <div className="flex items-center gap-2">
            <Button asChild variant="ghost" size="sm">
              <Link href="/">Home</Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href="/home">Find a product</Link>
            </Button>
          </div>
        </div>
      </GlassNav>
      <main className="mx-auto max-w-2xl px-5 pb-16 pt-6">
        <Card sheen className="p-6 sm:p-8">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-3xl font-bold tracking-tight text-ink">
              {store.name}
            </h1>
            {store.is_verified ? (
              <GlassBadge
                tone="ink"
                className="text-[10px] font-bold uppercase tracking-wide"
              >
                Verified FINDIT
              </GlassBadge>
            ) : null}
          </div>
          <p className="mt-2 text-sm text-ink-muted">
            {(categories || []).join(" · ") || "Local store"}
          </p>
          <p className="mt-4 leading-relaxed text-ink">
            {store.street_address}
            <br />
            {store.city}, {store.state} {store.postal_code}
          </p>
          {store.phone ? (
            <p className="mt-2 text-sm text-ink">{store.phone}</p>
          ) : null}
          {store.website ? (
            <a
              href={store.website}
              className="mt-1 inline-block text-sm font-semibold text-accent-ink underline underline-offset-2"
              target="_blank"
              rel="noreferrer"
            >
              Website
            </a>
          ) : null}
          <p className="mt-4 text-sm text-ink-muted">
            {store.avg_response_minutes
              ? `Usually responds within ${store.avg_response_minutes} minutes`
              : "Response time data coming soon"}
          </p>
          <Button asChild className="mt-6" size="lg">
            <a href={mapsDirectionsUrl(store)} target="_blank" rel="noreferrer">
              Get directions
              <ExternalLink className="h-4 w-4" />
            </a>
          </Button>
        </Card>

        <Card className="mt-4 p-6 sm:p-8">
          <h2 className="font-semibold text-ink">Hours</h2>
          <ul className="mt-4 divide-y divide-hairline-strong text-sm">
            {Array.from({ length: 7 }).map((_, day) => {
              const row = (hours || []).find(
                (h: { day_of_week: number }) => h.day_of_week === day
              );
              return (
                <li key={day} className="flex justify-between gap-3 py-2.5">
                  <span className="text-ink-muted">{DAYS_OF_WEEK[day]}</span>
                  <span className="font-medium text-ink">
                    {row?.is_closed || !row?.open_time
                      ? "Closed"
                      : `${row.open_time} – ${row.close_time}`}
                  </span>
                </li>
              );
            })}
          </ul>
        </Card>
      </main>
    </div>
  );
}
