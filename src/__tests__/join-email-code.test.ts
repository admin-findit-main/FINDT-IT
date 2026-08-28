import { describe, expect, it } from "vitest";
import {
  hashJoinEmailCode,
  joinEmailCodesMatch,
  normalizeJoinEmailCode,
} from "@/lib/security/join-email-code";

describe("join email codes", () => {
  it("hashes the same email and code the same way", () => {
    const left = hashJoinEmailCode("Casey@Store.example", "123456");
    const right = hashJoinEmailCode("casey@store.example", "123456");
    expect(joinEmailCodesMatch(left, right)).toBe(true);
  });

  it("does not match a different code", () => {
    const left = hashJoinEmailCode("casey@store.example", "123456");
    const right = hashJoinEmailCode("casey@store.example", "654321");
    expect(joinEmailCodesMatch(left, right)).toBe(false);
  });

  it("keeps six digits", () => {
    expect(normalizeJoinEmailCode("12 34-56 extra")).toBe("123456");
  });
});
