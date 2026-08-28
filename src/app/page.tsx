import { BUSINESS_PRICE_MONTHLY } from "@/lib/config/constants";
import { BrandLogo } from "@/components/brand/logo";
import { MarketingHeader } from "@/components/marketing/site-header";
import { WaitlistForm } from "@/components/marketing/waitlist-form";
import { SiteFooter } from "@/components/shared/site-footer";
import { StatusPill, StatusRail } from "@/components/ui/glass";

const STORE_PRICE = Number.isInteger(BUSINESS_PRICE_MONTHLY)
  ? `$${BUSINESS_PRICE_MONTHLY}`
  : `$${BUSINESS_PRICE_MONTHLY.toFixed(2)}`;

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[var(--canvas)]">
      <MarketingHeader />

      <main>
        <section className="mx-auto grid max-w-6xl gap-12 px-5 pb-16 pt-12 sm:px-6 md:grid-cols-2 md:items-start md:gap-16 md:pb-24 md:pt-20">
          <div>
            <BrandLogo kind="mark" className="h-10 w-auto" />
            <h1 className="mt-6 max-w-lg text-4xl font-bold tracking-tight text-ink sm:text-5xl">
              Ask nearby stores if they have it.
            </h1>
            <p className="mt-5 max-w-md text-base leading-relaxed text-ink-muted sm:text-lg">
              You already know the product. You don’t know which shop has it
              today. FINDIT sends that one ask to stores around you. They answer
              from the counter — in stock, out of stock, or they can order it.
              Then you go pick it up.
            </p>
            <p className="mt-4 max-w-md text-base leading-relaxed text-ink-muted">
              FINDIT is not delivery and not shipping. The shopper app is how
              you ask. The store app is how a shop answers, including a
              countertop Hub. Sign-in is off while we waitlist.
            </p>
          </div>
          <WaitlistForm />
        </section>

        <section
          id="how"
          className="border-t border-hairline-strong bg-white py-16 md:py-20"
        >
          <div className="mx-auto max-w-6xl px-5 sm:px-6">
            <div className="grid gap-10 md:grid-cols-2 md:items-center md:gap-16">
              <div>
                <h2 className="text-2xl font-bold tracking-tight text-ink md:text-3xl">
                  How FINDIT works
                </h2>
                <ol className="mt-8 space-y-6">
                  <li>
                    <p className="font-semibold text-ink">You send a Find.</p>
                    <p className="mt-1 text-sm leading-relaxed text-ink-muted">
                      Name the product — size, flavor, a photo if that helps.
                      One ask goes to participating stores near you.
                    </p>
                  </li>
                  <li>
                    <p className="font-semibold text-ink">
                      Stores see it on their Hub.
                    </p>
                    <p className="mt-1 text-sm leading-relaxed text-ink-muted">
                      The Hub is a landscape tablet at the counter. Staff don’t
                      log into the owner account on that device. They tap a
                      reply and keep working.
                    </p>
                  </li>
                  <li>
                    <p className="font-semibold text-ink">
                      You see who actually has it.
                    </p>
                    <p className="mt-1 text-sm leading-relaxed text-ink-muted">
                      In stock, out of stock, or they can order it. You choose
                      where to go. FINDIT never sends a driver.
                    </p>
                  </li>
                </ol>
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
            <h2 className="text-2xl font-bold tracking-tight text-ink md:text-3xl">
              For stores
            </h2>
            <p className="mt-4 max-w-2xl text-base leading-relaxed text-ink-muted">
              {STORE_PRICE}/month per location. That’s the store app — Hub,
              incoming Finds, demand (what people asked for that you don’t
              carry), team logins, settings. One price, every feature. No
              extra tiers.
            </p>
            <ul className="mt-8 max-w-xl space-y-3 text-sm leading-relaxed text-ink">
              <li>Answer nearby product asks from the counter Hub.</li>
              <li>See demand for products you don’t stock yet.</li>
              <li>Owners and staff get their own logins. The Hub pairs with a code, not the owner password.</li>
            </ul>
            <p className="mt-8 text-sm text-ink-muted">
              We’re waitlisting stores too. Join as a store in the form above
              — we’ll email you when applications open.
            </p>
            <a
              href="#waitlist"
              className="mt-6 inline-flex min-h-11 items-center font-semibold text-accent-ink underline-offset-2 hover:underline"
            >
              Join the store waitlist
            </a>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
