import { SUPPORT_EMAIL } from "@/lib/auth/admin";

/** Public inbox shown on Contact / footer. Override with NEXT_PUBLIC_SUPPORT_EMAIL. */
export const PUBLIC_SUPPORT_EMAIL =
  process.env.NEXT_PUBLIC_SUPPORT_EMAIL?.trim() || SUPPORT_EMAIL;

/** Voice line. Set NEXT_PUBLIC_SUPPORT_PHONE (E.164 or national) to show it. */
export const SUPPORT_PHONE = process.env.NEXT_PUBLIC_SUPPORT_PHONE?.trim() || "";

export function telHref(phone: string): string {
  const trimmed = phone.trim();
  if (!trimmed) return "";
  if (trimmed.startsWith("tel:")) return trimmed;
  const digits = trimmed.replace(/[^\d+]/g, "");
  return digits ? `tel:${digits}` : "";
}

export function mailHref(email: string): string {
  return `mailto:${email.trim()}`;
}
