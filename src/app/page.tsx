import {
  BUSINESS_PRICE_MONTHLY,
  FREE_MONTHLY_REQUEST_LIMIT,
  PLUS_PRICE_MONTHLY,
  STORE_TRIAL_DAYS,
} from "@/lib/config/constants";
import { BrandLockup, BrandLogo } from "@/components/brand/logo";
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

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[var(--canvas)]">
      <MarketingHeader />

      <main>
        <section className="mx-auto grid max-w-6xl gap-12 px-5 pb-16 pt-12 sm:px-6 md:grid-cols-2 md:items-center md:gap-16 md:pb-24 md:pt-20">
          <div>
            <BrandLockup />
            <p className="mt-6 text-xs font-semibold uppercase tracking-wide text-accent-ink">
              Ask once. Pick it up.
            </p>
            <h1 className="mt-3 max-w-lg text-4xl font-bold tracking-tight text-ink sm:text-5xl">
              Ask nearby stores if they have it.
            </h1>
            <p className="mt-5 max-w-md text-base leading-relaxed text-ink-muted sm:text-lg">
              You already know the product. You don’t know which shop has it
              today. FINDIT texts that one ask to stores around you. They
              answer from the counter — in stock, out of stock, or they can
              order it.
            </p>
            <p className="mt-4 max-w-md text-base leading-relaxed text-ink-muted">
              Then you go get it. FINDIT is not delivery and not shipping.
            </p>
          </div>
          <MarketingStartCard />
        </section>

        <section
          id="how"
          className="border-t border-hairline-strong bg-white py-16 md:py-20"
        >
          <div className="mx-auto max-w-6xl px-5 sm:px-6">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-subtle">
              The app
            </p>
            <h2 className="mt-2 text-2xl font-bold tracking-tight text-ink md:text-3xl">
              How FINDIT works
            </h2>
            <p className="mt-4 max-w-2xl text-base leading-relaxed text-ink-muted">
              Two sides, one loop. Shoppers ask from their phone. Stores
              answer at the counter. Nobody shares a personal number with a
              shop, and FINDIT never sends a driver.
            </p>

            <ol className="mt-10 grid gap-4 md:grid-cols-3">
              <li className="rounded-2xl border border-hairline-strong bg-[var(--canvas)] p-5">
                <p className="text-xs font-semibold uppercase tracking-wide text-ink-subtle">
                  1
                </p>
                <p className="mt-2 font-semibold text-ink">You send a Find.</p>
                <p className="mt-2 text-sm leading-relaxed text-ink-muted">
                  Name the product — size, flavor, a photo if that helps. One
                  ask goes to participating stores near you.
                </p>
              </li>
              <li className="rounded-2xl border border-hairline-strong bg-[var(--canvas)] p-5">
                <p className="text-xs font-semibold uppercase tracking-wide text-ink-subtle">
                  2
                </p>
                <p className="mt-2 font-semibold text-ink">Stores tap an answer.</p>
                <p className="mt-2 text-sm leading-relaxed text-ink-muted">
                  The Hub is a landscape tablet at the counter. Staff tap in
                  stock, out of stock, or can order — without the owner
                  password.
                </p>
              </li>
              <li className="rounded-2xl border border-hairline-strong bg-[var(--canvas)] p-5">
                <p className="text-xs font-semibold uppercase tracking-wide text-ink-subtle">
                  3
                </p>
                <p className="mt-2 font-semibold text-ink">You see who has it.</p>
                <p className="mt-2 text-sm leading-relaxed text-ink-muted">
                  Answers show up on your phone, closest first. You pick the
                  store and go. That’s the whole product.
                </p>
              </li>
            </ol>

            <div className="mt-12 grid gap-10 md:grid-cols-2 md:items-center md:gap-16">
              <div>
                <h3 className="text-xl font-bold tracking-tight text-ink">
                  For shoppers
                </h3>
                <p className="mt-3 text-sm leading-relaxed text-ink-muted">
                  Sign in with a text code. Free accounts get{" "}
                  {FREE_MONTHLY_REQUEST_LIMIT} Finds a month. FINDIT+ is{" "}
                  {PLUS_PRICE}/month for more Finds and a wider search when
                  shopper billing is on. Stores never see your phone number.
                </p>
              </div>
              <div className="rounded-2xl border border-hairline-strong bg-[var(--canvas)] p-5 sm:p-6">
                <p className="text-xs font-semibold uppercase tracking-wide text-ink-subtle">
                  What are you looking for?
                </p>
                <div className="mt-3 rounded-xl border border-hairline-strong bg-white px-4 py-3 text-base font-medium text-ink">
                  Cherry Coke Zero 12 Pack
                </div>
                <div className="mt-4 space-y-3">
                  <div className="relative overflow-hidden rounded-xl border border-[var(--stock-border)] bg-stock-tint p-4 pl-5">
                    <StatusRail tone="stock" />
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-semibold text-ink">ABC Market</p>
                      <StatusPill tone="stock">In stock</StatusPill>
                    </div>
                    <p className="mt-1 text-sm text-ink-muted">
                      $12.99 · Falls Church
                    </p>
                  </div>
                  <div className="relative overflow-hidden rounded-xl border border-[var(--order-border)] bg-order-tint p-4 pl-5">
                    <StatusRail tone="order" />
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-semibold text-ink">Local Market</p>
                      <StatusPill tone="order">Can order</StatusPill>
                    </div>
                    <p className="mt-1 text-sm text-ink-muted">
                      Available tomorrow
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="stores" className="py-16 md:py-20">
          <div className="mx-auto max-w-6xl px-5 sm:px-6">
            <BrandLogo kind="business" className="h-8" />
            <h2 className="mt-5 text-2xl font-bold tracking-tight text-ink md:text-3xl">
              For stores
            </h2>
            <p className="mt-4 max-w-2xl text-base leading-relaxed text-ink-muted">
              {STORE_PRICE}/month per location after a {STORE_TRIAL_DAYS}-day
              trial. That’s the whole store app — Hub, incoming Finds, demand
              (what people asked for that you don’t carry), team logins,
              settings. One price. No extra tiers.
            </p>
            <ul className="mt-8 max-w-xl space-y-3 text-sm leading-relaxed text-ink">
              <li>Answer nearby product asks from the counter Hub.</li>
              <li>See demand for products you don’t stock yet.</li>
              <li>
                Owners and staff get their own logins. The Hub pairs with a
                code, not the owner password.
              </li>
            </ul>
            <a
              href="/join"
              className="mt-8 inline-flex min-h-11 items-center font-semibold text-accent-ink underline-offset-2 hover:underline"
            >
              Apply your store
            </a>
          </div>
        </section>

        <MarketingFaq />
      </main>

      <SiteFooter />
    </div>
  );
}
