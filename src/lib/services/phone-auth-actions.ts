"use server";

import { isDemoMode } from "@/lib/config/env";
import { coerceSoloAdminProfile, isSoloAdminEmail } from "@/lib/auth/admin";
import { authEmailErrorMessage } from "@/lib/auth/email-error";
import { resolvePostAuthDestination, type AppHomePath } from "@/lib/auth/home-path";
import { consumeRateLimit } from "@/lib/security/rate-limit";
import {
  authEmailCopy,
  authEmailOtpCode,
  customerNeedsFirstName,
  loginAudienceForAccount,
  mapEmailOtpError,
  mapPhoneOtpError,
  maskEmail,
  maskPhoneE164,
  normalizeEmail,
  normalizePhoneToE164,
  PHONE_OTP_DISABLED_MESSAGE,
  PHONE_OTP_ENABLED,
  renderFinditEmailHtml,
  renderFinditEmailText,
  wrongLoginSideMessage,
  type LoginAudience,
} from "@findit/domain";
import {
  demoCurrentUser,
  demoSendEmailOtp,
  demoSendPhoneOtp,
  demoSetFirstName,
  demoVerifyEmailOtp,
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
  if (!PHONE_OTP_ENABLED) return { error: PHONE_OTP_DISABLED_MESSAGE };
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
  if (!PHONE_OTP_ENABLED) return { error: PHONE_OTP_DISABLED_MESSAGE };
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

function authUserMissing(message: string) {
  const text = message.toLowerCase();
  return (
    text.includes("user not found") ||
    text.includes("unable to find") ||
    text.includes("no user")
  );
}

function alreadyRegistered(message: string) {
  const text = message.toLowerCase();
  return (
    text.includes("already registered") ||
    text.includes("already been registered") ||
    text.includes("user already exists") ||
    text.includes("email address is already")
  );
}

/** Mint a 6-digit Auth OTP and send it with Resend. Skips the Send Email Hook
 * (PKCE magiclink payloads often have no digits, and the hook can 504). */
async function sendAuthEmailOtp(input: {
  admin: ReturnType<typeof import("@/lib/supabase/admin").createServiceClient>;
  email: string;
  createIfMissing: boolean;
  userMetadata?: { account_type: string };
}): Promise<{ error?: string }> {
  let generated = await input.admin.auth.admin.generateLink({
    type: "magiclink",
    email: input.email,
  });
  if (
    generated.error &&
    input.createIfMissing &&
    authUserMissing(generated.error.message)
  ) {
    const created = await input.admin.auth.admin.createUser({
      email: input.email,
      email_confirm: true,
      user_metadata: input.userMetadata,
    });
    if (created.error && !alreadyRegistered(created.error.message)) {
      return { error: mapEmailOtpError(created.error.message, "send") };
    }
    generated = await input.admin.auth.admin.generateLink({
      type: "magiclink",
      email: input.email,
    });
  }
  if (generated.error) {
    return { error: mapEmailOtpError(generated.error.message, "send") };
  }
  const code = authEmailOtpCode(generated.data.properties?.email_otp);
  if (!code) {
    return { error: "Could not create a sign-in code. Try again." };
  }

  const copy = authEmailCopy("email_otp");
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM || "FINDIT <hello@askfindit.com>";
  if (!apiKey) {
    return { error: "Email sending is not configured. Try again later." };
  }

  const sent = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [input.email],
      subject: `${copy.subject}: ${code}`,
      html: renderFinditEmailHtml({
        heading: copy.heading,
        body: copy.body,
        footnote: copy.footnote,
        code,
      }),
      text: renderFinditEmailText({
        heading: copy.heading,
        body: copy.body,
        footnote: copy.footnote,
        code,
      }),
    }),
  });
  if (!sent.ok) {
    const detail = await sent.text();
    return { error: authEmailErrorMessage(detail || "Could not send the code.") };
  }
  return {};
}

