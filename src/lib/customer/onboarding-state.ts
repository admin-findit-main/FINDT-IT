/**
 * Device-local shopper onboarding. Installation and notification permission
 * are per-device, so this lives in localStorage — not the user profile.
 */

export const SHOPPER_ONBOARDING_VERSION = 1;
export const SHOPPER_ONBOARDING_KEY = "findit-shopper-onboarding-v1";
export const WEB_NOTIFY_PROMPT_DISMISS_KEY = "findit-web-notify-prompt-dismissed-v1";

const INSTALL_HINT_COOLDOWN_MS = 14 * 24 * 60 * 60 * 1000;

export type ShopperOnboardingStorage = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
};

export type ShopperOnboardingState = {
  /** Highest onboarding version this device finished. 0 = never finished. */
  completedVersion: number;
  completedAt: number | null;
  installEducationSeen: boolean;
  /** User tapped “Do this later” on the install step. Not the same as installed. */
  installSkipped: boolean;
  /** Welcome + how-it-works already shown on this device. */
  introSeen: boolean;
  notificationEducationSeen: boolean;
  locationEducationSeen: boolean;
  installHintDismissedAt: number | null;
};

export type ShopperOnboardingStepId =
  | "install"
  | "welcome"
  | "how"
  | "account"
  | "location"
  | "notify"
  | "ready";

const DEFAULT_STATE: ShopperOnboardingState = {
  completedVersion: 0,
  completedAt: null,
  installEducationSeen: false,
  installSkipped: false,
  introSeen: false,
  notificationEducationSeen: false,
  locationEducationSeen: false,
  installHintDismissedAt: null,
};

export function defaultShopperOnboardingState(): ShopperOnboardingState {
  return { ...DEFAULT_STATE };
}

function liveStorage(): ShopperOnboardingStorage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function parseState(raw: string | null): ShopperOnboardingState {
  if (!raw) return defaultShopperOnboardingState();
  try {
    const parsed = JSON.parse(raw) as Partial<ShopperOnboardingState>;
    return {
      completedVersion:
        typeof parsed.completedVersion === "number" ? parsed.completedVersion : 0,
      completedAt: typeof parsed.completedAt === "number" ? parsed.completedAt : null,
      installEducationSeen: Boolean(parsed.installEducationSeen),
      installSkipped: Boolean(parsed.installSkipped),
      introSeen: Boolean(parsed.introSeen),
      notificationEducationSeen: Boolean(parsed.notificationEducationSeen),
      locationEducationSeen: Boolean(parsed.locationEducationSeen),
      installHintDismissedAt:
        typeof parsed.installHintDismissedAt === "number"
          ? parsed.installHintDismissedAt
          : null,
    };
  } catch {
    return defaultShopperOnboardingState();
  }
}

export function readShopperOnboardingState(
  storage: ShopperOnboardingStorage | null = liveStorage()
): ShopperOnboardingState {
  if (!storage) return defaultShopperOnboardingState();
  try {
    return parseState(storage.getItem(SHOPPER_ONBOARDING_KEY));
  } catch {
    return defaultShopperOnboardingState();
  }
}

export function writeShopperOnboardingState(
  patch: Partial<ShopperOnboardingState>,
  storage: ShopperOnboardingStorage | null = liveStorage()
): ShopperOnboardingState {
  const next = { ...readShopperOnboardingState(storage), ...patch };
  if (!storage) return next;
  try {
    storage.setItem(SHOPPER_ONBOARDING_KEY, JSON.stringify(next));
  } catch {
    // Private mode / quota — keep going with in-memory state.
  }
  return next;
}

export function isShopperOnboardingComplete(
  storage: ShopperOnboardingStorage | null = liveStorage(),
  version = SHOPPER_ONBOARDING_VERSION
): boolean {
  return readShopperOnboardingState(storage).completedVersion >= version;
}

export function markShopperOnboardingComplete(
  storage: ShopperOnboardingStorage | null = liveStorage()
): ShopperOnboardingState {
  return writeShopperOnboardingState(
    {
      completedVersion: SHOPPER_ONBOARDING_VERSION,
      completedAt: Date.now(),
    },
    storage
  );
}

function storageHasKey(
  storage: ShopperOnboardingStorage,
  key: string
): boolean {
  try {
    return storage.getItem(key) != null;
  } catch {
    return false;
  }
}

/**
 * Existing shoppers already using FINDIT must not get trapped in onboarding.
 * If this device has prior shopper activity and no onboarding record, mark complete.
 */
export function grandfatherShopperOnboardingIfNeeded(
  storage: ShopperOnboardingStorage | null = liveStorage(),
  extras?: { sessionHasCache?: boolean }
): ShopperOnboardingState {
  const current = readShopperOnboardingState(storage);
  if (current.completedVersion >= SHOPPER_ONBOARDING_VERSION) return current;
  if (!storage) return current;

  const returning =
    storageHasKey(storage, WEB_NOTIFY_PROMPT_DISMISS_KEY) ||
    storageHasKey(storage, "findit:pending-find") ||
    Boolean(extras?.sessionHasCache);

  if (!returning) return current;
  return markShopperOnboardingComplete(storage);
}

export function shouldShowInstallHint(input: {
  standalone: boolean;
  state?: ShopperOnboardingState;
  now?: number;
}): boolean {
  if (input.standalone) return false;
  const state = input.state ?? defaultShopperOnboardingState();
  if (state.completedVersion < SHOPPER_ONBOARDING_VERSION) return false;
  if (!state.installSkipped) return false;
  const now = input.now ?? Date.now();
  if (state.completedAt && now - state.completedAt < 60 * 60 * 1000) return false;
  const dismissedAt = state.installHintDismissedAt;
  if (dismissedAt && now - dismissedAt < INSTALL_HINT_COOLDOWN_MS) return false;
  return true;
}

export function shopperOnboardingSteps(input: {
  standalone: boolean;
  notification: "granted" | "denied" | "default" | "unsupported";
  needsLocation: boolean;
  introSeen?: boolean;
  signedIn?: boolean;
}): ShopperOnboardingStepId[] {
  const introSeen = Boolean(input.introSeen);
  const signedIn = Boolean(input.signedIn);
  const steps: ShopperOnboardingStepId[] = [];
  if (!introSeen) {
    if (!input.standalone) steps.push("install");
    steps.push("welcome", "how");
    if (!signedIn) steps.push("account");
  }
  if (signedIn) {
    if (input.needsLocation) steps.push("location");
    if (input.notification === "default" || input.notification === "denied") {
      steps.push("notify");
    }
    steps.push("ready");
  }
  return steps;
}
