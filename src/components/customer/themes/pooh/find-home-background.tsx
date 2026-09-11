"use client";

/** Background for the Find home query step. Art lives under /themes/pooh/. */
export function PoohFindHomeBackground() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 z-0 overflow-hidden"
    >
      <div
        className="absolute inset-0"
        style={{
          backgroundColor: "#FDF8E4",
          backgroundImage: "url(/themes/pooh/find-home-bg.png)",
          backgroundPosition: "bottom center",
          backgroundRepeat: "no-repeat",
          backgroundSize: "min(100%, 42rem) auto",
        }}
      />
      <div className="absolute inset-0 bg-gradient-to-b from-[#FDF8E4] via-[#FDF8E4]/72 to-[#FDF8E4]/15" />
    </div>
  );
}
