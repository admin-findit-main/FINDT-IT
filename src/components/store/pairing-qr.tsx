"use client";

import { useMemo } from "react";
import { encode } from "uqr";

export function PairingQr({ value, label }: { value: string; label: string }) {
  const svg = useMemo(() => {
    const qr = encode(value, { ecc: "M", border: 2 });
    const cells: string[] = [];
    for (let y = 0; y < qr.size; y++) {
      for (let x = 0; x < qr.size; x++) {
        if (qr.data[y][x]) cells.push(`<rect x="${x}" y="${y}" width="1" height="1" />`);
      }
    }
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${qr.size} ${qr.size}" shape-rendering="crispEdges">${cells.join("")}</svg>`;
  }, [value]);

  return (
    <div className="mx-auto w-52 rounded-2xl bg-white p-3">
      <div
        aria-label={label}
        role="img"
        className="aspect-square w-full text-black"
        dangerouslySetInnerHTML={{ __html: svg }}
      />
    </div>
  );
}
