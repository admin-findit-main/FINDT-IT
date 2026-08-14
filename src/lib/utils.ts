import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export {
  normalizeProductName,
  slugify,
  formatRelativeTime,
  formatExpiresIn,
  isRequestExpired,
  mapsDirectionsUrl,
  displayName,
  greetingForHour,
} from "@findit/domain";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatPrice(price: number | null | undefined): string | null {
  if (price == null || Number.isNaN(Number(price))) return null;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(Number(price));
}

export function responseLabel(type: string): string {
  switch (type) {
    case "in_stock":
      return "IN STOCK";
    case "out_of_stock":
      return "OUT OF STOCK";
    case "can_order":
      return "CAN ORDER";
    default:
      return type.toUpperCase();
  }
}

export function sortResponsesByAvailability<T extends { response_type: string }>(
  responses: T[]
): T[] {
  const order: Record<string, number> = {
    in_stock: 0,
    can_order: 1,
    out_of_stock: 2,
  };
  return [...responses].sort(
    (a, b) => (order[a.response_type] ?? 9) - (order[b.response_type] ?? 9)
  );
}
