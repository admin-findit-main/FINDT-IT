/**
 * Editorial chrome for the marketing site.
 *
 * Sections are divided by a full-width hairline and labelled in the left
 * margin — a numbered index, then the section name. Structure comes from the
 * grid and the rules, so nothing here draws a panel or a shadow.
 */
import * as React from "react";
import { cn } from "@/lib/utils";

export function MarketingSection({
  id,
  index,
  label,
  className,
  children,
}: {
  id?: string;
  index: string;
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      id={id}
      className={cn("border-t border-hairline-strong", className)}
    >
      <div className="mx-auto max-w-6xl px-5 py-14 sm:px-6 md:py-20">
        <div className="grid gap-8 md:grid-cols-[8rem_1fr] md:gap-12 lg:grid-cols-[11rem_1fr]">
          <p className="flex items-baseline gap-3 md:flex-col md:gap-2">
            <span className="text-[11px] font-semibold tabular-nums tracking-[0.18em] text-accent-ink">
              {index}
            </span>
            <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-ink-subtle">
              {label}
            </span>
          </p>
          <div className="min-w-0">{children}</div>
        </div>
      </div>
    </section>
  );
}

export function SectionTitle({
  className,
  ...props
}: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h2
      className={cn(
        "max-w-2xl text-[1.75rem] font-bold leading-[1.06] tracking-[-0.03em] text-ink md:text-[2.25rem]",
        className
      )}
      {...props}
    />
  );
}

export function SectionLede({
  className,
  ...props
}: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p
      className={cn(
        "mt-5 max-w-xl text-[15px] leading-relaxed text-ink-muted md:text-base",
        className
      )}
      {...props}
    />
  );
}

/**
 * Newspaper columns: a rule over each cell with its index beneath, rather than
 * a row of rounded boxes.
 */
export function RuledColumns({
  items,
  className,
  numbered = true,
}: {
  items: readonly { title: string; body?: React.ReactNode }[];
  className?: string;
  numbered?: boolean;
}) {
  return (
    <ol className={cn("grid gap-x-10 gap-y-8 sm:grid-cols-2", className)}>
      {items.map((item, index) => (
        <li key={item.title} className="border-t border-ink pt-4">
          {numbered ? (
            <span className="text-[11px] font-semibold tabular-nums tracking-[0.18em] text-ink-subtle">
              {String(index + 1).padStart(2, "0")}
            </span>
          ) : null}
          <p
            className={cn(
              "text-base font-semibold tracking-[-0.01em] text-ink",
              numbered && "mt-3"
            )}
          >
            {item.title}
          </p>
          {item.body ? (
            <p className="mt-2 text-sm leading-relaxed text-ink-muted">
              {item.body}
            </p>
          ) : null}
        </li>
      ))}
    </ol>
  );
}

/** Key/value rows for facts that want to be read as a table, not as cards. */
export function FactRows({
  rows,
  className,
}: {
  rows: readonly { term: string; value: React.ReactNode }[];
  className?: string;
}) {
  return (
    <dl
      className={cn(
        "max-w-xl divide-y divide-hairline-strong border-y border-hairline-strong",
        className
      )}
    >
      {rows.map((row) => (
        <div
          key={row.term}
          className="flex items-baseline justify-between gap-6 py-3.5"
        >
          <dt className="text-sm text-ink-muted">{row.term}</dt>
          <dd className="text-right text-sm font-semibold tabular-nums text-ink">
            {row.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}
