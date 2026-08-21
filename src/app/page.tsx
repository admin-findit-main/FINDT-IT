import Link from "next/link";
import { headers } from "next/headers";
import { Button } from "@/components/ui/button";
import {
  GlassBadge,
  GlassCard,
  Overline,
  StatusPill,
  StatusRail,
} from "@/components/ui/glass";
import { APP_NAME, STORE_TRIAL_DAYS } from "@/lib/config/constants";
import { iosAppStoreUrl, playStoreUrl } from "@/lib/config/env";
import { BrandHomeLink, BrandLogo } from "@/components/brand/logo";
import {
  matchProductSurface,
  productUrl,
} from "@/lib/config/product-hosts";

function siteHref(
  host: string,
  surface: "dashboard" | "store" | "www",
  path: string
) {
  if (matchProductSurface(host) === "local") {
    if (surface === "store" && path === "/login") return "/login/business";
    return path;
  }
  return productUrl(surface, path, host);
}

export default async function LandingPage() {
  const host = (await headers()).get("host") || "";
  const ios = iosAppStoreUrl();
  const play = playStoreUrl();
  const signupHref = siteHref(host, "dashboard", "/signup");
  const loginHref = siteHref(host, "dashboard", "/login");
  const storeLoginHref = siteHref(host, "store", "/login");
  const joinHref = siteHref(host, "www", "/join");

  return (
    <div className="app-canvas min-h-screen">
      <header className="absolute inset-x-0 top-0 z-20">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
          <BrandHomeLink href="/" tone="dark" />
          <div className="flex items-center gap-2">
            <Button
              asChild
              variant="ghost"
              size="sm"
              className="hidden text-ink-inverse/80 hover:bg-white/10 hover:text-ink-inverse sm:inline-flex"
            >
              <Link href={storeLoginHref}>Business</Link>
            </Button>
            <Button
              asChild
              variant="ghost"
              size="sm"
              className="text-ink-inverse/80 hover:bg-white/10 hover:text-ink-inverse"
            >
              <Link href={loginHref}>Log in</Link>
            </Button>
            <Button asChild size="sm">
              <Link href={signupHref}>Sign up</Link>
            </Button>
          </div>
        </div>
      </header>

      <main>
        <section className="app-canvas-dark relative overflow-hidden">
          <div className="relative mx-auto grid max-w-6xl gap-12 px-6 pb-24 pt-28 md:grid-cols-2 md:items-center md:pb-32 md:pt-36">
            <div>
              <BrandLogo kind="mark" tone="dark" className="h-12 w-auto" />
              <Overline className="mt-6 text-ink-inverse/70">{APP_NAME}</Overline>
              <h1 className="mt-4 text-4xl font-bold tracking-tight text-ink-inverse sm:text-5xl md:text-6xl">
                Stop calling stores. Ask once.
              </h1>
              <p className="mt-5 text-xl font-medium text-ink-inverse/90 sm:text-2xl">
                Looking for something? Ask nearby stores at once.
              </p>
              <p className="mt-5 max-w-md text-base leading-relaxed text-ink-inverse/70">
                Who has it? {APP_NAME}. Not delivery. Not shipping. Just which
                local store actually has the product you want. The FINDIT app is
                how customers ask — this site is for stores and a web preview.
              </p>
              <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                <Button asChild size="xl">
                  <Link href={signupHref}>Try FINDIT</Link>
                </Button>
                <Button
                  asChild
                  variant="outline"
                  size="xl"
                  className="border-white/25 bg-white/10 text-ink-inverse hover:bg-white/20"
                >
                  <Link href={loginHref}>Log in</Link>
                </Button>
                <Button
                  asChild
                  variant="outline"
                  size="xl"
                  className="border-white/25 bg-white/10 text-ink-inverse hover:bg-white/20"
                >
                  <Link href={joinHref}>Apply as a store</Link>
                </Button>
              </div>
              {ios || play ? (
                <p className="mt-4 text-sm text-ink-inverse/60">
                  {ios ? (
                    <a href={ios} rel="noreferrer" className="underline underline-offset-2">
                      iPhone app
                    </a>
                  ) : null}
                  {ios && play ? " · " : null}
                  {play ? (
                    <a href={play} rel="noreferrer" className="underline underline-offset-2">
                      Google Play
                    </a>
                  ) : null}
                </p>
              ) : (
                <p className="mt-4 text-sm text-ink-inverse/60">
                  iPhone and Android apps are coming. Use the web app until then.
                </p>
              )}
            </div>

            <div className="relative">
              <GlassCard
                level="strong"
                className="rounded-glass-2xl p-6"
              >
                <Overline>What are you looking for?</Overline>
                <div className="mt-3 rounded-glass-lg border border-hairline-strong bg-glass-1 px-4 py-4 text-lg text-ink">
                  Cherry Coke Zero 12 Pack
                </div>
                <div className="mt-4 space-y-3">
                  <div className="relative overflow-hidden rounded-glass-lg border border-[var(--stock-border)] bg-stock-tint p-4 pl-5">
                    <StatusRail tone="stock" />
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-semibold text-ink">ABC Market</p>
                      <StatusPill tone="stock">In stock</StatusPill>
                    </div>
                    <p className="mt-1 text-sm text-ink-muted">
                      $12.99 · Falls Church
                    </p>
                  </div>
                  <div className="relative overflow-hidden rounded-glass-lg border border-[var(--order-border)] bg-order-tint p-4 pl-5">
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
              </GlassCard>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-6 py-16 md:py-20">
          <h2 className="text-2xl font-bold tracking-tight text-ink md:text-3xl">
            Different job than delivery or shipping
          </h2>
          <div className="mt-8 grid gap-5 md:grid-cols-3">
            {[
              {
                title: "DoorDash / delivery",
                body: "You already know where to order from.",
              },
              {
                title: "Amazon / ship",
                body: "You wait for a box to arrive.",
              },
              {
                title: "FINDIT",
                body: "You know what you want — who near you actually has it?",
              },
            ].map((item) => (
              <GlassCard key={item.title} level="subtle" padded>
                <h3 className="text-lg font-semibold text-ink">{item.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-ink-muted">
                  {item.body}
                </p>
              </GlassCard>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-6 py-16 md:py-20">
          <h2 className="text-3xl font-bold tracking-tight text-ink">
            How FINDIT works
          </h2>
          <div className="mt-10 grid gap-8 md:grid-cols-3">
            {[
              {
                step: "1",
                title: "Ask once.",
                body: "Describe the product. Add a photo if it helps.",
              },
              {
                step: "2",
                title: "Nearby stores receive it.",
                body: "Participating stores in your area see what you need.",
              },
              {
                step: "3",
                title: "See who has it.",
                body: "Get In Stock, Out of Stock, or Can Order replies.",
              },
            ].map((item) => (
              <div key={item.step}>
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-ink text-sm font-bold text-ink-inverse shadow-glass">
                  {item.step}
                </div>
                <h3 className="mt-4 text-lg font-semibold text-ink">
                  {item.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-ink-muted">
                  {item.body}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-6 py-8 md:py-12">
          <GlassCard
            level="strong"
            className="rounded-glass-2xl px-6 py-12 md:px-10 md:py-16"
          >
            <div className="grid gap-10 md:grid-cols-2 md:items-center">
              <div>
                <h2 className="text-3xl font-bold tracking-tight text-ink md:text-4xl">
                  Know what customers want before you order it.
                </h2>
                <p className="mt-4 max-w-md leading-relaxed text-ink-muted">
                  Approved stores answer nearby product asks and see demand —
                  including products you don&apos;t currently carry. Apply for a{" "}
                  {STORE_TRIAL_DAYS}-day free trial.
                </p>
                <Button asChild size="lg" className="mt-8">
                  <Link href={joinHref}>Apply as a store</Link>
                </Button>
              </div>
              <GlassCard level="subtle" padded className="rounded-glass-xl">
                <GlassBadge tone="order">High demand</GlassBadge>
                <p className="mt-3 text-xl font-semibold text-ink">
                  Red Bull Sea Blue Edition
                </p>
                <p className="mt-1 text-sm text-ink-muted">
                  37 requests · 29 times unavailable · 78% unmet demand
                </p>
                <p className="mt-4 text-sm font-medium text-ink">
                  Potential opportunity based on customer demand data.
                </p>
              </GlassCard>
            </div>
          </GlassCard>
        </section>
      </main>

      <footer className="mx-auto flex max-w-6xl flex-col gap-4 px-6 py-12 text-sm text-ink-muted sm:flex-row sm:items-center sm:justify-between">
        <p>© {new Date().getFullYear()} FINDIT</p>
        <div className="flex flex-wrap gap-4">
          <Link href="/contact" className="transition-colors hover:text-ink">
            Support
          </Link>
          <Link href="/pricing" className="transition-colors hover:text-ink">
            Pricing
          </Link>
          <Link href="/privacy" className="transition-colors hover:text-ink">
            Privacy
          </Link>
          <Link href="/terms" className="transition-colors hover:text-ink">
            Terms
          </Link>
          <Link
            href="/acceptable-use"
            className="transition-colors hover:text-ink"
          >
            Acceptable Use
          </Link>
          <Link
            href="/business-terms"
            className="transition-colors hover:text-ink"
          >
            Business Terms
          </Link>
        </div>
      </footer>
    </div>
  );
}
