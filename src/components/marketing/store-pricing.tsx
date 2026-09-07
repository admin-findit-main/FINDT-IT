import {
  BUSINESS_PRICE_MONTHLY,
  STORE_TRIAL_DAYS,
} from "@/lib/config/constants";
import {
  MarketingSection,
  RuledColumns,
  SectionLede,
  SectionTitle,
} from "@/components/marketing/section";

const STORE_WORKFLOW = [
  "A customer asks nearby stores for a product",
  "Your team answers from FINDIT Hub",
  "The customer chooses where to go",
  "Staff can look up the customer and confirm a purchase",
] as const;

export function StorePricingSections({
  showTrialCta = true,
}: {
  showTrialCta?: boolean;
}) {
  return (
    <>
      <MarketingSection id="pricing" index="04" label="FINDIT for stores">
        <SectionTitle>${BUSINESS_PRICE_MONTHLY}/month</SectionTitle>
        <SectionLede>
          One FINDIT Business subscription after a {STORE_TRIAL_DAYS}-day free
          trial, with no per-visit charges.
        </SectionLede>

        <RuledColumns
          className="mt-10 xl:grid-cols-4"
          numbered={false}
          items={[
            {
              title: "Requests",
              body: "Receive nearby product requests and answer from the counter.",
            },
            {
              title: "Customers",
              body: "Look up, add, or remove store customers from FINDIT Hub.",
            },
            {
              title: "Rewards",
              body: "Confirm purchases and run store-funded loyalty points.",
            },
            {
              title: "Team",
              body: "Connect counter devices, invite staff, and manage shifts.",
            },
          ]}
        />

        {showTrialCta ? (
          <a
            href="/join"
            className="mt-10 inline-flex min-h-11 items-center border-b border-accent-ink font-semibold text-accent-ink"
          >
            Start your free trial
          </a>
        ) : null}
      </MarketingSection>

      <MarketingSection id="store-workflow" index="05" label="Store workflow">
        <SectionTitle>Requests and customers in one Hub</SectionTitle>
        <ol className="mt-10 max-w-2xl divide-y divide-hairline-strong border-y border-hairline-strong">
          {STORE_WORKFLOW.map((step, index) => (
            <li key={step} className="flex items-baseline gap-5 py-4">
              <span className="w-6 shrink-0 text-[11px] font-semibold tabular-nums tracking-[0.14em] text-ink-subtle">
                {String(index + 1).padStart(2, "0")}
              </span>
              <p className="font-semibold tracking-[-0.01em] text-ink">{step}</p>
            </li>
          ))}
        </ol>
      </MarketingSection>

      <MarketingSection id="everyone-wins" index="06" label="The network">
        <SectionTitle>Built for local pickup</SectionTitle>
        <RuledColumns
          className="mt-10 xl:grid-cols-3"
          numbered={false}
          items={[
            {
              title: "Shoppers",
              body: "Find products nearby and choose the store that answered.",
            },
            {
              title: "Store teams",
              body: "Answer requests and serve customers from one counter workspace.",
            },
            {
              title: "Store owners",
              body: "See demand, manage the team, and run store loyalty.",
            },
          ]}
        />
      </MarketingSection>
    </>
  );
}
