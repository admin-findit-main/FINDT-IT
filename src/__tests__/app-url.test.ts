import { afterEach, describe, expect, it } from "vitest";
import { appUrl } from "@/lib/config/env";

const original = {
  app: process.env.NEXT_PUBLIC_APP_URL,
  vercel: process.env.VERCEL_URL,
  vercelProd: process.env.VERCEL_PROJECT_PRODUCTION_URL,
};

afterEach(() => {
  process.env.NEXT_PUBLIC_APP_URL = original.app;
  process.env.VERCEL_URL = original.vercel;
  process.env.VERCEL_PROJECT_PRODUCTION_URL = original.vercelProd;
});

describe("appUrl", () => {
  it("uses www as the canonical public origin", () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://askfindit.com/";
    expect(appUrl()).toBe("https://www.askfindit.com");
  });

  it("falls back to the live site instead of localhost in production", () => {
    delete process.env.NEXT_PUBLIC_APP_URL;
    delete process.env.VERCEL_URL;
    delete process.env.VERCEL_PROJECT_PRODUCTION_URL;
    expect(appUrl()).toBe("https://www.askfindit.com");
  });
});
