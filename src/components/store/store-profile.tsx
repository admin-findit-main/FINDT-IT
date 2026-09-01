import { ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/primitives";
import { VerifiedStoreBadge } from "@/components/ui/glass";
import { DAYS_OF_WEEK } from "@/lib/config/constants";
import { mapsDirectionsUrl } from "@/lib/utils";

export type StoreProfileStore = {
  name: string;
  slug: string;
  city: string;
  state: string;
  postal_code: string;
  street_address: string;
  phone: string | null;
  website: string | null;
  is_verified: boolean;
  avg_response_minutes: number | null;
  latitude?: number | null;
  longitude?: number | null;
  hours?: {
    day_of_week: number;
    open_time: string | null;
    close_time: string | null;
    is_closed: boolean;
  }[];
  categories?: string[];
};

export function StoreProfile({ store }: { store: StoreProfileStore }) {
  const hours = store.hours || [];
  const categories = store.categories || [];

  return (
    <>
      <Card sheen className="p-6 sm:p-8">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-3xl font-bold tracking-tight text-ink">
            {store.name}
          </h1>
          {store.is_verified ? <VerifiedStoreBadge label="Verified FINDIT" /> : null}
        </div>
        <p className="mt-2 text-sm text-ink-muted">
          {categories.join(" · ") || "Local store"}
        </p>
        <p className="mt-4 leading-relaxed text-ink">
          {store.street_address}
          <br />
          {store.city}, {store.state} {store.postal_code}
        </p>
        {store.phone ? (
          <p className="mt-2 text-sm text-ink">
            <a
              className="font-semibold underline underline-offset-2"
              href={`tel:${store.phone.replace(/[^\d+]/g, "")}`}
            >
              {store.phone}
            </a>
          </p>
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
            const row = hours.find((h) => h.day_of_week === day);
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
    </>
  );
}
