/**
 * Device / PWA helpers. SSR-safe: never throw when window/navigator are missing.
 * Pass `env` in tests; production callers omit it.
 */

export type PwaEnv = {
  userAgent?: string;
  platform?: string;
  maxTouchPoints?: number;
  /** iOS Safari `navigator.standalone`. */
  iosStandalone?: boolean;
  displayModeStandalone?: boolean;
  displayModeFullscreen?: boolean;
  hasNotification?: boolean;
  notificationPermission?: NotificationPermission;
};

function liveEnv(): PwaEnv {
  if (typeof window === "undefined" || typeof navigator === "undefined") {
    return {};
  }
  const nav = navigator as Navigator & { standalone?: boolean };
  return {
    userAgent: nav.userAgent,
    platform: nav.platform,
    maxTouchPoints: nav.maxTouchPoints,
    iosStandalone: Boolean(nav.standalone),
    displayModeStandalone: window.matchMedia?.("(display-mode: standalone)").matches,
    displayModeFullscreen: window.matchMedia?.("(display-mode: fullscreen)").matches,
    hasNotification: typeof Notification !== "undefined",
    notificationPermission:
      typeof Notification !== "undefined" ? Notification.permission : undefined,
  };
}

function ua(env: PwaEnv): string {
  return env.userAgent || "";
}

/** iPhone, iPod, iPad, and iPadOS (which reports as MacIntel). */
export function isIosDevice(env: PwaEnv = liveEnv()): boolean {
  const agent = ua(env);
  if (/iPhone|iPod|iPad/i.test(agent)) return true;
  // iPadOS 13+ uses a desktop Safari UA.
  if (env.platform === "MacIntel" && (env.maxTouchPoints || 0) > 1) return true;
  return false;
}

export function isAndroid(env: PwaEnv = liveEnv()): boolean {
  return /Android/i.test(ua(env));
}

/** True when FINDIT is running as an installed PWA, not a regular browser tab. */
export function isStandaloneDisplay(env: PwaEnv = liveEnv()): boolean {
  return Boolean(
    env.displayModeStandalone || env.displayModeFullscreen || env.iosStandalone
  );
}

export function supportsNotifications(env: PwaEnv = liveEnv()): boolean {
  return Boolean(env.hasNotification);
}

/**
 * iOS only allows web-push permission from the Home Screen PWA.
 * Requesting it in Safari shows a broken / no-op prompt.
 */
export function canRequestWebPush(env: PwaEnv = liveEnv()): boolean {
  if (!supportsNotifications(env)) return false;
  if (isIosDevice(env) && !isStandaloneDisplay(env)) return false;
  return true;
}

export function supportsPWAInstallPrompt(): boolean {
  if (typeof window === "undefined") return false;
  return "onbeforeinstallprompt" in window;
}

export type InstallSurface =
  | "standalone"
  | "ios-safari"
  | "android-prompt"
  | "android-manual"
  | "desktop";

export function getInstallSurface(
  canNativePrompt: boolean,
  env: PwaEnv = liveEnv()
): InstallSurface {
  if (isStandaloneDisplay(env)) return "standalone";
  if (isIosDevice(env)) return "ios-safari";
  if (canNativePrompt) return "android-prompt";
  if (isAndroid(env)) return "android-manual";
  return "desktop";
}

export type NotificationCapability =
  | "granted"
  | "denied"
  | "default"
  | "unsupported"
  | "ios-homescreen";

export function notificationCapability(
  env: PwaEnv = liveEnv()
): NotificationCapability {
  if (!supportsNotifications(env)) return "unsupported";
  if (isIosDevice(env) && !isStandaloneDisplay(env)) return "ios-homescreen";
  const permission = env.notificationPermission || "default";
  if (permission === "granted") return "granted";
  if (permission === "denied") return "denied";
  return "default";
}
