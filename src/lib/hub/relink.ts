export const HUB_RELINK_REASONS = [
  "disconnected",
  "invalid",
  "store_unavailable",
  "missing",
] as const;

export type HubRelinkReason = (typeof HUB_RELINK_REASONS)[number];

const COPY: Record<Exclude<HubRelinkReason, "missing">, string> = {
  disconnected:
    "This tablet was disconnected from the store. Wi‑Fi dropped, the owner turned it off, or the link expired. Ask them to enter this code under Devices.",
  invalid:
    "FINDIT no longer recognizes this tablet. Ask the owner to connect it again with this code under Devices.",
  store_unavailable:
    "This store isn’t available on FINDIT right now. When it is, the owner can reconnect with this code under Devices.",
};

export function parseHubRelinkReason(
  value: string | null | undefined
): HubRelinkReason | null {
  if (!value) return null;
  return (HUB_RELINK_REASONS as readonly string[]).includes(value)
    ? (value as HubRelinkReason)
    : null;
}

export function hubRelinkMessage(reason: HubRelinkReason | null | undefined): string | null {
  if (!reason || reason === "missing") return null;
  return COPY[reason];
}

export function hubConnectHref(reason?: HubRelinkReason | null): string {
  if (!reason || reason === "missing") return "/store/hub/connect";
  return `/store/hub/connect?reason=${reason}`;
}
