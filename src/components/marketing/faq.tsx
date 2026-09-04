import { DEFAULT_USAGE_PRICING, formatCents } from "@findit/domain";
import {
  FREE_MONTHLY_REQUEST_LIMIT,
  PLUS_PRICE_MONTHLY,
} from "@/lib/config/constants";
import { MarketingSection, SectionTitle } from "@/components/marketing/section";

const PLUS_PRICE = Number.isInteger(PLUS_PRICE_MONTHLY)
  ? `$${PLUS_PRICE_MONTHLY}`
  : `$${PLUS_PRICE_MONTHLY.toFixed(2)}`;

/**
 * Store pricing is read from the usage config rather than typed in, so the
 * answer here can never drift from what the product actually bills.
 */
const STORE_COST = [
  `Shoppers start free, with ${FREE_MONTHLY_REQUEST_LIMIT} Finds each month.`,
  `FINDIT+ is ${PLUS_PRICE}/month for more Finds and a wider search.`,
  `Stores start at ${formatCents(DEFAULT_USAGE_PRICING.baseMonthlyCents)}/month + ${formatCents(
    DEFAULT_USAGE_PRICING.visitCents
  )} per verified customer visit, after a ${DEFAULT_USAGE_PRICING.trialDays}-day trial.`,
  "Payments are coming soon. Enjoy the free trial until then.",
].join(" ");

const QUESTIONS = [
  {
    q: "What is FINDIT?",
    a: "You ask nearby stores if they have a product. Stores answer from the counter. Then you go pick it up.",
  },
  {
    q: "Is FINDIT delivery?",
    a: "No. FINDIT never sends a driver. You choose the store and pick the product up yourself.",
  },
  {
    q: "How do shoppers sign in?",
    a: "With your email. We send a 6-digit code. After that, your device stays signed in.",
  },
  {
    q: "Do stores see my phone number?",
    a: "No. Stores see the product you asked for and the area. Not your name or phone.",
  },
  {
    q: "What does it cost?",
    a: STORE_COST,
  },
  {
    q: "How do stores join?",
    a: "Apply at askfindit.com/join. We review the business, then the owner gets the store app.",
  },
  {
    q: "What is the Hub?",
    a: "A tablet at the counter. Staff tap answers there.",
  },
] as const;

export function MarketingFaq() {
  return (
    <MarketingSection id="faq" index="08" label="FAQ">
      <SectionTitle>Questions</SectionTitle>
      <div className="mt-10 max-w-2xl divide-y divide-hairline-strong border-y border-hairline-strong">
        {QUESTIONS.map((item) => (
          <details key={item.q} className="group py-4">
            <summary className="flex cursor-pointer list-none items-baseline justify-between gap-6 text-left text-base font-semibold tracking-[-0.01em] text-ink marker:content-none [&::-webkit-details-marker]:hidden">
              {item.q}
              <span
                aria-hidden
                className="shrink-0 text-lg font-normal leading-none text-ink-subtle transition-transform group-open:rotate-45"
              >
                +
              </span>
            </summary>
            <p className="mt-3 max-w-xl text-sm leading-relaxed text-ink-muted">
              {item.a}
            </p>
          </details>
        ))}
      </div>
    </MarketingSection>
  );
}
