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
  latitude: z.coerce.number().optional().nullable(),
  longitude: z.coerce.number().optional().nullable(),
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
});

export const storeJoinApplicationSchema = z.object({
  ownerName: z
    .string()
    .transform((value) => sanitizeText(value, 100))
    .pipe(z.string().min(2).max(100)),
  ownerEmail: z.string().trim().email(),
  ownerPhone: z.string().max(30).optional().or(z.literal("")),
  password: z.string().min(8, "Password must be at least 8 characters"),
  confirmPassword: z.string().min(8, "Confirm your password"),
  legalName: z.string().min(2, "Legal business name is required").max(120),
  ein: z
    .string()
    .transform((value) => normalizeEin(value))
    .pipe(z.string().regex(/^\d{9}$/, "Enter a 9-digit EIN")),
  entityType: z.enum(BUSINESS_ENTITY_TYPES),
  businessName: z.string().min(2).max(100),
  businessType: z.enum(STORE_CATEGORIES),
  streetAddress: z.string().min(3).max(200),
  city: z.string().min(2).max(80),
  state: z.string().min(2).max(2),
  postalCode: z.string().regex(/^\d{5}(-\d{4})?$/),
  phone: z.string().min(7).max(30),
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
    .min(20, "Tell us a bit about your business (at least 20 characters)")
    .max(800),
  requestCategories: z
    .array(z.string().min(1))
    .min(1, "Select at least one product category you want to receive"),
  requiresCustomerId: z.boolean(),
  confirmedLegitimate: z.boolean().refine((v) => v === true, {
    message: "Confirm you are a legitimate business",
  }),
}).superRefine((value, ctx) => {
  if (value.password !== value.confirmPassword) {
    ctx.addIssue({
      code: "custom",
      path: ["confirmPassword"],
      message: "Passwords do not match",
    });
  }
  const reason = passwordRejectReason(value.password, value.ownerEmail);
  if (reason) {
    ctx.addIssue({ code: "custom", path: ["password"], message: reason });
  }
});

export const inviteEmployeeSchema = z.object({
  email: z.string().email(),
  role: z.enum(["manager", "employee"]),
});

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
