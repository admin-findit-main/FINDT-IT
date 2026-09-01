export function normalizeProductName(name: string): string {
  return name.toLowerCase().trim().replace(/\s+/g, " ");
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 60);
}

export function formatRelativeTime(date: string | Date): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const seconds = Math.floor((Date.now() - d.getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

export function formatExpiresIn(expiresAt: string | Date): string {
  const d = typeof expiresAt === "string" ? new Date(expiresAt) : expiresAt;
  const ms = d.getTime() - Date.now();
  if (ms <= 0) return "Expired";
  const hours = Math.floor(ms / (1000 * 60 * 60));
  const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
  if (hours >= 24) {
    const days = Math.floor(hours / 24);
    return `Expires in ${days}d ${hours % 24}h`;
  }
  return `Expires in ${hours}h ${minutes}m`;
}

export function isRequestExpired(expiresAt: string, status?: string): boolean {
  if (status === "expired" || status === "cancelled") return true;
  return new Date(expiresAt).getTime() < Date.now();
}

export type MapsDestination = {
  street_address: string;
  city: string;
  state: string;
  postal_code: string;
  latitude?: number | null;
  longitude?: number | null;
};

function mapsQuery(store: MapsDestination): string {
  return [store.street_address, store.city, store.state, store.postal_code]
    .filter((part) => part && String(part).trim())
    .join(", ");
}

function mapsUserAgent(override?: string): string {
  if (override != null) return override;
  if (typeof navigator === "undefined") return "";
  return navigator.userAgent || "";
}

function isAppleHandheld(ua: string, inferTouchMac: boolean): boolean {
  if (/iPad|iPhone|iPod/i.test(ua)) return true;
  if (!inferTouchMac || typeof navigator === "undefined") return false;
  return navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
}

/** Opens the device’s default maps app on phones; Google Maps in a desktop browser. */
export function mapsDirectionsUrl(
  store: MapsDestination,
  userAgent?: string
): string {
  const address = mapsQuery(store);
  const q = encodeURIComponent(address);
  const lat = Number(store.latitude);
  const lng = Number(store.longitude);
  const hasCoords = Number.isFinite(lat) && Number.isFinite(lng);
  const ua = mapsUserAgent(userAgent);

  if (isAppleHandheld(ua, userAgent == null)) {
    const daddr = hasCoords ? `${lat},${lng}` : q;
    return `https://maps.apple.com/?daddr=${daddr}&dirflg=d`;
  }
  if (/Android/i.test(ua)) {
    return hasCoords ? `geo:${lat},${lng}?q=${q}` : `geo:0,0?q=${q}`;
  }
  const destination = hasCoords ? `${lat},${lng}` : q;
  return `https://www.google.com/maps/dir/?api=1&destination=${destination}`;
}

/** Native map URLs must not use target=_blank or the OS won’t hand off to Maps. */
export function mapsDirectionsAnchorProps(
  store: MapsDestination,
  userAgent?: string
): { href: string; target?: "_blank"; rel?: string } {
  const href = mapsDirectionsUrl(store, userAgent);
  if (href.startsWith("geo:") || href.includes("maps.apple.com")) {
    return { href };
  }
  return { href, target: "_blank", rel: "noreferrer" };
}

export function displayName(profile: {
  first_name?: string | null;
  display_name?: string | null;
  email?: string | null;
}): string {
  if (profile.first_name?.trim()) return profile.first_name.trim();
  if (profile.display_name?.trim()) return profile.display_name.trim();
  if (profile.email) return profile.email.split("@")[0];
  return "Friend";
}

export function greetingForHour(date = new Date()): string {
  const h = date.getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}
