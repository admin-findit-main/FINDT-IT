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
    a: "With your phone. We text a 6-digit code.",
  },
  {
    q: "Do stores see my phone number?",
    a: "No. Stores see the product you asked for and the area. Not your name or phone.",
  },
  {
    q: "What does it cost?",
    a: "Shoppers start free, with 5 Finds each month. FINDIT+ is $4.99/month for more Finds and a wider search. Stores are $99/month per location after a 30-day trial. Payments are coming soon. Enjoy the free trial until then.",
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
    <section id="faq" className="border-t border-hairline-strong bg-white py-16 md:py-20">
      <div className="mx-auto max-w-3xl px-5 sm:px-6">
        <h2 className="text-2xl font-bold tracking-tight text-ink md:text-3xl">
          Questions
        </h2>
        <div className="mt-8 divide-y divide-hairline-strong border-y border-hairline-strong">
          {QUESTIONS.map((item) => (
            <details key={item.q} className="group py-4">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-left text-base font-semibold text-ink marker:content-none [&::-webkit-details-marker]:hidden">
                {item.q}
                <span
                  aria-hidden
                  className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[var(--solid-3)] text-lg leading-none text-ink-muted transition-transform group-open:rotate-45"
                >
                  +
                </span>
              </summary>
              <p className="mt-3 max-w-2xl text-sm leading-relaxed text-ink-muted">
                {item.a}
              </p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
