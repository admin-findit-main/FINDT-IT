import {
  DEFAULT_USAGE_PRICING,
  formatCents,
  usageTiers,
} from "@findit/domain";
import {
  MarketingSection,
  RuledColumns,
  SectionLede,
  SectionTitle,
} from "@/components/marketing/section";

const STORE_TRIAL_DAYS = DEFAULT_USAGE_PRICING.trialDays;

const VERIFIED_STEPS = [
  "A customer looks for a product",
  "Your store responds",
  "The customer chooses your store",
  "They check in when they arrive",
  "FINDIT records a verified visit",
] as const;

const INCLUDED = [
  `${STORE_TRIAL_DAYS}-day free trial`,
  "No long-term contract",
  "FINDIT Hub included",
  "Transparent billing from verified customer activity",
  "Built for local stores",
] as const;

export function StorePricingSections({
  showTrialCta = true,
}: {
  showTrialCta?: boolean;
}) {
  const tiers = usageTiers();
  const starter = formatCents(DEFAULT_USAGE_PRICING.baseMonthlyCents);
  const visit = formatCents(DEFAULT_USAGE_PRICING.visitCents);
  const cap = formatCents(DEFAULT_USAGE_PRICING.paygMaxCents);

  return (
    <>
      <MarketingSection id="pricing" index="04" label="FINDIT for stores">
        <SectionTitle>Starts at {starter}/month</SectionTitle>
        <SectionLede>
          + {visit} per verified customer visit. You only pay more when FINDIT
          actually brings customers to your store.
        </SectionLede>

        <div className="mt-10 grid gap-x-8 gap-y-8 sm:grid-cols-2 xl:grid-cols-5">
          {tiers.map((tier) => (
            <div key={tier.id} className="border-t border-ink pt-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-subtle">
                {tier.id === "payg"
                  ? "Starter / Pay as you grow"
                  : tier.id === "enterprise"
                    ? "Enterprise / High volume"
                    : tier.name}
              </p>
              <p className="mt-3 text-xl font-bold tabular-nums tracking-[-0.02em] text-ink">
                {tier.kind === "payg"
                  ? `${starter}/month`
                  : tier.kind === "contact"
                    ? "Contact FINDIT"
                    : `${formatCents(tier.monthlyCents || 0)}/month`}
              </p>
              <p className="mt-2 text-sm leading-relaxed text-ink-muted">
                {tier.kind === "payg"
                  ? `+ ${visit} per verified customer. Up to ${cap}/month. Best for stores getting started with FINDIT.`
                  : tier.kind === "contact"
                    ? `${tier.minVisits.toLocaleString()}+ verified visits. Custom pricing — FINDIT will not auto-charge.`
                    : `For stores receiving ${tier.minVisits.toLocaleString()}–${(
                        tier.maxVisits || 0
                      ).toLocaleString()} verified FINDIT visits per month.`}
              </p>
            </div>
          ))}
        </div>

        {showTrialCta ? (
          <a
            href="/join"
            className="mt-10 inline-flex min-h-11 items-center border-b border-accent-ink font-semibold text-accent-ink"
          >
            Start your free trial
          </a>
        ) : null}

        <ul className="mt-10 max-w-xl divide-y divide-hairline-strong border-y border-hairline-strong text-sm text-ink-muted">
          {INCLUDED.map((item) => (
            <li key={item} className="py-3">
              {item}
            </li>
          ))}
        </ul>
      </MarketingSection>

      <MarketingSection
        id="verified-visits"
        index="05"
        label="Verified visits"
      >
        <SectionTitle>You pay when FINDIT works</SectionTitle>
        <ol className="mt-10 max-w-2xl divide-y divide-hairline-strong border-y border-hairline-strong">
          {VERIFIED_STEPS.map((step, index) => (
            <li key={step} className="flex items-baseline gap-5 py-4">
              <span className="w-6 shrink-0 text-[11px] font-semibold tabular-nums tracking-[0.14em] text-ink-subtle">
                {String(index + 1).padStart(2, "0")}
              </span>
              <p className="font-semibold tracking-[-0.01em] text-ink">
                {step}
              </p>
            </li>
          ))}
        </ol>
        <p className="mt-6 max-w-xl text-sm leading-relaxed text-ink-muted">
          No charge just because a request reached your store. No charge just
          because your employee responded. Usage is based on verified FINDIT
          visits — not guaranteed sales.
        </p>
      </MarketingSection>

      <MarketingSection id="everyone-wins" index="06" label="The network">
        <SectionTitle>Everyone wins</SectionTitle>
        <RuledColumns
          className="mt-10 xl:grid-cols-4"
          numbered={false}
          items={[
            {
              title: "Shoppers",
              body: "Find products faster and earn FINDIT Points.",
            },
            {
              title: "Employees",
              body: "Get recognized and rewarded for helping FINDIT customers.",
            },
            {
              title: "Store owners",
              body: "Get measurable customer traffic and transparent pricing.",
            },
            {
              title: "FINDIT",
              body: "Only grows when the network creates real value.",
            },
          ]}
        />
      </MarketingSection>
    </>
  );
}
