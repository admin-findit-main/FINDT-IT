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
 * Soft plan limits (customer free tier, store free caps).
 * Opt out with FINDIT_BYPASS_PLAN_LIMITS=true OR FINDIT_PILOT_MODE=true.
 */
export function bypassPlanLimits(): boolean {
  const env = getEnv();
  if (env.FINDIT_BYPASS_PLAN_LIMITS === "true") return true;
  if (isPilotMode()) return true;
  return false;
}

/** Closed pilot: relax usage limits, show Beta, no Stripe. */
export function isPilotMode(): boolean {
  return getEnv().FINDIT_PILOT_MODE === "true";
}

export function appUrl(): string {
  return getEnv().NEXT_PUBLIC_APP_URL || "http://localhost:3000";
}
