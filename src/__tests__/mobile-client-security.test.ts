import { describe, expect, it } from "vitest";
import { createMobileClient } from "../../packages/supabase-client/src/mobile";

const options = {
  supabaseUrl: "https://example.supabase.co",
};

describe("mobile Supabase client key safety", () => {
  it.each([
    "sb_secret_example",
    "eyJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIn0.signature",
  ])("rejects privileged key material", (supabaseAnonKey) => {
    expect(() =>
      createMobileClient({ ...options, supabaseAnonKey })
    ).toThrow(/Refusing to create mobile client/);
  });
});
