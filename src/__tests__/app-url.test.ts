import { afterEach, describe, expect, it } from "vitest";
import { appUrl } from "@/lib/config/env";

const original = {
  app: process.env.NEXT_PUBLIC_APP_URL,
  vercel: process.env.VERCEL_URL,
  vercelProd: process.env.VERCEL_PROJECT_PRODUCTION_URL,
  nodeEnv: process.env.NODE_ENV,
};

afterEach(() => {
  process.env.NEXT_PUBLIC_APP_URL = original.app;
  process.env.VERCEL_URL = original.vercel;
  process.env.VERCEL_PROJECT_PRODUCTION_URL = original.vercelProd;
  process.env.NODE_ENV = original.nodeEnv;
});

describe("appUrl", () => {
  it("strips a trailing slash from the configured origin", () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://askfindit.com/";
    expect(appUrl()).toBe("https://askfindit.com");
  });

  it("falls back to the live site instead of localhost in production", () => {
    delete process.env.NEXT_PUBLIC_APP_URL;
    delete process.env.VERCEL_URL;
    delete process.env.VERCEL_PROJECT_PRODUCTION_URL;
    process.env.NODE_ENV = "production";
    expect(appUrl()).toBe("https://askfindit.com");
  });
});
