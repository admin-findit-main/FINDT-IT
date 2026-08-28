import { BUSINESS_ENTITY_TYPES } from "./constants";

export type BusinessEntityType = (typeof BUSINESS_ENTITY_TYPES)[number];

export function normalizeEin(value: string): string {
  return String(value || "").replace(/\D/g, "").slice(0, 9);
}

export function formatEin(value: string): string {
  const digits = normalizeEin(value);
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)}-${digits.slice(2)}`;
}

export function isValidEin(value: string): boolean {
  return /^\d{9}$/.test(normalizeEin(value));
}
