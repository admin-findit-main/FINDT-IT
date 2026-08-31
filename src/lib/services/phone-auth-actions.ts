"use server";

import { isDemoMode } from "@/lib/config/env";
import { coerceSoloAdminProfile, isSoloAdminEmail } from "@/lib/auth/admin";
import { resolvePostAuthDestination, type AppHomePath } from "@/lib/auth/home-path";
import { consumeRateLimit } from "@/lib/security/rate-limit";
import {
  customerNeedsFirstName,
  loginAudienceForAccount,
  mapPhoneOtpError,
  maskPhoneE164,
  normalizePhoneToE164,
  wrongLoginSideMessage,
  type LoginAudience,
} from "@findit/domain";
import {
  demoCurrentUser,
  demoSendPhoneOtp,
  demoSetFirstName,
  demoVerifyPhoneOtp,
  getDemoState,
} from "@/lib/demo/store";
import type { Profile } from "@/types/database";

async function setDemoSessionCookie(sessionId: string | null) {
  const { cookies } = await import("next/headers");
  const jar = await cookies();
  const { DEMO_SESSION_COOKIE } = await import("@/lib/demo/store");
  if (!sessionId) {
    jar.delete(DEMO_SESSION_COOKIE);
    return;
  }
  jar.set(DEMO_SESSION_COOKIE, sessionId, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}

async function waitForProfile(
  supabase: Awaited<ReturnType<typeof import("@/lib/supabase/server").createClient>>,
  userId: string
): Promise<Profile | null> {
  for (let i = 0; i < 10; i++) {
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .maybeSingle();
    if (data) return data as Profile;
    await new Promise((r) => setTimeout(r, 200));
  }
  return null;
}

function sideForAccount(input: {
  email?: string | null;
  accountType?: string | null;
  hasActiveStoreMembership: boolean;
}): LoginAudience {
  return loginAudienceForAccount({
    isAdmin: isSoloAdminEmail(input.email) || input.accountType === "admin",
    accountType: input.accountType,
    hasActiveStoreMembership: input.hasActiveStoreMembership,
  });
}

function wrongSideResult(belongs: LoginAudience) {
  return {
    error: wrongLoginSideMessage(belongs),
    code: "wrong_side" as const,
    requiredAudience: belongs,
  };
}

export async function sendPhoneOtpAction(input: {
  phone: string;
  createIfMissing: boolean;
  audience?: LoginAudience;
}): Promise<{
  error?: string;
  code?: "wrong_side";
  requiredAudience?: LoginAudience;
  phone?: string;
  masked?: string;
}> {
  const parsed = normalizePhoneToE164(input.phone);
  if (!parsed.ok) return { error: parsed.error };
  const audience = input.audience ?? "shopper";
  const createIfMissing = audience === "store" ? false : input.createIfMissing;

  const limited = await consumeRateLimit({
    bucket: "phone-otp",
    limit: 8,
    windowMs: 60 * 60_000,
    key: parsed.e164,
  });
  if (!limited.ok) return { error: limited.error };

  if (isDemoMode()) {
    if (audience === "store") {
      const profile = getDemoState().profiles.find((row) => row.phone_e164 === parsed.e164);
      if (!profile) {
        return { error: "No store account for this number. Use email or apply." };
      }
      const belongs = sideForAccount({
        email: profile.email,
        accountType: profile.account_type,
        hasActiveStoreMembership: getDemoState().storeMembers.some(
          (member) => member.user_id === profile.id && member.status === "active"
        ),
      });
      if (belongs !== "store") return wrongSideResult(belongs);
    }
    demoSendPhoneOtp(parsed.e164);
    return { phone: parsed.e164, masked: maskPhoneE164(parsed.e164) };
  }

  try {
    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();
    const { error } = await supabase.auth.signInWithOtp({
      phone: parsed.e164,
      options: {
        shouldCreateUser: createIfMissing,
        channel: "sms",
        data: audience === "shopper" ? { account_type: "customer" } : undefined,
      },
    });
    if (!error) {
      return { phone: parsed.e164, masked: maskPhoneE164(parsed.e164) };
    }

    const mapped = mapPhoneOtpError(error.message, "send");
    const missingUser =
      error.message.toLowerCase().includes("signups not allowed") ||
      error.message.toLowerCase().includes("user not found");

    if (audience === "store" && missingUser) {
      const { createServiceClient } = await import("@/lib/supabase/admin");
      const admin = createServiceClient();
      const { data: profile } = await admin
        .from("profiles")
        .select("id, email, account_type")
        .eq("phone_e164", parsed.e164)
        .maybeSingle();
      if (!profile) {
        return { error: "No store account for this number. Use email or apply." };
      }
      const { count } = await admin
        .from("store_members")
        .select("*", { count: "exact", head: true })
        .eq("user_id", profile.id)
        .eq("status", "active");
      const belongs = sideForAccount({
        email: profile.email,
        accountType: profile.account_type,
        hasActiveStoreMembership: (count || 0) > 0,
      });
      if (belongs !== "store") return wrongSideResult(belongs);
      const { error: linkError } = await admin.auth.admin.updateUserById(profile.id, {
        phone: parsed.e164,
      });
      if (linkError) return { error: mapPhoneOtpError(linkError.message, "send") };
      const retry = await supabase.auth.signInWithOtp({
        phone: parsed.e164,
        options: { shouldCreateUser: false, channel: "sms" },
      });
      if (retry.error) return { error: mapPhoneOtpError(retry.error.message, "send") };
      return { phone: parsed.e164, masked: maskPhoneE164(parsed.e164) };
    }

    return { error: mapped };
  } catch (e) {
    const message = e instanceof Error ? e.message : "";
    return { error: mapPhoneOtpError(message, "send") };
  }
}

export async function verifyPhoneOtpAction(input: {
  phone: string;
  token: string;
  createIfMissing: boolean;
  audience?: LoginAudience;
}): Promise<{
  error?: string;
  code?: "wrong_side";
  requiredAudience?: LoginAudience;
  needsName?: boolean;
  homePath?: AppHomePath;
}> {
  const parsed = normalizePhoneToE164(input.phone);
  if (!parsed.ok) return { error: parsed.error };
  const token = input.token.replace(/\D/g, "");
  if (token.length !== 6) return { error: "Enter the 6-digit code." };
  const audience = input.audience ?? "shopper";
  const createIfMissing = audience === "store" ? false : input.createIfMissing;

  if (isDemoMode()) {
    try {
      const result = demoVerifyPhoneOtp(parsed.e164, token, createIfMissing, audience);
      await setDemoSessionCookie(result.sessionId);
      const stores = getDemoState().storeMembers.filter(
        (m) => m.user_id === result.profile.id && m.status === "active"
      );
      return {
        needsName: result.needsName,
        homePath: resolvePostAuthDestination({
          profile: result.profile,
          authEmail: result.profile.email,
          hasActiveStoreMembership: stores.length > 0,
          needsName: result.needsName,
        }) as AppHomePath,
      };
    } catch (e) {
      const message = e instanceof Error ? e.message : "That code didn't work. Try again.";
      if (message.includes("Store sign in")) return wrongSideResult("store");
      if (message.includes("Shopper sign in")) return wrongSideResult("shopper");
      return { error: message };
    }
  }

  try {
    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();
    const { data, error } = await supabase.auth.verifyOtp({
      phone: parsed.e164,
      token,
      type: "sms",
    });
    if (error) return { error: mapPhoneOtpError(error.message, "verify") };
    const user = data.user;
    if (!user) return { error: "Could not start your session. Try again." };

    let profile = await waitForProfile(supabase, user.id);
    if (!profile) {
      const { createServiceClient } = await import("@/lib/supabase/admin");
      const admin = createServiceClient();
      const phone = parsed.e164;
      const accountType = isSoloAdminEmail(user.email) ? "admin" : "customer";
      await admin.from("profiles").upsert(
        {
          id: user.id,
          email: user.email || null,
          phone_e164: phone,
          first_name: "",
          display_name: accountType === "admin" ? "FINDIT Admin" : "Customer",
          account_type: accountType,
        },
        { onConflict: "id" }
      );
      profile = await waitForProfile(supabase, user.id);
    } else if (!profile.phone_e164) {
      const { createServiceClient } = await import("@/lib/supabase/admin");
      const admin = createServiceClient();
      await admin.from("profiles").update({ phone_e164: parsed.e164 }).eq("id", user.id);
      profile = { ...profile, phone_e164: parsed.e164 };
    }

    if (!profile) return { error: "Account created, but profile is missing. Refresh and try again." };

    const coerced = coerceSoloAdminProfile(profile, user.email) as Profile;
    if (coerced.is_suspended) {
      await supabase.auth.signOut();
      return { error: "This account is suspended." };
    }
    const { count } = await supabase
      .from("store_members")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("status", "active");
    const belongs = sideForAccount({
      email: user.email || coerced.email,
      accountType: coerced.account_type,
      hasActiveStoreMembership: (count || 0) > 0,
    });
    if (audience && belongs !== audience) {
      await supabase.auth.signOut();
      return wrongSideResult(belongs);
    }

    return {
      needsName: customerNeedsFirstName(coerced),
      homePath: resolvePostAuthDestination({
        profile: coerced,
        authEmail: user.email,
        hasActiveStoreMembership: (count || 0) > 0,
        needsName: customerNeedsFirstName(coerced),
      }) as AppHomePath,
    };
  } catch (e) {
    const message = e instanceof Error ? e.message : "";
    return { error: mapPhoneOtpError(message, "verify") };
  }
}

export async function completeCustomerFirstNameAction(firstName: string): Promise<{
  error?: string;
  profile?: Profile;
}> {
  const name = firstName.trim();
  if (!name) return { error: "What's your first name?" };
  if (name.length > 60) return { error: "Use a shorter first name." };

  if (isDemoMode()) {
    const { cookies } = await import("next/headers");
    const { DEMO_SESSION_COOKIE } = await import("@/lib/demo/store");
    const jar = await cookies();
    const sessionId = jar.get(DEMO_SESSION_COOKIE)?.value || null;
    const profile = demoCurrentUser(sessionId);
    if (!profile) return { error: "Please verify your phone first." };
    return { profile: demoSetFirstName(profile.id, name) };
  }

  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Please verify your phone first." };

  const { data, error } = await supabase
    .from("profiles")
    .update({ first_name: name, display_name: name })
    .eq("id", user.id)
    .select("*")
    .single();
  if (error) return { error: error.message };
  return { profile: coerceSoloAdminProfile(data as Profile, user.email) as Profile };
}
