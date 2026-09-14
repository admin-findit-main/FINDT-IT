import { afterEach, describe, expect, it } from "vitest";

const ORIGINAL = {
  VERCEL_ENV: process.env.VERCEL_ENV,
  NODE_ENV: process.env.NODE_ENV,
  FINDIT_DEMO_MODE: process.env.FINDIT_DEMO_MODE,
  NEXT_PUBLIC_FINDIT_DEMO_MODE: process.env.NEXT_PUBLIC_FINDIT_DEMO_MODE,
  NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY:
    process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY,
};

afterEach(() => {
  for (const [key, value] of Object.entries(ORIGINAL)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

describe("production runtime guards", () => {
  it("refuses FINDIT_DEMO_MODE on Vercel production", async () => {
    process.env.VERCEL_ENV = "production";
    process.env.FINDIT_DEMO_MODE = "true";
    delete process.env.NEXT_PUBLIC_FINDIT_DEMO_MODE;
    const { getEnv } = await import("@/lib/config/env");
    expect(() => getEnv()).toThrow(/FINDIT_DEMO_MODE cannot be enabled/);
  });

  it("refuses NEXT_PUBLIC secrets by pattern", async () => {
    delete process.env.FINDIT_DEMO_MODE;
    delete process.env.NEXT_PUBLIC_FINDIT_DEMO_MODE;
    delete process.env.VERCEL_ENV;
    process.env.NEXT_PUBLIC_CUSTOM_PRIVATE_TOKEN = "leak";
    const { getEnv } = await import("@/lib/config/env");
    expect(() => getEnv()).toThrow(/NEXT_PUBLIC_CUSTOM_PRIVATE_TOKEN/);
    delete process.env.NEXT_PUBLIC_CUSTOM_PRIVATE_TOKEN;
  });
});
