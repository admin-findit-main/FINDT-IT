/** Original (non-Disney) bear/honey placeholders — replace with licensed art later. */

export function HoneyPotMark({
  className,
  size = 40,
}: {
  className?: string;
  size?: number;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      aria-hidden
      className={className}
    >
      <ellipse cx="32" cy="54" rx="18" ry="4" fill="rgba(163,95,8,0.12)" />
      <path
        d="M18 28c0-6 6-10 14-10s14 4 14 10v16c0 6-6 10-14 10s-14-4-14-10V28z"
        fill="#F0B429"
        stroke="#A35F08"
        strokeWidth="1.5"
      />
      <path
        d="M20 30c2 2 7 3 12 3s10-1 12-3"
        stroke="#C97B0C"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <rect
        x="24"
        y="16"
        width="16"
        height="8"
        rx="2"
        fill="#E09B1A"
        stroke="#A35F08"
        strokeWidth="1.25"
      />
      <path
        d="M36 12c4 1 7 4 8 8"
        stroke="#C97B0C"
        strokeWidth="2"
        strokeLinecap="round"
        className="pooh-drip"
      />
      <circle cx="44" cy="22" r="2.5" fill="#C97B0C" className="pooh-drip" />
    </svg>
  );
}

export function SoftBearMark({
  className,
  size = 36,
}: {
  className?: string;
  size?: number;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      aria-hidden
      className={className}
    >
      <circle cx="18" cy="18" r="9" fill="#E8C07A" stroke="#A35F08" strokeWidth="1.25" />
      <circle cx="46" cy="18" r="9" fill="#E8C07A" stroke="#A35F08" strokeWidth="1.25" />
      <circle cx="32" cy="34" r="18" fill="#F2D19A" stroke="#A35F08" strokeWidth="1.5" />
      <circle cx="25" cy="32" r="2.5" fill="#5C3A12" />
      <circle cx="39" cy="32" r="2.5" fill="#5C3A12" />
      <ellipse cx="32" cy="40" rx="4" ry="3" fill="#C97B0C" />
      <path
        d="M26 46c3 2 9 2 12 0"
        stroke="#A35F08"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}
