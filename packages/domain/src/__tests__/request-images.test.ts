import { describe, expect, it } from "vitest";
import {
  normalizeOwnedRequestImagePath,
  resolveOwnedRequestImageInput,
} from "../request-images";

const customerId = "11111111-1111-4111-8111-111111111111";

describe("request image ownership", () => {
  it("accepts normalized paths under the authenticated customer", () => {
    expect(
      normalizeOwnedRequestImagePath(`/${customerId}/photo.jpg`, customerId)
    ).toBe(`${customerId}/photo.jpg`);
    expect(
      resolveOwnedRequestImageInput({
        customerId,
        imageUrl: `${customerId}/photo.jpg`,
        imageStoragePath: `/${customerId}/photo.jpg`,
      })
    ).toEqual({ path: `${customerId}/photo.jpg` });
  });

  it.each([
    "https://attacker.example/photo.jpg",
    "22222222-2222-4222-8222-222222222222/photo.jpg",
    `${customerId}/../other/photo.jpg`,
    `${customerId}\\photo.jpg`,
    "data:image/png;base64,AAAA",
  ])("rejects unowned or unsafe image input: %s", (value) => {
    expect(normalizeOwnedRequestImagePath(value, customerId)).toBeNull();
  });

  it("rejects mismatched image fields", () => {
    expect(
      resolveOwnedRequestImageInput({
        customerId,
        imageUrl: `${customerId}/one.jpg`,
        imageStoragePath: `${customerId}/two.jpg`,
      })
    ).toEqual({ error: "Please upload the photo again." });
  });
});
