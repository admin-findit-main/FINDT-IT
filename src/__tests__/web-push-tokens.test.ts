import { describe, expect, it } from "vitest";
import { isExpoPushToken, parseWebPushSubscription } from "@/lib/services/web-push";

describe("push token routing", () => {
  it("recognizes Expo tokens", () => {
    expect(isExpoPushToken("ExponentPushToken[abc]")).toBe(true);
    expect(isExpoPushToken("ExpoPushToken[abc]")).toBe(true);
  });

  it("parses a web push subscription JSON token", () => {
    const token = JSON.stringify({
      endpoint: "https://fcm.googleapis.com/fcm/send/abc",
      keys: { p256dh: "p", auth: "a" },
    });
    expect(parseWebPushSubscription(token)).toEqual({
      endpoint: "https://fcm.googleapis.com/fcm/send/abc",
      keys: { p256dh: "p", auth: "a" },
    });
    expect(isExpoPushToken(token)).toBe(false);
  });
});
