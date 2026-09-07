export const HUB_DEVICE_COOKIE = "findit_hub_device";
export const HUB_PAIRING_COOKIE = "findit_hub_pairing";
export const HUB_SHIFT_COOKIE = "findit_hub_shift";
export const HUB_PAIRING_TTL_MS = 10 * 60 * 1000;
export const HUB_DEVICE_ONLINE_MS = 2 * 60 * 1000;
export const HUB_DEVICE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;
/** Fallback only while Realtime is unavailable; live channels refresh immediately. */
export const HUB_INBOX_POLL_MS = 8_000;
export const HUB_DEVICE_HEARTBEAT_MS = 30_000;
