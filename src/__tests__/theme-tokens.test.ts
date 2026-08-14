import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { palette, status, theme } from "@findit/theme";

/**
 * The web reads its design tokens from CSS custom properties, the mobile apps read
 * them from `@findit/theme`. Nothing enforces that at the type level, so these tests
 * fail loudly if a colour is changed in one place but not the other.
 */

const css = readFileSync(
  path.resolve(__dirname, "../app/globals.css"),
  "utf8"
).toLowerCase();

/**
 * Normalises a colour so `rgba(11, 11, 12, 0.10)` and `rgba(11,11,12,.1)` compare
 * equal — the comparison is about the colour, not how it was typed.
 */
function normalize(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "")
    .replace(/(\d*\.\d*?)0+(?=\D|$)/g, "$1")
    .replace(/\.(?=\D|$)/g, "");
}

/** Extracts the declared value of a CSS custom property from `:root`. */
function cssVar(name: string): string | null {
  const match = css.match(new RegExp(`--${name}\\s*:\\s*([^;]+);`));
  return match ? normalize(match[1]) : null;
}

describe("design tokens stay in sync between web CSS and @findit/theme", () => {
  const brand: Array<[string, string]> = [
    ["fd-black", palette.black],
    ["fd-red-500", palette.red500],
    ["fd-red-600", palette.red600],
    ["fd-ink-500", palette.ink500],
    ["fd-ink-900", palette.ink900],
  ];

  it.each(brand)("--%s matches the shared palette", (name, expected) => {
    expect(cssVar(name)).toBe(normalize(expected));
  });

  const surfaces: Array<[string, string]> = [
    ["canvas", theme.canvas],
    ["canvas-deep", theme.canvasDeep],
    ["glass-1", theme.glass1],
    ["glass-2", theme.glass2],
    ["glass-3", theme.glass3],
    ["glass-chrome", theme.glassChrome],
    ["hairline-strong", theme.hairlineStrong],
  ];

  it.each(surfaces)("--%s matches the shared surface token", (name, expected) => {
    expect(cssVar(name)).toBe(normalize(expected));
  });

  const responses: Array<[string, string]> = [
    ["stock", status.inStock.solid],
    ["stock-ink", status.inStock.ink],
    ["order", status.canOrder.solid],
    ["order-ink", status.canOrder.ink],
    ["oos", status.outOfStock.solid],
    ["oos-ink", status.outOfStock.ink],
  ];

  it.each(responses)("--%s matches the shared status token", (name, expected) => {
    expect(cssVar(name)).toBe(normalize(expected));
  });

  it("reserves red for actions rather than for the out-of-stock answer", () => {
    // Out of Stock is a legitimate reply, not an error, so it must not reuse the
    // brand action colour.
    expect(status.outOfStock.solid).not.toBe(palette.red500);
    expect(status.outOfStock.ink).not.toBe(palette.red600);
  });

  it("ships opaque fallbacks for reduced transparency", () => {
    expect(css).toContain("prefers-reduced-transparency: reduce");
    expect(css).toContain("prefers-reduced-motion: reduce");
    expect(cssVar("solid-2")).toBe(normalize(theme.solid2));
  });
});
