const QUESTIONS = [
  {
    q: "What is FINDIT?",
    a: "FINDIT is how you ask nearby stores if they have a product — without calling around. You send one Find. Participating shops answer from the counter: in stock, out of stock, or they can order it. Then you go pick it up.",
  },
  {
    q: "Is FINDIT delivery or shipping?",
    a: "No. FINDIT never sends a driver and never ships a box. You choose the store and pick the product up yourself.",
  },
  {
    q: "How do shoppers sign in?",
    a: "With your phone. We text a 6-digit code. No email or password for shoppers.",
  },
  {
    q: "Do stores see my name or phone number?",
    a: "No. Stores see the product you asked for and the area. They do not get your name, phone, or email.",
  },
  {
    q: "What does it cost?",
    a: "Shoppers start free — 5 Finds each month. FINDIT+ is $4.99/month for more Finds and a wider search when shopper billing is on. Stores are $99/month per location after a 30-day trial. We are not charging cards until billing is turned on.",
  },
  {
    q: "How do stores join?",
    a: "Apply at askfindit.com/join. We review the business, then the owner gets the store app — Hub at the counter, incoming Finds, demand, and team logins.",
  },
  {
    q: "What is the Hub?",
    a: "A landscape tablet at the counter. Staff tap answers there. It pairs with a code, so nobody types the owner password on the floor.",
  },
] as const;

export function MarketingFaq() {
  return (
    <section id="faq" className="border-t border-hairline-strong bg-white py-16 md:py-20">
      <div className="mx-auto max-w-3xl px-5 sm:px-6">
        <p className="text-xs font-semibold uppercase tracking-wide text-ink-subtle">
          Questions
        </p>
        <h2 className="mt-2 text-2xl font-bold tracking-tight text-ink md:text-3xl">
          Q&A
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
