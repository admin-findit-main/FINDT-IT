"use client";

/** Full-bleed Find-home art. Characters stay visible at the bottom; no page scroll needed. */
export function PoohFindHomeBackground() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 z-0 overflow-hidden"
    >
      <div className="absolute inset-0 bg-[#FDF8E4]" />
      <div
        className="absolute inset-x-0 bottom-0 h-[58%] w-full"
        style={{
          backgroundImage: "url(/themes/pooh/find-home-bg.png)",
          backgroundPosition: "bottom center",
          backgroundRepeat: "no-repeat",
          backgroundSize: "cover",
        }}
      />
      {/* Soft veil only over the upper content band so type stays readable */}
      <div className="absolute inset-x-0 top-0 h-[48%] bg-gradient-to-b from-[#FDF8E4] via-[#FDF8E4]/88 to-transparent" />
    </div>
  );
}
