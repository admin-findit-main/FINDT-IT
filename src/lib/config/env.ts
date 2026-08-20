import { z } from "zod";

const envSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url().optional().or(z.literal("")),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().optional().or(z.literal("")),
  /** Newer Supabase dashboard "publishable" key — optional alias for anon */
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().optional().or(z.literal("")),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional().or(z.literal("")),
  NEXT_PUBLIC_APP_URL: z.string().url().optional().or(z.literal("")),
  RESEND_API_KEY: z.string().optional().or(z.literal("")),
  STRIPE_SECRET_KEY: z.string().optional().or(z.literal("")),
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: z.string().optional().or(z.literal("")),
  STRIPE_WEBHOOK_SECRET: z.string().optional().or(z.literal("")),
  FINDIT_DEMO_MODE: z.string().optional().or(z.literal("")),
  FINDIT_BYPASS_PLAN_LIMITS: z.string().optional().or(z.literal("")),
  FINDIT_PILOT_MODE: z.string().optional().or(z.literal("")),
  /**
   * Optional dedicated hosts on the SAME Vercel Next.js app. Leave empty.
   * When set (e.g. business.findit.app), middleware sends `/` to that shell.
   * Do not add DNS until you are ready — unset means no host routing.
   */
  FINDIT_BUSINESS_HOST: z.string().optional().or(z.literal("")),
  FINDIT_HUB_HOST: z.string().optional().or(z.literal("")),
  FINDIT_ADMIN_HOST: z.string().optional().or(z.literal("")),
  /** Public App Store listing URL when it exists. Empty = coming soon. */
  NEXT_PUBLIC_IOS_APP_STORE_URL: z.string().optional().or(z.literal("")),
  NEXT_PUBLIC_PLAY_STORE_URL: z.string().optional().or(z.literal("")),
});

export type AppEnv = z.infer<typeof envSchema>;

export function getEnv(): AppEnv {
  return envSchema.parse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    RESEND_API_KEY: process.env.RESEND_API_KEY,
    STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
    NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
    STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET,
    FINDIT_DEMO_MODE: process.env.FINDIT_DEMO_MODE,
    FINDIT_BYPASS_PLAN_LIMITS: process.env.FINDIT_BYPASS_PLAN_LIMITS,
    FINDIT_PILOT_MODE: process.env.FINDIT_PILOT_MODE,
    FINDIT_BUSINESS_HOST: process.env.FINDIT_BUSINESS_HOST,
    FINDIT_HUB_HOST: process.env.FINDIT_HUB_HOST,
    FINDIT_ADMIN_HOST: process.env.FINDIT_ADMIN_HOST,
    NEXT_PUBLIC_IOS_APP_STORE_URL: process.env.NEXT_PUBLIC_IOS_APP_STORE_URL,
    NEXT_PUBLIC_PLAY_STORE_URL: process.env.NEXT_PUBLIC_PLAY_STORE_URL,
  });
}

/** Client/server public key: prefer classic anon JWT, fall back to publishable key. */
export function getSupabasePublishableKey(): string | undefined {
  const env = getEnv();
  return env.NEXT_PUBLIC_SUPABASE_ANON_KEY || env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || undefined;
}

export function isSupabaseConfigured(): boolean {
  const env = getEnv();
  return Boolean(env.NEXT_PUBLIC_SUPABASE_URL && getSupabasePublishableKey());
}

export function isDemoMode(): boolean {
  // Explicit opt-in only (Vitest / local offline). Never auto-enable for missing keys.
  return getEnv().FINDIT_DEMO_MODE === "true";
}

/**
 * Store free-tier routing caps (not consumer Finds).
 * Pilot still relaxes store caps. Consumer Finds use bypassConsumerPlanLimits().
 */
export function bypassPlanLimits(): boolean {
  const env = getEnv();
  if (env.FINDIT_BYPASS_PLAN_LIMITS === "true") return true;
  if (isPilotMode()) return true;
  return false;
}

/** Consumer monthly Finds. Pilot mode does NOT skip this. */
export function bypassConsumerPlanLimits(): boolean {
  return getEnv().FINDIT_BYPASS_PLAN_LIMITS === "true";
}

/** Closed pilot: relax usage limits, show Beta, no Stripe. */
export function isPilotMode(): boolean {
  return getEnv().FINDIT_PILOT_MODE === "true";
}

export function appUrl(): string {
  return getEnv().NEXT_PUBLIC_APP_URL || "http://localhost:3000";
}

/** Dedicated Business/Hub/Admin hostnames. Empty until DNS is ready. */
export function dedicatedHosts() {
  const env = getEnv();
  return {
    business: env.FINDIT_BUSINESS_HOST || "",
    hub: env.FINDIT_HUB_HOST || "",
    admin: env.FINDIT_ADMIN_HOST || "",
  };
}

export function iosAppStoreUrl(): string {
  return getEnv().NEXT_PUBLIC_IOS_APP_STORE_URL || "";
}

export function playStoreUrl(): string {
  return getEnv().NEXT_PUBLIC_PLAY_STORE_URL || "";
}
