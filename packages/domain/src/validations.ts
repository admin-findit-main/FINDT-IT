import { z } from "zod";
import {
  BUSINESS_ENTITY_TYPES,
  MAX_DESCRIPTION_LENGTH,
  MAX_PRODUCT_NAME_LENGTH,
  MIN_PRODUCT_NAME_LENGTH,
  PRODUCT_CATEGORIES,
  STORE_CATEGORIES,
} from "./constants";
import { normalizeEin } from "./business";
import { passwordRejectReason } from "./password";
import { sanitizeMultiline, sanitizeText } from "./sanitize";
import { MAX_CUSTOMER_RADIUS_MILES } from "./routing";
import { storeSelectionSuggestsCustomerId } from "./age-restricted";

const nameField = (max: number, message: string) =>
  z
    .string()
    .transform((value) => sanitizeText(value, max))
    .pipe(z.string().min(1, message).max(max));

export const signupSchema = z.object({
  firstName: nameField(60, "First name is required"),
  lastName: z
    .string()
    .optional()
    .or(z.literal(""))
    .transform((value) => sanitizeText(value || "", 60)),
  email: z.string().trim().email("Enter a valid email").transform((value) => value.toLowerCase()),
  password: z.string().min(8, "Password must be at least 8 characters"),
  accountType: z.enum(["customer", "business"]),
  city: z.string().max(80).optional().or(z.literal("")),
  state: z.string().max(2).optional().or(z.literal("")),
  postalCode: z.string().max(10).optional().or(z.literal("")),
}).superRefine((value, ctx) => {
  const reason = passwordRejectReason(value.password, value.email);
  if (reason) {
    ctx.addIssue({ code: "custom", path: ["password"], message: reason });
  }
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const createRequestSchema = z.object({
  productName: z
    .string()
    .transform((value) => sanitizeText(value, MAX_PRODUCT_NAME_LENGTH))
    .pipe(
      z
        .string()
        .min(MIN_PRODUCT_NAME_LENGTH, "Enter a product name")
        .max(MAX_PRODUCT_NAME_LENGTH)
    ),
  description: z
    .string()
    .optional()
    .or(z.literal(""))
    .transform((value) => sanitizeMultiline(value || "", MAX_DESCRIPTION_LENGTH)),
  category: z.enum(PRODUCT_CATEGORIES).optional().or(z.literal("")),
  city: z.string().trim().min(2, "City is required").max(80),
  state: z.string().trim().min(2).max(2).default("VA"),
  postalCode: z
    .string()
    .trim()
    .regex(/^\d{5}(-\d{4})?$/, "Enter a valid ZIP code"),
  radiusMiles: z.coerce.number().int().min(1).max(MAX_CUSTOMER_RADIUS_MILES).default(10),
  expirationHours: z.coerce.number().int().refine((v) => [4, 12, 24, 48].includes(v), {
    message: "Invalid expiration",
  }),
  // Accept https URLs, storage paths, or demo data URLs
  imageUrl: z
    .string()
    .max(6_000_000)
    .optional()
    .or(z.literal(""))
    .nullable(),
  imageStoragePath: z.string().max(500).optional().or(z.literal("")).nullable(),
  forceDuplicate: z.boolean().optional().default(false),
  clientRequestKey: z.string().uuid().optional(),
  latitude: z.coerce.number().min(-90).max(90).optional().nullable(),
  longitude: z.coerce.number().min(-180).max(180).optional().nullable(),
  ageRestrictedConfirmed: z.boolean().optional().default(false),
  categoryConfirmed: z.boolean().optional().default(false),
});

export const inStockResponseSchema = z.object({
  price: z.coerce.number().min(0).max(100000).optional().nullable(),
  quantity: z.coerce.number().int().min(0).max(100000).optional().nullable(),
  note: z.string().max(300).optional().or(z.literal("")),
  holdMinutes: z.coerce.number().int().optional().nullable(),
});

export const canOrderResponseSchema = z.object({
  estimatedAvailabilityLabel: z.string().max(40).optional().or(z.literal("")),
  price: z.coerce.number().min(0).max(100000).optional().nullable(),
  note: z.string().max(300).optional().or(z.literal("")),
});

export const storeOnboardingSchema = z.object({
  name: z.string().min(2).max(100),
  categories: z.array(z.enum(STORE_CATEGORIES)).min(1, "Select at least one category"),
  streetAddress: z.string().min(3).max(200),
  city: z.string().min(2).max(80),
  state: z.string().min(2).max(2),
  postalCode: z.string().regex(/^\d{5}(-\d{4})?$/),
  phone: z.string().max(30).optional().or(z.literal("")),
  website: z.string().url().optional().or(z.literal("")),
  serviceZips: z.array(z.string().regex(/^\d{5}(-\d{4})?$/)).min(1),
  requestCategories: z.array(z.string()).min(1),
  ageRestricted: z.boolean().default(false),
}).superRefine((value, ctx) => {
  if (
    storeSelectionSuggestsCustomerId({
      businessType: value.categories.find((category) =>
        category === "Smoke Shop" || category === "Dispensary"
      ),
      requestCategories: value.requestCategories,
    }) &&
    !value.ageRestricted
  ) {
    ctx.addIssue({
      code: "custom",
      path: ["ageRestricted"],
      message: "Age-restricted stores must confirm customer ID checks.",
    });
  }
});

export const storeJoinApplicationSchema = z.object({
  ownerName: z
    .string()
    .transform((value) => sanitizeText(value, 100))
    .pipe(z.string().min(2, "Your name is required").max(100)),
  ownerEmail: z.string().trim().email("Enter a valid email"),
  ownerPhone: z.string().max(30).optional().or(z.literal("")),
  /** Legal company name as it appears on business papers. Defaults to store name if blank. */
  legalName: z
    .string()
    .max(120)
    .optional()
    .or(z.literal(""))
    .transform((value) => sanitizeText(value || "", 120)),
  /** Optional for now — collected later during review if needed. */
  ein: z
    .string()
    .optional()
    .or(z.literal(""))
    .transform((value) => {
      const digits = normalizeEin(value || "");
      return digits || null;
    })
    .pipe(
      z.union([
        z.null(),
        z.string().regex(/^\d{9}$/, "EIN must be 9 digits if provided"),
      ])
    ),
  entityType: z.enum(BUSINESS_ENTITY_TYPES).optional().default("Other"),
  /** Storefront / DBA name customers see. */
  businessName: z
    .string()
    .min(2, "Store name is required")
    .max(100),
  businessType: z.enum(STORE_CATEGORIES),
  streetAddress: z.string().min(3, "Street address is required").max(200),
  city: z.string().min(2, "City is required").max(80),
  state: z.string().min(2).max(2),
  postalCode: z.string().regex(/^\d{5}(-\d{4})?$/, "Enter a valid ZIP"),
  phone: z.string().min(7, "Business phone is required").max(30),
  website: z
    .string()
    .trim()
    .transform((value) => {
      if (!value) return "";
      if (/^https?:\/\//i.test(value)) return value;
      return `https://${value}`;
    })
    .pipe(z.union([z.literal(""), z.string().url("Enter a valid website")])),
  whyLegit: z
    .string()
    .max(800)
    .optional()
    .or(z.literal(""))
    .transform((value) => {
      const trimmed = (value || "").trim();
      return trimmed.length >= 20
        ? trimmed
        : "Pending FINDIT store review.";
    }),
  requestCategories: z
    .array(z.string().min(1))
    .min(1, "Select a store type so we know what asks to send"),
  requiresCustomerId: z.boolean().default(false),
  confirmedLegitimate: z.boolean().refine((v) => v === true, {
    message: "Confirm this is a real store",
  }),
})
  .transform((value) => ({
    ...value,
    legalName: value.legalName || value.businessName,
  }))
  .superRefine((value, ctx) => {
  if (
    storeSelectionSuggestsCustomerId({
      businessType: value.businessType,
      requestCategories: value.requestCategories,
    }) &&
    !value.requiresCustomerId
  ) {
    ctx.addIssue({
      code: "custom",
      path: ["requiresCustomerId"],
      message: "Age-restricted stores must confirm customer ID checks.",
    });
  }
});

export const inviteEmployeeSchema = z.object({
  email: z.string().email(),
  role: z.enum(["manager", "employee"]),
});

export function normalizeHubPin(value: string): string | null {
  const digits = value.replace(/\D/g, "");
  return /^\d{4}$/.test(digits) ? digits : null;
}

export const shiftEmployeeNameSchema = z
  .string()
  .transform((value) => sanitizeText(value, 80))
  .pipe(z.string().min(1, "Name this person.").max(80));

export const reportSchema = z.object({
  reason: z.string().min(3).max(120),
  description: z.string().max(500).optional().or(z.literal("")),
  requestId: z.string().uuid().optional(),
  storeId: z.string().uuid().optional(),
});

export type CreateRequestInput = z.infer<typeof createRequestSchema>;
export type SignupInput = z.infer<typeof signupSchema>;
export type StoreOnboardingInput = z.infer<typeof storeOnboardingSchema>;
export type StoreJoinApplicationInput = z.infer<typeof storeJoinApplicationSchema>;