export async function sendEmailOtpAction(input: {
  email: string;
  createIfMissing: boolean;
  audience?: LoginAudience;
}): Promise<{
  error?: string;
  code?: "wrong_side";
  requiredAudience?: LoginAudience;
  email?: string;
  masked?: string;
}> {
  const parsed = normalizeEmail(input.email);
  if (!parsed.ok) return { error: parsed.error };
  const audience = input.audience ?? "shopper";
  const createIfMissing = audience === "store" ? false : input.createIfMissing;

  const limited = await consumeRateLimit({
    bucket: "email-otp",
    limit: 8,
    windowMs: 60 * 60_000,
    key: parsed.email,
  });
  if (!limited.ok) return { error: limited.error };

  if (isDemoMode()) {
    const profile = getDemoState().profiles.find(
      (row) => row.email && row.email.toLowerCase() === parsed.email
    );
    if (profile) {
      const belongs = sideForAccount({
        email: profile.email,
        accountType: profile.account_type,
        hasActiveStoreMembership: getDemoState().storeMembers.some(
          (member) => member.user_id === profile.id && member.status === "active"
        ),
      });
      if (audience && belongs !== audience) return wrongSideResult(belongs);
    } else if (!createIfMissing) {
      return { error: "No FINDIT account for this email yet. Sign up to continue." };
    }
    demoSendEmailOtp(parsed.email);
    return { email: parsed.email, masked: maskEmail(parsed.email) };
  }

  try {
    const { createServiceClient } = await import("@/lib/supabase/admin");
    const admin = createServiceClient();
    if (isSoloAdminEmail(parsed.email) && audience !== "store") {
      return wrongSideResult("store");
    }
    const { data: profile } = await admin
      .from("profiles")
      .select("id, email, account_type")
      .eq("email", parsed.email)
      .maybeSingle();
    if (profile) {
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
      if (audience && belongs !== audience) return wrongSideResult(belongs);
    }

    const sent = await sendAuthEmailOtp({
      admin,
      email: parsed.email,
      createIfMissing,
      userMetadata:
        audience === "shopper" ? { account_type: "customer" } : undefined,
    });
    if (sent.error) return { error: sent.error };
    return { email: parsed.email, masked: maskEmail(parsed.email) };
  } catch (e) {
    const message = e instanceof Error ? e.message : "";
    return { error: mapEmailOtpError(message, "send") };
  }
}

export async function verifyEmailOtpAction(input: {
  email: string;
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
  const parsed = normalizeEmail(input.email);
  if (!parsed.ok) return { error: parsed.error };
  const token = input.token.replace(/\D/g, "");
  if (token.length !== 6) return { error: "Enter the 6-digit code." };
  const audience = input.audience ?? "shopper";
  const createIfMissing = audience === "store" ? false : input.createIfMissing;

  if (isDemoMode()) {
    try {
      const result = demoVerifyEmailOtp(
        parsed.email,
        token,
        createIfMissing,
        audience
      );
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
      email: parsed.email,
      token,
      type: "email",
    });
    if (error) return { error: mapEmailOtpError(error.message, "verify") };
    const user = data.user;
    if (!user) return { error: "Could not start your session. Try again." };

    let profile = await waitForProfile(supabase, user.id);
    if (!profile) {
      const { createServiceClient } = await import("@/lib/supabase/admin");
      const admin = createServiceClient();
      const accountType = isSoloAdminEmail(user.email || parsed.email)
        ? "admin"
        : "customer";
      await admin.from("profiles").upsert(
        {
          id: user.id,
          email: user.email || parsed.email,
          first_name: "",
          display_name: accountType === "admin" ? "FINDIT Admin" : "Customer",
          account_type: accountType,
        },
        { onConflict: "id" }
      );
      profile = await waitForProfile(supabase, user.id);
    } else if (!profile.email) {
      const { createServiceClient } = await import("@/lib/supabase/admin");
      const admin = createServiceClient();
      await admin
        .from("profiles")
        .update({ email: user.email || parsed.email })
        .eq("id", user.id);
      profile = { ...profile, email: user.email || parsed.email };
    }

    if (!profile) {
      return { error: "Account created, but profile is missing. Refresh and try again." };
    }

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
    return { error: mapEmailOtpError(message, "verify") };
  }
}

export async function completeCustomerFirstNameAction(
  firstName: string,
  lastName?: string
): Promise<{
  error?: string;
  profile?: Profile;
}> {
  const name = firstName.trim();
  if (!name) return { error: "What's your first name?" };
  if (name.length > 60) return { error: "Use a shorter first name." };
  const last = lastName !== undefined ? lastName.trim() : undefined;
  if (last && last.length > 60) return { error: "Use a shorter last name." };

  if (isDemoMode()) {
    const { cookies } = await import("next/headers");
    const { DEMO_SESSION_COOKIE } = await import("@/lib/demo/store");
    const jar = await cookies();
    const sessionId = jar.get(DEMO_SESSION_COOKIE)?.value || null;
    const profile = demoCurrentUser(sessionId);
    if (!profile) return { error: "Please sign in first." };
    return { profile: demoSetFirstName(profile.id, name) };
  }

  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Please sign in first." };

  const patch: {
    first_name: string;
    display_name: string;
    last_name?: string;
  } = {
    first_name: name,
    display_name: name,
  };
  if (last !== undefined) {
    patch.last_name = last;
    patch.display_name = [name, last].filter(Boolean).join(" ");
  }

  const { data, error } = await supabase
    .from("profiles")
    .update(patch)
    .eq("id", user.id)
    .select("*")
    .single();
  if (error) return { error: error.message };
  return { profile: coerceSoloAdminProfile(data as Profile, user.email) as Profile };
}
