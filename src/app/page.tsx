import {
  BUSINESS_PRICE_MONTHLY,
  FREE_MONTHLY_REQUEST_LIMIT,
  PLUS_PRICE_MONTHLY,
  STORE_TRIAL_DAYS,
} from "@/lib/config/constants";
import { BrandLogo } from "@/components/brand/logo";
import { MarketingHeader } from "@/components/marketing/site-header";
import { MarketingStartCard } from "@/components/marketing/start-card";
import { MarketingFaq } from "@/components/marketing/faq";
import { SiteFooter } from "@/components/shared/site-footer";
import { StatusPill, StatusRail } from "@/components/ui/glass";

const STORE_PRICE = Number.isInteger(BUSINESS_PRICE_MONTHLY)
  ? `$${BUSINESS_PRICE_MONTHLY}`
  : `$${BUSINESS_PRICE_MONTHLY.toFixed(2)}`;

const PLUS_PRICE = Number.isInteger(PLUS_PRICE_MONTHLY)
  ? `$${PLUS_PRICE_MONTHLY}`
  : `$${PLUS_PRICE_MONTHLY.toFixed(2)}`;

const STEPS = [
  "Ask for something",
  "Nearby stores receive your request",
  "Stores tell you if they have it",
  "Go get it",
] as const;

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[var(--canvas)]">
      <MarketingHeader />

      <main>
        <section className="mx-auto grid max-w-6xl gap-12 px-5 pb-16 pt-12 sm:px-6 md:grid-cols-2 md:items-center md:gap-16 md:pb-24 md:pt-20">
          <div>
            <h1 className="max-w-lg text-4xl font-bold tracking-tight text-ink sm:text-5xl">
              Stop calling stores. Ask once.
            </h1>
            <p className="mt-5 max-w-md text-base leading-relaxed text-ink-muted sm:text-lg">
              Tell nearby stores what you’re looking for. Stores respond when
              they have it.
            </p>
            <MarketingStartCard />
          </div>
          <div className="border-t border-hairline-strong pt-8 md:border-t-0 md:pt-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-subtle">
              What are you looking for?
            </p>
            <p className="mt-3 text-base font-medium text-ink">
              Cherry Coke Zero 12 Pack
            </p>
            <div className="mt-6 space-y-4">
              <div className="relative pl-5">
                <StatusRail tone="stock" />
                <div className="flex items-center justify-between gap-3">
                  <p className="font-semibold text-ink">Nearby grocery</p>
                  <StatusPill tone="stock">In stock</StatusPill>
                </div>
                <p className="mt-1 text-sm text-ink-muted">Falls Church</p>
              </div>
              <div className="relative pl-5">
                <StatusRail tone="order" />
                <div className="flex items-center justify-between gap-3">
                  <p className="font-semibold text-ink">Nearby market</p>
                  <StatusPill tone="order">Can order</StatusPill>
                </div>
                <p className="mt-1 text-sm text-ink-muted">Available tomorrow</p>
              </div>
            </div>
          </div>
        </section>

        <section
          id="how"
          className="border-t border-hairline-strong bg-white py-16 md:py-20"
        >
          <div className="mx-auto max-w-6xl px-5 sm:px-6">
            <h2 className="text-2xl font-bold tracking-tight text-ink md:text-3xl">
              How it works
            </h2>
            <ol className="mt-10 max-w-xl divide-y divide-hairline-strong border-y border-hairline-strong">
              {STEPS.map((step, index) => (
                <li key={step} className="flex items-baseline gap-4 py-4">
                  <span className="w-6 shrink-0 text-sm font-semibold tabular-nums text-ink-muted">
                    {index + 1}
                  </span>
                  <p className="font-semibold text-ink">{step}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section id="shoppers" className="py-16 md:py-20">
          <div className="mx-auto max-w-6xl px-5 sm:px-6">
            <h2 className="text-2xl font-bold tracking-tight text-ink md:text-3xl">
              Find it before you drive there.
            </h2>
            <p className="mt-4 max-w-xl text-base leading-relaxed text-ink-muted">
              Sign in with a text code. Free accounts get{" "}
              {FREE_MONTHLY_REQUEST_LIMIT} Finds a month. FINDIT+ is{" "}
              {PLUS_PRICE}/month for more Finds and a wider search. Stores never
              see your phone number.
            </p>
          </div>
        </section>

        <section
          id="stores"
          className="border-t border-hairline-strong bg-white py-16 md:py-20"
        >
          <div className="mx-auto max-w-6xl px-5 sm:px-6">
            <BrandLogo kind="business" className="h-8" />
            <h2 className="mt-5 text-2xl font-bold tracking-tight text-ink md:text-3xl">
              Turn local demand into customers.
            </h2>
            <p className="mt-4 max-w-xl text-base leading-relaxed text-ink-muted">
              Nearby shoppers ask for products you already sell. Answer from the
              counter. {STORE_PRICE}/month per location after a{" "}
              {STORE_TRIAL_DAYS}-day trial.
            </p>
            <a
              href="/join"
              className="mt-8 inline-flex min-h-11 items-center font-semibold text-accent-ink underline-offset-2 hover:underline"
            >
              Apply your store
            </a>
          </div>
        </section>

        <section className="border-t border-hairline-strong py-16 md:py-20">
          <div className="mx-auto max-w-6xl px-5 sm:px-6">
            <h2 className="text-2xl font-bold tracking-tight text-ink md:text-3xl">
              It’s closer than you think.
            </h2>
            <div className="mt-8 max-w-md">
              <MarketingStartCard compact />
            </div>
          </div>
        </section>

        <MarketingFaq />
      </main>

      <SiteFooter />
    </div>
  );
}
