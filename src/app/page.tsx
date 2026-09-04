import {
  FREE_MONTHLY_REQUEST_LIMIT,
  PLUS_PRICE_MONTHLY,
  STORE_TRIAL_DAYS,
} from "@/lib/config/constants";
import { BrandLogo } from "@/components/brand/logo";
import { MarketingHeader } from "@/components/marketing/site-header";
import { MarketingStartCard } from "@/components/marketing/start-card";
import { MarketingFaq } from "@/components/marketing/faq";
import { SiteFooter } from "@/components/shared/site-footer";
import { StorePricingSections } from "@/components/marketing/store-pricing";
import {
  FactRows,
  MarketingSection,
  RuledColumns,
  SectionLede,
  SectionTitle,
} from "@/components/marketing/section";
import { StatusPill, type StatusTone } from "@/components/ui/glass";

const PLUS_PRICE = Number.isInteger(PLUS_PRICE_MONTHLY)
  ? `$${PLUS_PRICE_MONTHLY}`
  : `$${PLUS_PRICE_MONTHLY.toFixed(2)}`;

const STEPS = [
  "Ask for something",
  "Nearby stores receive your request",
  "Stores tell you if they have it",
  "Go get it",
] as const;

/** The specimen answer shown beside the headline. */
const ANSWERS: readonly {
  store: string;
  detail: string;
  label: string;
  tone: StatusTone;
  bar: string;
}[] = [
  {
    store: "Nearby grocery",
    detail: "Falls Church",
    label: "In stock",
    tone: "stock",
    bar: "bg-stock",
  },
  {
    store: "Nearby market",
    detail: "Available tomorrow",
    label: "Can order",
    tone: "order",
    bar: "bg-order",
  },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-canvas">
      <MarketingHeader />

      <main>
        <section className="mx-auto max-w-6xl px-5 sm:px-6">
          <div className="grid gap-12 py-14 md:grid-cols-[1.1fr_0.9fr] md:gap-14 md:py-24">
            <div className="md:border-r md:border-hairline-strong md:pr-14">
              <h1 className="max-w-xl text-[2.5rem] font-bold leading-[0.98] tracking-[-0.04em] text-ink sm:text-6xl">
                Stop calling stores.
                <br />
                <span className="text-accent-ink">Ask once.</span>
              </h1>
              <p className="mt-6 max-w-md text-base leading-relaxed text-ink-muted sm:text-lg">
                Tell nearby stores what you’re looking for. Stores respond when
                they have it.
              </p>
              <MarketingStartCard />
            </div>

            <div className="border-t border-hairline-strong pt-8 md:border-t-0 md:pt-1">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-ink-subtle">
                What are you looking for?
              </p>
              <p className="mt-4 border-b border-ink pb-4 text-xl font-semibold tracking-[-0.02em] text-ink">
                Cherry Coke Zero 12 Pack
              </p>
              <ul className="divide-y divide-hairline-strong">
                {ANSWERS.map((answer) => (
                  <li
                    key={answer.store}
                    className="flex items-center gap-4 py-4"
                  >
                    <span
                      aria-hidden
                      className={`h-9 w-[3px] shrink-0 ${answer.bar}`}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold text-ink">
                        {answer.store}
                      </span>
                      <span className="mt-0.5 block text-sm text-ink-muted">
                        {answer.detail}
                      </span>
                    </span>
                    <StatusPill tone={answer.tone}>{answer.label}</StatusPill>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        <MarketingSection id="how" index="01" label="How it works">
          <SectionTitle>Four steps, no phone calls.</SectionTitle>
          <RuledColumns
            className="mt-10 lg:grid-cols-4"
            items={STEPS.map((step) => ({ title: step }))}
          />
        </MarketingSection>

        <MarketingSection id="shoppers" index="02" label="For shoppers">
          <SectionTitle>Find it before you drive there.</SectionTitle>
          <SectionLede>
            Sign in with a 6-digit code to your email. Stores never see your
            phone number.
          </SectionLede>
          <FactRows
            className="mt-8"
            rows={[
              { term: "Free account", value: `${FREE_MONTHLY_REQUEST_LIMIT} Finds a month` },
              { term: "FINDIT+", value: `${PLUS_PRICE}/month` },
              { term: "FINDIT+ search", value: "Wider radius, more Finds" },
              { term: "What stores see", value: "The product and the area" },
            ]}
          />
        </MarketingSection>

        <MarketingSection id="stores" index="03" label="For stores">
          <BrandLogo kind="business" className="h-7" />
          <SectionTitle className="mt-6">
            Turn local demand into customers.
          </SectionTitle>
          <SectionLede>
            Nearby shoppers ask for products you already sell. Answer from the
            counter. Usage is based on verified customer visits after a{" "}
            {STORE_TRIAL_DAYS}-day trial — not on requests or replies alone.
          </SectionLede>
          <a
            href="/join"
            className="mt-8 inline-flex min-h-11 items-center border-b border-accent-ink font-semibold text-accent-ink"
          >
            Apply your store
          </a>
        </MarketingSection>

        <StorePricingSections />

        <MarketingSection index="07" label="Get started">
          <SectionTitle>It’s closer than you think.</SectionTitle>
          <div className="mt-8 max-w-md">
            <MarketingStartCard compact />
          </div>
        </MarketingSection>

        <MarketingFaq />
      </main>

      <SiteFooter />
    </div>
  );
}
