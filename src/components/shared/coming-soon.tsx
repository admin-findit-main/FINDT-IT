import {
  PAYMENTS_COMING_SOON_BODY,
  PAYMENTS_COMING_SOON_NOTE,
  PAYMENTS_COMING_SOON_TITLE,
} from "@/lib/config/constants";

export function ComingSoonFeature({
  title = "Coming soon",
  description = "We're still working on this feature.",
  note,
}: {
  title?: string;
  description?: string;
  note?: string;
}) {
  return (
    <div className="py-10 text-center">
      <p aria-hidden className="text-2xl">
        🔒
      </p>
      <h2 className="mt-3 text-lg font-semibold tracking-tight text-ink">{title}</h2>
      <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-ink-muted">
        {description}
      </p>
      {note ? (
        <p className="mx-auto mt-3 max-w-sm text-xs leading-relaxed text-ink-subtle">
          {note}
        </p>
      ) : null}
    </div>
  );
}

export function PaymentsComingSoon() {
  return (
    <ComingSoonFeature
      title={PAYMENTS_COMING_SOON_TITLE}
      description={PAYMENTS_COMING_SOON_BODY}
      note={PAYMENTS_COMING_SOON_NOTE}
    />
  );
}
