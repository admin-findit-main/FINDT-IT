import { describe, expect, it } from "vitest";
import {
  canRequestWebPush,
  getInstallSurface,
  isAndroid,
  isIosDevice,
  isStandaloneDisplay,
  notificationCapability,
  supportsNotifications,
} from "@/lib/pwa";
import {
  WEB_NOTIFY_PROMPT_DISMISS_KEY,
  defaultShopperOnboardingState,
  grandfatherShopperOnboardingIfNeeded,
  isShopperOnboardingComplete,
  markShopperOnboardingComplete,
  readShopperOnboardingState,
  shouldShowInstallHint,
  shopperOnboardingSteps,
  writeShopperOnboardingState,
  type ShopperOnboardingStorage,
} from "@/lib/customer/onboarding-state";

function memoryStore(seed: Record<string, string> = {}): ShopperOnboardingStorage {
  const data = { ...seed };
  return {
    getItem(key) {
      return data[key] ?? null;
    },
    setItem(key, value) {
      data[key] = value;
    },
    removeItem(key) {
      delete data[key];
    },
  };
}

describe("PWA helpers", () => {
  it("detects iPhone, iPadOS, and Android", () => {
    expect(
      isIosDevice({
        userAgent:
          "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605",
      })
    ).toBe(true);
    expect(
      isIosDevice({
        userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
        platform: "MacIntel",
        maxTouchPoints: 5,
      })
    ).toBe(true);
    expect(
      isAndroid({ userAgent: "Mozilla/5.0 (Linux; Android 14; Pixel 8)" })
    ).toBe(true);
    expect(isIosDevice({ userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)" })).toBe(
      false
    );
  });

  it("detects standalone without faking it from a button tap", () => {
    expect(isStandaloneDisplay({})).toBe(false);
    expect(isStandaloneDisplay({ displayModeStandalone: true })).toBe(true);
    expect(isStandaloneDisplay({ iosStandalone: true })).toBe(true);
  });

  it("does not allow iOS web push from regular Safari", () => {
    expect(
      canRequestWebPush({
        userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)",
        hasNotification: true,
        notificationPermission: "default",
      })
    ).toBe(false);
    expect(
      canRequestWebPush({
        userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)",
        iosStandalone: true,
        hasNotification: true,
        notificationPermission: "default",
      })
    ).toBe(true);
  });

  it("classifies install surfaces", () => {
    expect(
      getInstallSurface(false, {
        userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)",
      })
    ).toBe("ios-safari");
    expect(
      getInstallSurface(true, {
        userAgent: "Mozilla/5.0 (Linux; Android 14; Pixel 8)",
      })
    ).toBe("android-prompt");
    expect(
      getInstallSurface(true, {
        userAgent: "Mozilla/5.0 (Linux; Android 14; Pixel 8)",
        displayModeStandalone: true,
      })
    ).toBe("standalone");
    expect(getInstallSurface(false, { userAgent: "Mozilla/5.0 (Macintosh)" })).toBe(
      "desktop"
    );
    expect(getInstallSurface(true, { userAgent: "Mozilla/5.0 (Macintosh)" })).toBe(
      "android-prompt"
    );
  });

  it("reads notification capability without inventing granted", () => {
    expect(supportsNotifications({})).toBe(false);
    expect(
      notificationCapability({
        hasNotification: true,
        notificationPermission: "granted",
      })
    ).toBe("granted");
    expect(
      notificationCapability({
        userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)",
        hasNotification: true,
        notificationPermission: "default",
      })
    ).toBe("ios-homescreen");
  });
});

describe("shopper onboarding persistence", () => {
  it("starts incomplete and stays incomplete until marked", () => {
    const storage = memoryStore();
    expect(isShopperOnboardingComplete(storage)).toBe(false);
    expect(readShopperOnboardingState(storage).completedVersion).toBe(0);
  });

  it("remembers completion across reads so onboarding does not restart", () => {
    const storage = memoryStore();
    markShopperOnboardingComplete(storage);
    expect(isShopperOnboardingComplete(storage)).toBe(true);
    expect(isShopperOnboardingComplete(storage)).toBe(true);
  });

  it("grandfathers devices that already used FINDIT", () => {
    const storage = memoryStore({ [WEB_NOTIFY_PROMPT_DISMISS_KEY]: "1" });
    grandfatherShopperOnboardingIfNeeded(storage);
    expect(isShopperOnboardingComplete(storage)).toBe(true);
  });

  it("does not grandfather a blank new device", () => {
    const storage = memoryStore();
    grandfatherShopperOnboardingIfNeeded(storage);
    expect(isShopperOnboardingComplete(storage)).toBe(false);
  });

  it("keeps install education separate from actual standalone state", () => {
    const storage = memoryStore();
    writeShopperOnboardingState({ installEducationSeen: true }, storage);
    expect(readShopperOnboardingState(storage).installEducationSeen).toBe(true);
    expect(isStandaloneDisplay({})).toBe(false);
  });

  it("skips install when already standalone and notify when already granted", () => {
    expect(
      shopperOnboardingSteps({ standalone: true, notification: "granted" })
    ).toEqual(["welcome", "how", "ready"]);
    expect(
      shopperOnboardingSteps({ standalone: false, notification: "granted" })
    ).toEqual(["welcome", "how", "install", "ready"]);
    expect(
      shopperOnboardingSteps({ standalone: false, notification: "default" })
    ).toEqual(["welcome", "how", "install", "notify", "ready"]);
  });

  it("does not show the later install hint on every visit", () => {
    const skipped = {
      ...defaultShopperOnboardingState(),
      completedVersion: 1,
      installSkipped: true,
      completedAt: Date.now() - 2 * 60 * 60 * 1000,
    };
    expect(shouldShowInstallHint({ standalone: false, state: skipped })).toBe(true);
    expect(shouldShowInstallHint({ standalone: true, state: skipped })).toBe(false);
    expect(
      shouldShowInstallHint({
        standalone: false,
        state: {
          ...skipped,
          completedAt: Date.now(),
        },
      })
    ).toBe(false);
    expect(
      shouldShowInstallHint({
        standalone: false,
        now: Date.now(),
        state: {
          ...skipped,
          installHintDismissedAt: Date.now(),
        },
      })
    ).toBe(false);
  });
});
