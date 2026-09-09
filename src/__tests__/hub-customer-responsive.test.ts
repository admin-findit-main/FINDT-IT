import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  path.resolve(__dirname, "../components/hub/customer-workspace.tsx"),
  "utf8"
);
const navigationSource = readFileSync(
  path.resolve(__dirname, "../components/hub/navigation.tsx"),
  "utf8"
);

describe("Hub customer keypad responsive contract", () => {
  it("never truncates the phone or purchase amount displays", () => {
    const displays = [
      source.match(
        /data-hub-number-display="phone"[\s\S]*?className="([^"]+)"/
      )?.[1],
      source.match(
        /data-hub-number-display="amount"[\s\S]*?className="([^"]+)"/
      )?.[1],
    ];

    expect(displays).not.toContain(undefined);
    for (const classes of displays) {
      expect(classes).toContain("whitespace-nowrap");
      expect(classes).toContain("clamp(");
      expect(classes).not.toContain("truncate");
    }
  });

  it("keeps narrow layouts side-by-side with touch-sized keypad keys", () => {
    expect(source).toContain(
      "grid-cols-[minmax(0,1fr)_minmax(9.5rem,42%)]"
    );
    expect(source).toContain("data-hub-keypad=\"phone\"");
    expect(source).toContain("data-hub-keypad=\"amount\"");
    expect(source).toContain("min-h-11 min-w-0");
  });

  it("renders only icons in the collapsed desktop sidebar", () => {
    const expandedOnlyBlocks = navigationSource.match(/\{!collapsed \? \(/g);

    expect(expandedOnlyBlocks).toHaveLength(2);
    expect(navigationSource).toMatch(
      /\{!collapsed \? \(\s*<span className="hidden whitespace-nowrap md:inline">\s*\{item\.label\}/
    );
    expect(navigationSource).toContain(
      'collapsed ? "grid md:hidden" : "grid md:static md:ml-auto"'
    );
    expect(navigationSource).toMatch(
      /\{collapsed \? \(\s*<PanelLeftOpen className="h-5 w-5" \/>\s*\) : \(\s*<>\s*<PanelLeftClose[\s\S]*?<span>Collapse<\/span>/
    );
    expect(navigationSource).toMatch(
      /\{!collapsed \? \(\s*<p className="mt-3 whitespace-nowrap text-center text-xs text-white\/50">\s*Powered by FINDIT\+/
    );

    // Mobile labels and badges retain md:hidden behavior regardless of collapse state.
    expect(navigationSource).toContain(
      '<span className="text-[10px] md:hidden">{item.label}</span>'
    );
  });
});
