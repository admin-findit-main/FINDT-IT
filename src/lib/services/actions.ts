"use server";

import { cache } from "react";
import { after } from "next/server";
import { isDemoMode, isSupabaseConfigured } from "@/lib/config/env";
import { coerceSoloAdminProfile, isSoloAdmin, isSoloAdminEmail } from "@/lib/auth/admin";
import { authEmailErrorMessage } from "@/lib/auth/email-error";
import { resolvePostAuthDestination, type AppHomePath } from "@/lib/auth/home-path";
import {
  canManageFromRole,
  type StoreWorkspace,
} from "@/lib/auth/store-role";
import {
  demoApproveStoreApplication,
  demoCountCustomerRequestsThisMonth,
  demoCreateRequest,
  demoCreateStore,
  demoCurrentUser,
  demoDeleteAccount,
  demoFulfillRequest,
  demoGetPendingApplicationForEmail,
  demoGetPilotAdminStats,
  demoGetStoreDemand,
  demoGetStoreMetrics,
  demoListStoreApplications,
  demoLoginWithSession,
  demoLogout,
  demoMarkTargetOpened,
  demoRejectStoreApplication,
  demoRequestMoreInfoApplication,
  demoRespondToRequest,
  demoRouteRequestToStores,
  demoSignupWithSession,
  demoStillLooking,
  demoExpandRequestRadius,
  demoSubmitStoreApplication,
  demoUpdateStoreSettings,
  getDemoState,
  DEMO_SESSION_COOKIE,
} from "@/lib/demo/store";
import { createRequestSchema, storeJoinApplicationSchema, storeOnboardingSchema } from "@/lib/validations";
import { normalizeProductName } from "@/lib/utils";
import { notifyCustomerDevices, notifyEmployeeDevices } from "@/lib/services/expo-push";
import {
  authEmailCopy,
  customerReplyAlertCopy,
  customerReplyPushCopy,
  renderFinditEmailHtml,
  renderFinditEmailText,
  shouldNotifyCustomerOfReply,
} from "@findit/domain";
import type {
  CustomerRequest,
  DemandItem,
  Notification,
  PilotAdminStats,
  Profile,
  Store,
  StoreApplication,
  StoreDevice,
  StoreMemberRole,
  StoreMetrics,
  StoreResponse,
} from "@/types/database";
import { CUSTOMER_PLANS, STORE_PLANS } from "@/lib/config/constants";
import { bypassConsumerPlanLimits, bypassPlanLimits, isPilotMode } from "@/lib/config/env";
import {
  accountContactLabel,
  AGE_RESTRICTED_ID_REQUIRED,
  accountDeletionBlockReason,
  getConsumerEntitlements,
  isAccountDeletionConfirmed,
  isAgeRestrictedFind,
  classifyRequest,
  isMonthlyFindCapError,
  monthlyFindWindowStart,
  planLimitReachedMessage,
  radiusExceedsPlan,
  radiusLimitMessage,
  MAX_CUSTOMER_RADIUS_MILES,
  RADIUS_OPTIONS,
  normalizeStoreLocation,
  boundUuid,
  boundSlug,
  signupSchema,
  reportSchema,
  loginAudienceForAccount,
  wrongLoginSideMessage,
  type LoginAudience,
} from "@findit/domain";
import { consumeRateLimit } from "@/lib/security/rate-limit";
import { measurePerf } from "@/lib/perf";
import {
  generateJoinEmailCode,
  hashJoinEmailCode,
  JOIN_EMAIL_CODE_MAX_ATTEMPTS,
  JOIN_EMAIL_CODE_TTL_MS,
  joinEmailCodesMatch,
  normalizeJoinEmailCode,
} from "@/lib/security/join-email-code";
import { toPublicError } from "@/lib/security/public-error";
import { selectEligibleStores } from "@/lib/services/routing";
import { resolvePoint, resolvePointsByZip } from "@/lib/services/zip-centroids";
import {
  canRebroadcastStillLooking,
  deriveRequestStatus,
  isNearDuplicateRequest,
  responseTimeSeconds,
  average,
  median,
} from "@/lib/services/request-lifecycle";
import { isStoreOpenAt } from "@/lib/services/store-hours";
import { trackEvent } from "@/lib/services/analytics";
import { getHubDeviceSession } from "@/lib/hub/session";
import { notifySupportInbox } from "@/lib/services/support-inbox";

async function getDemoSessionId(): Promise<string | null> {
  try {
    const { cookies } = await import("next/headers");
    const jar = await cookies();
    return jar.get(DEMO_SESSION_COOKIE)?.value || getDemoState().currentSessionId;
  } catch {
    return getDemoState().currentSessionId;
  }
}

async function setDemoSessionCookie(sessionId: string | null) {
  const { cookies } = await import("next/headers");
  const jar = await cookies();
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

const getSupabaseUser = cache(async () => {
  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
});

export const getCurrentProfile = cache(async (): Promise<Profile | null> => {
  return measurePerf("auth-profile", async () => {
  if (isDemoMode()) {
    const sessionId = await getDemoSessionId();
    const profile = demoCurrentUser(sessionId);
    if (!profile) return null;
    return coerceSoloAdminProfile(profile, profile.email) as Profile;
  }
  if (!isSupabaseConfigured()) return null;
  const { supabase, user } = await getSupabaseUser();
  if (!user) return null;
  const { data } = await supabase.from("profiles").select("*").eq("id", user.id).single();
  const profile = data as Profile | null;
  if (!profile) return null;
  const resolved = coerceSoloAdminProfile(profile, user.email) as Profile;
  if (resolved.is_suspended && !isSoloAdmin(resolved)) return null;
  if (
    resolved.account_type === "customer" &&
    resolved.subscription_plan !== "plus"
  ) {
    try {
      const { data: sub } = await supabase
        .from("customer_subscriptions")
        .select("plan_id, status")
        .eq("profile_id", resolved.id)
        .maybeSingle();
      if (
        sub?.plan_id === "plus" &&
        (sub.status === "active" || sub.status === "trialing")
      ) {
        return { ...resolved, subscription_plan: "plus" };
      }
    } catch {
      // Billing table may be absent in older local DBs.
    }
  }
  return resolved;
  });
});

type StoreActor =
  | { kind: "member"; userId: string; role: string; storeId: string }
  | {
      kind: "device";
      userId: string;
      deviceId: string;
      storeId: string;
      deviceName: string;
    };

async function getStoreActor(storeId: string): Promise<StoreActor | null> {
  const id = boundUuid(storeId);
  if (!id) return null;
  const profile = await getCurrentProfile();
  if (profile) {
    if (isSoloAdmin(profile)) {
      return { kind: "member", userId: profile.id, role: "owner", storeId: id };
    }
    if (isDemoMode()) {
      const member = getDemoState().storeMembers.find(
        (m) => m.store_id === id && m.user_id === profile.id && m.status === "active"
      );
      if (member) {
        return { kind: "member", userId: profile.id, role: member.role, storeId: id };
      }
    } else {
      const { supabase, user } = await getSupabaseUser();
      if (user) {
        const { data: membership } = await supabase
          .from("store_members")
          .select("role")
          .eq("store_id", id)
          .eq("user_id", user.id)
          .eq("status", "active")
          .maybeSingle();
        if (membership) {
          return { kind: "member", userId: user.id, role: membership.role, storeId: id };
        }
      }
    }
    // Shopper (or other) session on the same device must not hide a paired Hub.
  }

  const device = await getHubDeviceSession();
  if (device) {
    if (device.store_id !== id) return null;
    return {
      kind: "device",
      userId: device.paired_by || device.store.owner_id,
      deviceId: device.id,
      storeId: device.store_id,
      deviceName: device.device_name,
    };
  }
  return null;
}

function loginSideForAccount(input: {
  email: string;
  accountType?: string | null;
  hasActiveStoreMembership: boolean;
}): LoginAudience {
  return loginAudienceForAccount({
    isAdmin: isSoloAdminEmail(input.email) || input.accountType === "admin",
    accountType: input.accountType,
    hasActiveStoreMembership: input.hasActiveStoreMembership,
  });
}

function wrongLoginSideResult(belongs: LoginAudience) {
  return {
    error: wrongLoginSideMessage(belongs),
    code: "wrong_side" as const,
    requiredAudience: belongs,
  };
}

function demoHasActiveStoreMembership(userId: string): boolean {
  return getDemoState().storeMembers.some(
    (member) => member.user_id === userId && member.status === "active"
  );
}

export async function signInAction(
  email: string,
  password: string,
  audience?: LoginAudience
) {
  const normalized = email.trim().toLowerCase();
  const limited = await consumeRateLimit({
    bucket: "login",
    limit: 30,
    windowMs: 15 * 60_000,
    key: normalized,
  });
  if (!limited.ok) return { error: limited.error };
  if (isDemoMode()) {
    const result = demoLoginWithSession(normalized, password);
    if (!result) return { error: "Invalid email or password" };
    const hasActiveStoreMembership = demoHasActiveStoreMembership(result.profile.id);
    const belongs = loginSideForAccount({
      email: normalized,
      accountType: result.profile.account_type,
      hasActiveStoreMembership,
    });
    if (audience && belongs !== audience) {
      demoLogout(result.sessionId);
      return wrongLoginSideResult(belongs);
    }
    await setDemoSessionCookie(result.sessionId);
    const homePath = resolvePostAuthDestination({
      profile: result.profile,
      authEmail: result.profile.email || normalized,
      hasActiveStoreMembership,
    }) as AppHomePath;
    return { profile: result.profile, homePath };
  }
  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email: normalized,
    password,
  });
  if (error) return { error: "Invalid email or password" };
  const user = data.user;
  const { data: row } = user
    ? await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle()
    : { data: null };
  const profile = row
    ? (coerceSoloAdminProfile(row as Profile, user?.email || normalized) as Profile)
    : null;
  if (isSoloAdminEmail(normalized) || isSoloAdmin(profile) || isSoloAdminEmail(user?.email)) {
    if (audience && audience !== "store") {
      await supabase.auth.signOut();
      return wrongLoginSideResult("store");
    }
    return { profile, homePath: "/admin" as AppHomePath };
  }
  if (!profile) return { error: "Profile not found" };
  if (profile.is_suspended) {
    await supabase.auth.signOut();
    return { error: "This account is suspended." };
  }
  const { data: membership } = user
    ? await supabase
        .from("store_members")
        .select("id")
        .eq("user_id", user.id)
        .eq("status", "active")
        .limit(1)
        .maybeSingle()
    : { data: null };
  const hasActiveStoreMembership = Boolean(membership);
  const belongs = loginSideForAccount({
    email: normalized,
    accountType: profile.account_type,
    hasActiveStoreMembership,
  });
  if (audience && belongs !== audience) {
    await supabase.auth.signOut();
    return wrongLoginSideResult(belongs);
  }
  const homePath = resolvePostAuthDestination({
    profile,
    authEmail: profile.email || normalized,
    hasActiveStoreMembership,
  }) as AppHomePath;
  return { profile, homePath };
}

const MAGIC_LINK_REDIRECT = "https://www.askfindit.com/auth/callback";

export async function sendMagicLinkAction(
  emailRaw: string,
  audience?: LoginAudience
) {
  const email = emailRaw.trim().toLowerCase();
  if (!email || !email.includes("@")) {
    return { error: "Enter a valid email." };
  }
  const limited = await consumeRateLimit({
    bucket: "magic-link",
    limit: 5,
    windowMs: 60 * 60_000,
    key: email,
  });
  if (!limited.ok) return { error: limited.error };
  if (isDemoMode()) {
    if (audience) {
      const profile = getDemoState().profiles.find(
        (row) => row.email && row.email.toLowerCase() === email
      );
      if (profile) {
        const belongs = loginSideForAccount({
          email,
          accountType: profile.account_type,
          hasActiveStoreMembership: demoHasActiveStoreMembership(profile.id),
        });
        if (belongs !== audience) return wrongLoginSideResult(belongs);
      }
    }
    return {
      ok: true as const,
      message: "Demo mode does not send email. Use the password on this screen.",
    };
  }

  try {
    const { createServiceClient } = await import("@/lib/supabase/admin");
    const admin = createServiceClient();
    if (audience) {
      if (isSoloAdminEmail(email) && audience !== "store") {
        return wrongLoginSideResult("store");
      }
      const { data: profile } = await admin
        .from("profiles")
        .select("id, account_type, email")
        .eq("email", email)
        .maybeSingle();
      if (profile) {
        const { data: membership } = await admin
          .from("store_members")
          .select("id")
          .eq("user_id", profile.id)
          .eq("status", "active")
          .limit(1)
          .maybeSingle();
        const belongs = loginSideForAccount({
          email,
          accountType: profile.account_type,
          hasActiveStoreMembership: Boolean(membership),
        });
        if (belongs !== audience) return wrongLoginSideResult(belongs);
      }
    }
    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();
    const { error: sendError } = await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: false,
        emailRedirectTo: MAGIC_LINK_REDIRECT,
      },
    });
    if (sendError) {
      const text = (sendError.message || "").toLowerCase();
      if (
        text.includes("user not found") ||
        text.includes("unable to find") ||
        text.includes("no user") ||
        text.includes("signups not allowed")
      ) {
        return {
          error:
            "We couldn’t send a link for that email. Try a password, or create an account.",
          code: "no_account" as const,
        };
      }
      return { error: authEmailErrorMessage(sendError.message) };
    }
    return {
      ok: true as const,
      message: "Check your email for a FINDIT sign-in link. It expires in about an hour.",
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.toLowerCase().includes("service role")) {
      return { error: "Magic link is not configured. Use your password." };
    }
    return { error: authEmailErrorMessage(message) };
  }
}

export async function getAppWorkspaceAction(): Promise<{
  homePath: AppHomePath;
  accountType: Profile["account_type"] | null;
  isAdmin: boolean;
  hasStore: boolean;
  label: string;
} | null> {
  const profile = await getCurrentProfile();
  if (!profile) return null;
  const stores = await getUserStoresAction();
  const hasStore = stores.length > 0;
  const homePath = resolvePostAuthDestination({
    profile,
    authEmail: profile.email,
    hasActiveStoreMembership: hasStore,
  }) as AppHomePath;
  return {
    homePath,
    accountType: profile.account_type,
    isAdmin: isSoloAdmin(profile),
    hasStore: hasStore || profile.account_type === "business",
    label:
      isSoloAdmin(profile)
        ? "Admin"
        : hasStore || profile.account_type === "business"
          ? "Store"
          : "Customer",
  };
}

export async function getStoreWorkspaceAction(): Promise<StoreWorkspace | null> {
  const profile = await getCurrentProfile();
  if (!profile) return null;
  const stores = await getUserStoresAction();
  const first = stores[0] || null;

  if (first) {
    const role = (first.role as StoreMemberRole) || "employee";
    return {
      store: { ...first, role },
      role,
      canManageStore: canManageFromRole(role),
      canInvite: canManageFromRole(role),
      isAdminViewer: isSoloAdmin(profile),
    };
  }

  if (isSoloAdmin(profile)) {
    return {
      store: null,
      role: "owner",
      canManageStore: true,
      canInvite: true,
      isAdminViewer: true,
    };
  }

  return null;
}

async function canViewOwnerAnalytics(storeId: string): Promise<boolean> {
  const profile = await getCurrentProfile();
  if (!profile) return false;
  if (isSoloAdmin(profile)) return true;
  if (isDemoMode()) {
    const member = getDemoState().storeMembers.find(
      (m) => m.store_id === storeId && m.user_id === profile.id && m.status === "active"
    );
    return Boolean(member && canManageFromRole(member.role));
  }
  const { supabase, user } = await getSupabaseUser();
  if (!user) return false;
  const { data: membership } = await supabase
    .from("store_members")
    .select("role")
    .eq("store_id", storeId)
    .eq("user_id", user.id)
    .eq("status", "active")
    .maybeSingle();
  return Boolean(membership && canManageFromRole(membership.role));
}

export async function getInviteByTokenAction(token: string) {
  if (!token) return { error: "Invalid invite" };

  if (isDemoMode()) {
    const state = getDemoState();
    const invite = state.invites.find((i) => i.token === token);
    if (!invite) return { error: "Invite not found" };
    if (invite.accepted_at) return { error: "Invite already used" };
    if (new Date(invite.expires_at) < new Date()) return { error: "Invite expired" };
    const store = state.stores.find((s) => s.id === invite.store_id);
    return {
      invite: {
        email: invite.email,
        role: invite.role as StoreMemberRole,
        expires_at: invite.expires_at,
        store_name: store?.name || "Store",
        store_id: invite.store_id,
      },
    };
  }

  const { createServiceClient } = await import("@/lib/supabase/admin");
  const admin = createServiceClient();
  const { data, error } = await admin
    .from("store_invites")
    .select("email, role, expires_at, accepted_at, store_id, store:stores(name)")
    .eq("token", token)
    .maybeSingle();
  if (error || !data) return { error: "Invite not found" };
  if (data.accepted_at) return { error: "Invite already used" };
  if (new Date(data.expires_at) < new Date()) return { error: "Invite expired" };
  const storeRow = Array.isArray(data.store) ? data.store[0] : data.store;
  return {
    invite: {
      email: data.email as string,
      role: data.role as StoreMemberRole,
      expires_at: data.expires_at as string,
      store_name: (storeRow as { name?: string } | null)?.name || "Store",
      store_id: data.store_id as string,
    },
  };
}

export async function acceptStoreInviteAction(token: string) {
  const profile = await getCurrentProfile();
  if (!profile) return { error: "Please sign in to accept this invite" };

  if (isDemoMode()) {
    const state = getDemoState();
    const invite = state.invites.find((i) => i.token === token);
    if (!invite) return { error: "Invite not found" };
    if (invite.accepted_at) return { error: "Invite already used" };
    if (new Date(invite.expires_at) < new Date()) return { error: "Invite expired" };
    if (!profile.email) {
      return {
        error: `Sign in as ${invite.email} to accept this invite`,
      };
    }
    if (profile.email.toLowerCase() !== invite.email.toLowerCase()) {
      return {
        error: `Sign in as ${invite.email} to accept this invite`,
      };
    }
    const existing = state.storeMembers.find(
      (m) => m.store_id === invite.store_id && m.user_id === profile.id
    );
    if (!existing) {
      state.storeMembers.push({
        id: crypto.randomUUID(),
        store_id: invite.store_id,
        user_id: profile.id,
        role: invite.role as StoreMemberRole,
        status: "active",
        created_at: new Date().toISOString(),
      });
    } else {
      existing.status = "active";
      existing.role = invite.role as StoreMemberRole;
    }
    invite.accepted_at = new Date().toISOString();
    const p = state.profiles.find((x) => x.id === profile.id);
    if (p && p.account_type === "customer") p.account_type = "business";
    if (p && !p.first_name && invite.invitee_name) p.first_name = invite.invitee_name;
    return { ok: true as const };
  }

  const { createServiceClient } = await import("@/lib/supabase/admin");
  const admin = createServiceClient();
  const { data: invite, error } = await admin
    .from("store_invites")
    .select("*")
    .eq("token", token)
    .maybeSingle();
  if (error || !invite) return { error: "Invite not found" };
  if (invite.accepted_at) return { error: "Invite already used" };
  if (new Date(invite.expires_at) < new Date()) return { error: "Invite expired" };
  if (!profile.email) {
    return { error: `Sign in as ${invite.email} to accept this invite` };
  }
  if (profile.email.toLowerCase() !== String(invite.email).toLowerCase()) {
    return { error: `Sign in as ${invite.email} to accept this invite` };
  }

  const { error: memberErr } = await admin.from("store_members").upsert(
    {
      store_id: invite.store_id,
      user_id: profile.id,
      role: invite.role,
      status: "active",
    },
    { onConflict: "store_id,user_id" }
  );
  if (memberErr) return { error: memberErr.message };

  await admin
    .from("store_invites")
    .update({ accepted_at: new Date().toISOString() })
    .eq("id", invite.id);

  if (profile.account_type === "customer") {
    await admin.from("profiles").update({ account_type: "business" }).eq("id", profile.id);
  }
  if (!profile.first_name && invite.invitee_name) {
    await admin
      .from("profiles")
      .update({ first_name: invite.invitee_name })
      .eq("id", profile.id);
  }

  return { ok: true as const };
}

function alreadyHasAccount(message: string): boolean {
  const text = message.toLowerCase();
  return (
    text.includes("already registered") ||
    text.includes("already been registered") ||
    text.includes("user already exists") ||
    text.includes("email address is already")
  );
}

const EXISTING_ACCOUNT_HOME =
  "That email already has an account. Go back to askfindit.com.";

async function signInCreatedUser(email: string, password: string) {
  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: error.message };
  let profile = await getCurrentProfile();
  if (!profile) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      for (let i = 0; i < 10; i++) {
        const { data } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", user.id)
          .maybeSingle();
        if (data) {
          profile = coerceSoloAdminProfile(data as Profile, email) as Profile;
          break;
        }
        await new Promise((r) => setTimeout(r, 200));
      }
    }
  }
  const homePath = resolvePostAuthDestination({
    profile,
    authEmail: email,
  }) as AppHomePath;
  return { ok: true as const, homePath };
}

export async function signUpAction(input: {
  email: string;
  password: string;
  firstName: string;
  lastName?: string;
  /** Public signup is customer-only. Businesses apply via /join. */
  accountType?: "customer" | "business";
  city?: string;
  state?: string;
  postalCode?: string;
}) {
  const parsed = signupSchema.safeParse({
    firstName: input.firstName,
    lastName: input.lastName || "",
    email: input.email,
    password: input.password,
    accountType: "customer",
    city: input.city || "",
    state: input.state || "",
    postalCode: input.postalCode || "",
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message || "Check your details and try again." };
  }
  const limited = await consumeRateLimit({
    bucket: "signup",
    limit: 5,
    windowMs: 60 * 60_000,
    key: parsed.data.email,
  });
  if (!limited.ok) return { error: limited.error };
  const accountType = "customer";
  const email = parsed.data.email;
  if (isDemoMode()) {
    try {
      const result = demoSignupWithSession({
        ...input,
        firstName: parsed.data.firstName,
        lastName: parsed.data.lastName,
        email,
        password: parsed.data.password,
        accountType,
      });
      await setDemoSessionCookie(result.sessionId);
      return { ok: true as const, homePath: "/home" as const };
    } catch (e) {
      const message = e instanceof Error ? e.message : "Sign up failed";
      if (message.toLowerCase().includes("already has an account")) {
        return { error: EXISTING_ACCOUNT_HOME, code: "existing_account" as const };
      }
      return { error: toPublicError(e, "Sign up failed. Try again.") };
    }
  }
  try {
    const { createServiceClient } = await import("@/lib/supabase/admin");
    const admin = createServiceClient();
    const { error } = await admin.auth.admin.createUser({
      email,
      password: parsed.data.password,
      email_confirm: true,
      user_metadata: {
        first_name: parsed.data.firstName,
        last_name: parsed.data.lastName || "",
        display_name: parsed.data.firstName,
        account_type: accountType,
        default_city: parsed.data.city,
        default_state: parsed.data.state || "VA",
        default_postal_code: parsed.data.postalCode,
      },
    });
    if (error) {
      if (alreadyHasAccount(error.message)) {
        return { error: EXISTING_ACCOUNT_HOME, code: "existing_account" as const };
      }
      return { error: authEmailErrorMessage(error.message) };
    }
    return signInCreatedUser(email, input.password);
  } catch (e) {
    const message = e instanceof Error ? e.message : "";
    if (message.toLowerCase().includes("service role")) {
      return {
        error: "Account setup is missing a server key. Ask FINDIT to finish configuring signup.",
      };
    }
    return {
      error: message || "Sign up failed. Try again in a moment.",
    };
  }
}

export async function signOutAction() {
  if (isDemoMode()) {
    const sessionId = await getDemoSessionId();
    demoLogout(sessionId);
    await setDemoSessionCookie(null);
    return;
  }
  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();
  await supabase.auth.signOut({ scope: "global" });
}

export async function switchDemoUserAction(_email: string) {
  return { error: "Demo switching is disabled" };
}

export async function createCustomerRequestAction(raw: unknown) {
  const parsed = createRequestSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message || "Invalid request" };
  }
  if (
    isAgeRestrictedFind({
      category: parsed.data.category,
      productName: parsed.data.productName,
      description: parsed.data.description,
    }) &&
    !parsed.data.ageRestrictedConfirmed
  ) {
    return { error: AGE_RESTRICTED_ID_REQUIRED, code: "age_restricted" as const };
  }
  const classified = classifyRequest({
    productName: parsed.data.productName,
    description: parsed.data.description,
    category: parsed.data.category,
    confirmed: Boolean(parsed.data.categoryConfirmed || parsed.data.category),
  });
  if (
    classified.status === "needs_confirm" &&
    !parsed.data.categoryConfirmed &&
    !parsed.data.category
  ) {
    return {
      error: "Confirm the category so we send this to the right stores.",
      code: "category_confirm" as const,
      classification: classified,
    };
  }
  const resolvedCategory =
    classified.productCategory || parsed.data.category || null;
  const profile = await getCurrentProfile();
  if (!profile) return { error: "Please sign in to submit a request", needsAuth: true };
  const findLimit = await consumeRateLimit({
    bucket: "create-request",
    limit: 20,
    windowMs: 60 * 60_000,
    key: profile.id,
  });
  if (!findLimit.ok) return { error: findLimit.error };
  if (isSoloAdmin(profile)) {
    return { error: "Operator accounts use Admin, not customer Finds." };
  }

  if (isDemoMode()) {
    const result = demoCreateRequest({
      customerId: profile.id,
      productName: parsed.data.productName,
      description: parsed.data.description,
      category: resolvedCategory || undefined,
      city: parsed.data.city,
      state: parsed.data.state,
      postalCode: parsed.data.postalCode,
      radiusMiles: parsed.data.radiusMiles,
      expirationHours: parsed.data.expirationHours,
      imageUrl: parsed.data.imageUrl,
      imageStoragePath: parsed.data.imageStoragePath,
      forceDuplicate: parsed.data.forceDuplicate,
      latitude: parsed.data.latitude,
      longitude: parsed.data.longitude,
      ageRestrictedConfirmed: parsed.data.ageRestrictedConfirmed,
    });
    if (result.duplicateOf) {
      return {
        error: result.blocked || "You already have an active request for this.",
        duplicateOf: result.duplicateOf,
        request: result.request,
      };
    }
    if (result.blocked) {
      const entitlements = getConsumerEntitlements(profile.subscription_plan);
      return {
        error: result.blocked,
        code: result.blocked.includes("miles") ? "radius_limit" : "plan_limit",
        upgradeRequired:
          entitlements.planId === "free" &&
          /Finds this month/i.test(result.blocked),
      };
    }
    return {
      request: result.request,
      storesTargeted: result.storesTargeted,
      noStores: result.storesTargeted === 0,
    };
  }

  return measurePerf("create-request", async () => {
  const { supabase, user } = await getSupabaseUser();
  if (!user) return { error: "Please sign in", needsAuth: true };

  const clientKey = parsed.data.clientRequestKey || null;
  if (clientKey) {
    const { data: existingByKey } = await supabase
      .from("customer_requests")
      .select("id, product_name, city, state, postal_code, image_url, created_at, expires_at, stores_targeted, status")
      .eq("customer_id", user.id)
      .eq("client_request_key", clientKey)
      .maybeSingle();
    if (existingByKey) {
      return {
        request: existingByKey as CustomerRequest,
        storesTargeted: existingByKey.stores_targeted || 0,
        noStores: (existingByKey.stores_targeted || 0) === 0,
      };
    }
  }

  const hourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const monthStart = monthlyFindWindowStart().toISOString();
  const checkMonthly = !bypassConsumerPlanLimits();
  const [recentResult, existingActive, monthlyResult, point] = await Promise.all([
    supabase
      .from("customer_requests")
      .select("*", { count: "exact", head: true })
      .eq("customer_id", user.id)
      .gte("created_at", hourAgo)
      .in("status", ["active", "partially_answered", "answered", "draft"]),
    parsed.data.forceDuplicate
      ? Promise.resolve({ data: [] as { id: string; normalized_product_name: string; category: string | null; status: string; created_at: string }[] })
      : supabase
          .from("customer_requests")
          .select("id, normalized_product_name, category, status, created_at")
          .eq("customer_id", user.id)
          .in("status", ["active", "partially_answered", "answered"])
          .order("created_at", { ascending: false })
          .limit(20),
    checkMonthly
      ? supabase
          .from("customer_requests")
          .select("*", { count: "exact", head: true })
          .eq("customer_id", user.id)
          .gte("created_at", monthStart)
      : Promise.resolve({ count: 0 }),
    resolvePoint({
      postalCode: parsed.data.postalCode,
      latitude: parsed.data.latitude,
      longitude: parsed.data.longitude,
    }),
  ]);

  if ((recentResult.count || 0) >= 10) {
    return { error: "You can create up to 10 requests per hour." };
  }

  if (!parsed.data.forceDuplicate) {
    const dup = isNearDuplicateRequest({
      normalizedProductName: normalizeProductName(parsed.data.productName),
      category: resolvedCategory,
      existing: existingActive.data || [],
    });
    if (dup.duplicate && dup.existingId) {
      return {
        error: "You already have an active request for this.",
        duplicateOf: dup.existingId,
      };
    }
  }

  if (checkMonthly) {
    const entitlements = getConsumerEntitlements(profile.subscription_plan);
    if ((monthlyResult.count || 0) >= entitlements.monthlyRequestLimit) {
      return {
        error: planLimitReachedMessage(entitlements),
        code: "plan_limit" as const,
        upgradeRequired: entitlements.planId === "free",
      };
    }
    if (radiusExceedsPlan(parsed.data.radiusMiles, entitlements.maxSearchRadiusMiles)) {
      return {
        error: radiusLimitMessage(entitlements),
        code: "radius_limit" as const,
        upgradeRequired: entitlements.planId === "free",
      };
    }
  }

  // Reject raw base64 in production — require Storage URL/path
  const imageUrl = parsed.data.imageUrl || null;
  if (imageUrl && imageUrl.startsWith("data:")) {
    return {
      error: "Please upload the photo again (image storage required).",
    };
  }

  const expiresAt = new Date(
    Date.now() + parsed.data.expirationHours * 60 * 60 * 1000
  ).toISOString();

  // Service role insert after auth checks — avoids brittle INSERT RLS during pilot
  const { createServiceClient } = await import("@/lib/supabase/admin");
  const admin = createServiceClient();
  const { data: request, error } = await admin
    .from("customer_requests")
    .insert({
      customer_id: user.id,
      product_name: parsed.data.productName.trim(),
      normalized_product_name: normalizeProductName(parsed.data.productName),
      description: parsed.data.description || null,
      category: resolvedCategory,
      city: parsed.data.city,
      state: parsed.data.state,
      postal_code: parsed.data.postalCode,
      radius_miles: parsed.data.radiusMiles,
      status: "active",
      expires_at: expiresAt,
      image_url: imageUrl,
      image_storage_path: parsed.data.imageStoragePath || null,
      latitude: point.latitude,
      longitude: point.longitude,
      detected_business_type: classified.businessTypeId,
      detected_category: classified.categoryId,
      detected_subcategory: classified.subcategoryId,
      routing_confidence: classified.confidence,
      classification_status: classified.status,
      classification_reason: classified.reason,
      category_confirmed: Boolean(
        parsed.data.categoryConfirmed || parsed.data.category || classified.status === "confident"
      ),
      client_request_key: clientKey,
    })
    .select(
      "id, product_name, city, state, postal_code, image_url, created_at, expires_at, stores_targeted, status, customer_id"
    )
    .single();

  if (error || !request) {
    if (isMonthlyFindCapError(error?.message)) {
      const entitlements = getConsumerEntitlements(profile.subscription_plan);
      return {
        error: planLimitReachedMessage(entitlements),
        code: "plan_limit" as const,
        upgradeRequired: entitlements.planId === "free",
      };
    }
    return { error: "Couldn't create your request. Please try again." };
  }

  void trackEvent("request_created", {
    userId: user.id,
    requestId: request.id,
  });

  after(() =>
    routeRequestToStoresAction(request.id).catch((err) => {
      console.error("[FINDIT] Route after create failed", err);
    })
  );

  return {
    request: request as CustomerRequest,
    storesTargeted: 0,
    noStores: false,
    routing: true as const,
  };
  });
}

async function notifyStoresOfNewRequest(input: {
  admin: Awaited<ReturnType<typeof import("@/lib/supabase/admin")["createServiceClient"]>>;
  requestId: string;
  productName: string;
  storeIds: string[];
}) {
  const { admin, requestId, productName, storeIds } = input;
  if (!storeIds.length) return;

  const { data: members } = await admin
    .from("store_members")
    .select("user_id, store_id")
    .in("store_id", storeIds)
    .eq("status", "active");

  const notifications = (members || [])
    .filter((m) => m.user_id)
    .map((m) => ({
      user_id: m.user_id!,
      type: "new_request",
      title: "New product request",
      body: `New request nearby: ${productName}`,
      related_request_id: requestId,
      related_store_id: m.store_id,
    }));
  if (notifications.length) {
    await admin.from("notifications").insert(notifications);
  }
  const staffIds = [
    ...new Set(notifications.map((n) => n.user_id).filter(Boolean)),
  ];
  if (!staffIds.length) return;

  // Device push is extra — don't hold the Find on Expo/Web Push round-trips.
  void notifyEmployeeDevices({
    admin,
    userIds: staffIds,
    title: "New product request",
    body: `New request nearby: ${productName}`,
    data: {
      type: "new_request",
      requestId,
      url: `/store/requests/${requestId}`,
    },
  }).catch((err) => {
    console.error("[FINDIT] Store push failed", err);
  });
}

export async function routeRequestToStoresAction(requestId: string): Promise<number> {
  if (isDemoMode()) return demoRouteRequestToStores(requestId);

  const { createServiceClient } = await import("@/lib/supabase/admin");
  const admin = createServiceClient();

  const { data: request } = await admin
    .from("customer_requests")
    .select("*")
    .eq("id", requestId)
    .single();
  if (!request) return 0;

  let storeQuery = admin
    .from("stores")
    .select("id, is_active, is_suspended, is_verified, postal_code, city, service_radius_miles, subscription_plan, business_type, accepting_requests, latitude, longitude")
    .eq("is_active", true)
    .eq("is_suspended", false)
    .eq("accepting_requests", true);
  const reqLat = Number(request.latitude);
  const reqLng = Number(request.longitude);
  if (Number.isFinite(reqLat) && Number.isFinite(reqLng)) {
    const pad = (Number(request.radius_miles) + 12) / 69;
    storeQuery = storeQuery.or(
      `and(latitude.gte.${reqLat - pad},latitude.lte.${reqLat + pad},longitude.gte.${reqLng - pad},longitude.lte.${reqLng + pad}),latitude.is.null`
    );
  }
  const { data: stores } = await storeQuery;

  if (!stores?.length) return 0;

  const storeIds = stores.map((s) => s.id);
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const haveRequestPoint = Number.isFinite(reqLat) && Number.isFinite(reqLng);
  const missingZipStores = stores.filter(
    (store) => store.latitude == null || store.longitude == null
  );
  const [
    { data: cats },
    { data: areas },
    { data: hours },
    { data: existingTargets },
    { data: catalogCats },
    { data: catalogKeys },
    { data: customKeys },
    { data: monthTargets },
    requestPoint,
    storeZipPoints,
  ] = await Promise.all([
    admin.from("store_categories").select("store_id, category").in("store_id", storeIds),
    admin.from("store_service_areas").select("store_id, postal_code").in("store_id", storeIds),
    admin
      .from("store_hours")
      .select("store_id, day_of_week, open_time, close_time, is_closed")
      .in("store_id", storeIds),
    admin.from("request_targets").select("store_id").eq("request_id", requestId),
    admin.from("store_catalog_categories").select("store_id, category_id").in("store_id", storeIds),
    admin.from("store_catalog_keywords").select("store_id, keyword_id").in("store_id", storeIds),
    admin.from("store_custom_keywords").select("store_id, normalized_keyword").in("store_id", storeIds),
    admin
      .from("request_targets")
      .select("store_id")
      .in("store_id", storeIds)
      .gte("created_at", monthStart.toISOString()),
    haveRequestPoint
      ? Promise.resolve({ latitude: reqLat, longitude: reqLng })
      : resolvePoint({
          postalCode: request.postal_code,
          latitude: request.latitude,
          longitude: request.longitude,
        }),
    missingZipStores.length
      ? resolvePointsByZip(missingZipStores.map((store) => store.postal_code))
      : Promise.resolve(new Map()),
  ]);

  const monthCounts = new Map<string, number>();
  for (const t of monthTargets || []) {
    monthCounts.set(t.store_id, (monthCounts.get(t.store_id) || 0) + 1);
  }

  const candidates = stores.map((store) => {
    const fromZip = storeZipPoints.get(
      String(store.postal_code || "").replace(/\D/g, "").slice(0, 5)
    );
    return {
      id: store.id,
      is_active: store.is_active,
      is_suspended: store.is_suspended,
      is_verified: store.is_verified,
      postal_code: store.postal_code,
      city: store.city,
      service_radius_miles: store.service_radius_miles ?? 10,
      subscription_plan: store.subscription_plan,
      businessTypeId: store.business_type || null,
      acceptingRequests: store.accepting_requests !== false,
      categories: (cats || [])
        .filter((c) => c.store_id === store.id)
        .map((c) => c.category),
      catalogCategoryIds: (catalogCats || [])
        .filter((c) => c.store_id === store.id)
        .map((c) => c.category_id),
      catalogKeywordIds: (catalogKeys || [])
        .filter((c) => c.store_id === store.id)
        .map((c) => c.keyword_id),
      customKeywords: (customKeys || [])
        .filter((c) => c.store_id === store.id)
        .map((c) => c.normalized_keyword),
      service_zips: (areas || [])
        .filter((a) => a.store_id === store.id)
        .map((a) => a.postal_code),
      month_targets_received: monthCounts.get(store.id) || 0,
      free_plan_monthly_cap: STORE_PLANS.free.monthlyRequests,
      latitude: store.latitude ?? fromZip?.latitude ?? null,
      longitude: store.longitude ?? fromZip?.longitude ?? null,
    };
  });

  const { eligible } = selectEligibleStores({
    request: {
      id: request.id,
      postal_code: request.postal_code,
      city: request.city,
      category: request.category,
      radius_miles: request.radius_miles,
      productName: request.product_name,
      description: request.description,
      categoryConfirmed: Boolean(request.category_confirmed || request.category),
      latitude: requestPoint.latitude,
      longitude: requestPoint.longitude,
    },
    stores: candidates,
    alreadyTargetedStoreIds: (existingTargets || []).map((t) => t.store_id),
    bypassPlanCaps: bypassPlanLimits(),
  });

  const nowIso = new Date().toISOString();
  const rows = eligible.map((d) => {
    const storeHours = (hours || []).filter((h) => h.store_id === d.storeId);
    const openInfo = isStoreOpenAt(storeHours);
    return {
      request_id: requestId,
      store_id: d.storeId,
      delivery_status: "sent",
      route_sent_at: nowIso,
      was_closed_at_route: !openInfo.open,
      routing_reason: d.routingReason || null,
      match_kind: d.matchKind || null,
      relevant: null,
      notify_after:
        !openInfo.open && openInfo.reopenAt ? openInfo.reopenAt.toISOString() : null,
    };
  });

  if (rows.length) {
    await admin.from("request_targets").upsert(rows, { onConflict: "request_id,store_id" });

    const notifyStoreIds = rows
      .filter((r) => !r.notify_after || new Date(r.notify_after).getTime() <= Date.now())
      .map((r) => r.store_id);

    if (notifyStoreIds.length) {
      void notifyStoresOfNewRequest({
        admin,
        requestId,
        productName: request.product_name,
        storeIds: notifyStoreIds,
      }).catch((err) => {
        console.error("[FINDIT] Store notify failed", err);
      });
    }
  }

  const { count } = await admin
    .from("request_targets")
    .select("*", { count: "exact", head: true })
    .eq("request_id", requestId);

  await admin
    .from("customer_requests")
    .update({ stores_targeted: count || rows.length })
    .eq("id", requestId);

  await trackEvent("request_routed", {
    requestId,
    metadata: { stores: count || rows.length },
  });

  return count || rows.length;
}

export async function getCustomerRequestAction(requestId: string) {
  const id = boundUuid(requestId);
  if (!id) return null;
  if (isDemoMode()) {
    const state = getDemoState();
    const sessionId = await getDemoSessionId();
    const profile = demoCurrentUser(sessionId);
    const request = state.requests.find((r) => r.id === id);
    if (!request) return null;
    if (profile?.account_type !== "admin" && request.customer_id !== profile?.id) {
      return null;
    }
    const responses = state.responses
      .filter((r) => r.request_id === requestId)
      .map((r) => ({
        ...r,
        store: state.stores.find((s) => s.id === r.store_id),
      }));
    return { ...request, responses, targets_count: request.stores_targeted };
  }

  const { supabase, user } = await getSupabaseUser();
  if (!user) return null;
  const [{ data: request }, { data: responses }] = await Promise.all([
    supabase
      .from("customer_requests")
      .select("*")
      .eq("id", id)
      .eq("customer_id", user.id)
      .maybeSingle(),
    supabase
      .from("store_responses")
      .select("*, store:stores(*)")
      .eq("request_id", id),
  ]);
  if (!request) return null;
  return {
    ...(request as CustomerRequest),
    responses: (responses || []) as (StoreResponse & { store?: Store })[],
    targets_count: (request as CustomerRequest).stores_targeted,
  };
}

export async function getCustomerRequestsAction(tab: "active" | "past" | "saved" = "active") {
  const profile = await getCurrentProfile();
  if (!profile) return [];

  if (isDemoMode()) {
    const state = getDemoState();
    if (tab === "saved") {
      const ids = state.savedRequests
        .filter((s) => s.customer_id === profile.id)
        .map((s) => s.request_id);
      return state.requests.filter((r) => ids.includes(r.id));
    }
    const mine = state.requests.filter((r) => r.customer_id === profile.id);
    if (tab === "active") {
      return mine.filter((r) =>
        ["active", "partially_answered", "answered", "draft"].includes(r.status) &&
        new Date(r.expires_at).getTime() > Date.now() &&
        r.status !== "cancelled"
      );
    }
    return mine.filter(
      (r) =>
        ["expired", "cancelled", "fulfilled"].includes(r.status) ||
        new Date(r.expires_at).getTime() <= Date.now()
    );
  }

  const { supabase, user } = await getSupabaseUser();
  if (!user) return [];
  if (tab === "saved") {
    const { data } = await supabase
      .from("saved_requests")
      .select("request:customer_requests(*)")
      .eq("customer_id", user.id);
    return (data || [])
      .map((d: { request?: CustomerRequest | CustomerRequest[] | null }) => d.request)
      .flat()
      .filter(Boolean) as CustomerRequest[];
  }
  let query = supabase.from("customer_requests").select("*").eq("customer_id", user.id);
  if (tab === "active") {
    query = query.in("status", ["active", "partially_answered", "answered", "draft"]);
  } else {
    query = query.in("status", ["expired", "cancelled", "fulfilled"]);
  }
  const { data } = await query.order("created_at", { ascending: false }).limit(40);
  return (data || []) as CustomerRequest[];
}

export async function cancelRequestAction(requestId: string) {
  const id = boundUuid(requestId);
  if (!id) return { error: "Not found" };
  const profile = await getCurrentProfile();
  if (!profile) return { error: "Unauthorized" };

  if (isDemoMode()) {
    const state = getDemoState();
    const request = state.requests.find(
      (r) => r.id === id && r.customer_id === profile.id
    );
    if (!request) return { error: "Not found" };
    request.status = "cancelled";
    request.updated_at = new Date().toISOString();
    return { ok: true };
  }

  const { supabase, user } = await getSupabaseUser();
  if (!user) return { error: "Unauthorized" };
  const { error } = await supabase
    .from("customer_requests")
    .update({ status: "cancelled" })
    .eq("id", id)
    .eq("customer_id", user.id);
  if (error) return { error: error.message };
  return { ok: true };
}

export async function respondToRequestAction(input: {
  requestId: string;
  storeId: string;
  responseType: "in_stock" | "out_of_stock" | "can_order" | "not_relevant";
  price?: number | null;
  quantity?: number | null;
  note?: string;
  holdMinutes?: number | null;
  estimatedAvailabilityLabel?: string;
  availabilityAmount?: "plenty" | "few_left" | "last_one" | null;
  trackDemand?: boolean;
}) {
  const actor = await getStoreActor(input.storeId);
  if (!actor) return { error: "Unauthorized" };

  if (isDemoMode()) {
    try {
      const response = demoRespondToRequest({
        ...input,
        userId: actor.userId,
      });
      return { response };
    } catch (e) {
      return { error: e instanceof Error ? e.message : "Failed" };
    }
  }

  const { createServiceClient } = await import("@/lib/supabase/admin");
  const admin = createServiceClient();

  const [{ data: target }, { data: requestRow }, { data: existing }] = await Promise.all([
    admin
      .from("request_targets")
      .select("*")
      .eq("request_id", input.requestId)
      .eq("store_id", input.storeId)
      .maybeSingle(),
    admin
      .from("customer_requests")
      .select("id, status, expires_at, customer_id, product_name, stores_targeted")
      .eq("id", input.requestId)
      .single(),
    admin
      .from("store_responses")
      .select("id")
      .eq("request_id", input.requestId)
      .eq("store_id", input.storeId)
      .maybeSingle(),
  ]);
  if (!target) return { error: "Request was not sent to this store" };
  if (!requestRow) return { error: "Request not found" };
  if (requestRow.status === "cancelled" || requestRow.status === "fulfilled") {
    return { error: "This request is no longer accepting responses" };
  }
  if (
    requestRow.status === "expired" ||
    new Date(requestRow.expires_at).getTime() < Date.now()
  ) {
    return { error: "This request has expired" };
  }

  const respondedAt = new Date().toISOString();
  const payload = {
    request_id: input.requestId,
    store_id: input.storeId,
    responded_by: actor.userId,
    response_type: input.responseType,
    price: input.price ?? null,
    quantity: input.quantity ?? null,
    note: input.note || null,
    hold_minutes: input.holdMinutes ?? null,
    estimated_availability_label: input.estimatedAvailabilityLabel || null,
    availability_amount: input.availabilityAmount ?? null,
    track_demand: input.trackDemand ?? false,
    updated_at: respondedAt,
  };

  const { data, error } = await admin
    .from("store_responses")
    .upsert(payload, { onConflict: "request_id,store_id" })
    .select("*")
    .single();

  if (error) {
    if (error.code === "23505") {
      const { data: row } = await admin
        .from("store_responses")
        .select("*")
        .eq("request_id", input.requestId)
        .eq("store_id", input.storeId)
        .maybeSingle();
      if (row) return { response: row as StoreResponse };
    }
    return { error: "Couldn't save your response. Please try again." };
  }

  const secs = responseTimeSeconds(target.route_sent_at || target.created_at, respondedAt);
  const notifyCustomer =
    input.responseType === "in_stock" || input.responseType === "can_order";
  const [, countResult, storeResult, customerResult] = await Promise.all([
    admin
      .from("request_targets")
      .update({
        responded_at: respondedAt,
        response_time_seconds: secs,
        opened_at: target.opened_at || respondedAt,
        viewed_at: target.viewed_at || respondedAt,
        relevant: input.responseType === "not_relevant" ? false : true,
      })
      .eq("id", target.id),
    admin
      .from("store_responses")
      .select("*", { count: "exact", head: true })
      .eq("request_id", input.requestId),
    notifyCustomer
      ? admin.from("stores").select("name").eq("id", input.storeId).single()
      : Promise.resolve({ data: null as { name?: string } | null }),
    notifyCustomer
      ? admin
          .from("profiles")
          .select("notify_in_stock, notify_can_order")
          .eq("id", requestRow.customer_id)
          .maybeSingle()
      : Promise.resolve({
          data: null as { notify_in_stock?: boolean; notify_can_order?: boolean } | null,
        }),
  ]);

  const status = deriveRequestStatus({
    responseCount: countResult.count || 0,
    targetCount: requestRow.stores_targeted || 0,
  });
  await admin.from("customer_requests").update({ status }).eq("id", input.requestId);

  if (notifyCustomer) {
    const store = storeResult.data;
    const customer = customerResult.data;
    const copy = customerReplyAlertCopy({
      responseType: input.responseType,
      storeName: store?.name,
      productName: requestRow.product_name,
    });
    const wantsAlert = shouldNotifyCustomerOfReply(input.responseType, customer || {});
    if (copy && wantsAlert) {
      const push = customerReplyPushCopy({
        responseType: input.responseType,
        productName: requestRow.product_name,
        storeName: store?.name,
      });
      void (async () => {
        await admin.from("notifications").insert({
          user_id: requestRow.customer_id,
          type: input.responseType,
          title: copy.title,
          body: copy.body,
          related_request_id: input.requestId,
          related_store_id: input.storeId,
        });
        if (push) {
          await notifyCustomerDevices({
            admin,
            customerId: requestRow.customer_id,
            title: push.title,
            body: push.body,
            data: {
              type: input.responseType,
              requestId: input.requestId,
              storeId: input.storeId,
              url: `/requests/${input.requestId}`,
            },
          });
        }
      })().catch((err) => {
        console.error("[FINDIT] customer reply notify failed", err);
      });
    }
  }

  void trackEvent("store_response_created", {
    userId: actor.userId,
    storeId: input.storeId,
    requestId: input.requestId,
    metadata: { responseType: input.responseType, responseTimeSeconds: secs },
  });

  return { response: data as StoreResponse };
}

export async function getStoreIncomingRequestsAction(
  storeId: string,
  filter: string = "all",
  range: string = "today"
) {
  return measurePerf("load-store-inbox", async () => {
  const id = boundUuid(storeId);
  if (!id) return [];
  const actor = await getStoreActor(id);
  if (!actor) return [];

  if (isDemoMode()) {
    const state = getDemoState();
    const member = state.storeMembers.find(
      (m) => m.store_id === storeId && m.user_id === actor.userId && m.status === "active"
    );
    if (!member && actor.kind !== "device") return [];

    const start = new Date();
    if (range === "today") start.setHours(0, 0, 0, 0);
    else if (range === "7d") start.setDate(start.getDate() - 7);
    else start.setDate(start.getDate() - 30);

    const targets = state.targets.filter(
      (t) => t.store_id === id && new Date(t.created_at) >= start
    );

    return targets
      .map((t) => {
        const request = state.requests.find((r) => r.id === t.request_id);
        const response = state.responses.find(
          (r) => r.request_id === t.request_id && r.store_id === id
        );
        return request ? { ...request, target: t, response: response || null } : null;
      })
      .filter(Boolean)
      .filter((item) => {
        if (!item) return false;
        if (filter === "unanswered") return !item.response;
        if (filter === "in_stock") return item.response?.response_type === "in_stock";
        if (filter === "out_of_stock") return item.response?.response_type === "out_of_stock";
        if (filter === "can_order") return item.response?.response_type === "can_order";
        if (filter === "expired")
          return (
            item.status === "expired" || new Date(item.expires_at).getTime() < Date.now()
          );
        return true;
      })
      .sort(
        (a, b) =>
          new Date(b!.created_at).getTime() - new Date(a!.created_at).getTime()
      ) as (CustomerRequest & {
      target: { id: string };
      response: StoreResponse | null;
    })[];
  }

  // Always read with the service role after getStoreActor checks membership
  // or the Hub device cookie. The user client can return a cached empty inbox.
  const { createServiceClient } = await import("@/lib/supabase/admin");
  const supabase = createServiceClient();
  const start = new Date();
  if (range === "today") start.setHours(0, 0, 0, 0);
  else if (range === "7d") start.setDate(start.getDate() - 7);
  else start.setDate(start.getDate() - 30);

  // request_targets has no FK to store_responses, so PostgREST cannot embed
  // both in one select (PGRST200). Load replies in a second query.
  let inboxQuery = supabase
    .from("request_targets")
    .select("*, request:customer_requests(*)")
    .eq("store_id", id)
    .gte("created_at", start.toISOString())
    .order("created_at", { ascending: false })
    .limit(100);
  if (filter === "unanswered") {
    inboxQuery = inboxQuery.is("responded_at", null);
  }
  const { data, error } = await inboxQuery;

  if (error) {
    console.error("[FINDIT] store inbox query failed", error.message);
    return [];
  }

  const rows = data || [];
  const requestIds = rows
    .map((row: { request?: CustomerRequest | CustomerRequest[] | null }) => {
      const request = Array.isArray(row.request) ? row.request[0] : row.request;
      return request?.id;
    })
    .filter((id): id is string => Boolean(id));

  const { data: responses } =
    requestIds.length && filter !== "unanswered"
      ? await supabase
          .from("store_responses")
          .select("*")
          .eq("store_id", id)
          .in("request_id", requestIds)
      : { data: [] as StoreResponse[] };

  const responseByRequest = new Map(
    (responses || []).map((response) => [response.request_id, response as StoreResponse])
  );

  return rows
    .map((row: { id: string; request?: CustomerRequest | CustomerRequest[] | null }) => {
      const request = Array.isArray(row.request) ? row.request[0] : row.request;
      if (!request) return null;
      return {
        ...request,
        target: { id: row.id },
        response: responseByRequest.get(request.id) || null,
      };
    })
    .filter(Boolean)
    .filter((item) => {
      if (!item) return false;
      if (filter === "unanswered") return !item.response;
      if (filter === "in_stock") return item.response?.response_type === "in_stock";
      if (filter === "out_of_stock") return item.response?.response_type === "out_of_stock";
      if (filter === "can_order") return item.response?.response_type === "can_order";
      if (filter === "expired")
        return (
          item.status === "expired" || new Date(item.expires_at).getTime() < Date.now()
        );
      return true;
    }) as (CustomerRequest & {
    target: { id: string };
    response: StoreResponse | null;
  })[];
  });
}

export const getUserStoresAction = cache(async (): Promise<(Store & { role: string })[]> => {
  const profile = await getCurrentProfile();
  if (!profile) return [];

  if (isDemoMode()) {
    const state = getDemoState();
    return state.storeMembers
      .filter((m) => m.user_id === profile.id && m.status === "active")
      .map((m) => {
        const store = state.stores.find((s) => s.id === m.store_id)!;
        return { ...store, role: m.role };
      })
      .filter((s) => s.id);
  }

  const { supabase, user } = await getSupabaseUser();
  if (!user) return [];
  const { data } = await supabase
    .from("store_members")
    .select("role, store:stores(*)")
    .eq("user_id", user.id)
    .eq("status", "active");
  return (data || [])
    .filter((d: { store?: Store | Store[] | null; role: string }) => Boolean(d.store))
    .map((d: { store?: Store | Store[] | null; role: string }) => {
      const store = Array.isArray(d.store) ? d.store[0] : d.store;
      return { ...(store as Store), role: d.role };
    });
});

export async function createStoreAction(raw: unknown) {
  const parsed = storeOnboardingSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message || "Invalid store data" };
  }
  const profile = await getCurrentProfile();
  if (!profile) return { error: "Unauthorized" };
  const location = normalizeStoreLocation({
    streetAddress: parsed.data.streetAddress,
    city: parsed.data.city,
    state: parsed.data.state,
    postalCode: parsed.data.postalCode,
  });

  if (isDemoMode()) {
    const store = demoCreateStore({
      ownerId: profile.id,
      name: parsed.data.name,
      categories: parsed.data.categories,
      streetAddress: location.street,
      city: location.city,
      state: location.state,
      postalCode: location.postalCode,
      phone: parsed.data.phone,
      website: parsed.data.website,
      serviceZips: parsed.data.serviceZips,
      requestCategories: parsed.data.requestCategories,
      ageRestricted: parsed.data.ageRestricted,
    });
    return { store };
  }

  const { createClient } = await import("@/lib/supabase/server");
  const { slugify } = await import("@/lib/utils");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };

  const slug = slugify(parsed.data.name);
  const { data: store, error } = await supabase
    .from("stores")
    .insert({
      owner_id: user.id,
      name: parsed.data.name,
      slug,
      street_address: location.street,
      city: location.city,
      state: location.state,
      postal_code: location.postalCode,
      phone: parsed.data.phone || null,
      website: parsed.data.website || null,
      age_restricted: parsed.data.ageRestricted,
    })
    .select("*")
    .single();

  if (error || !store) return { error: error?.message || "Failed" };

  await supabase.from("store_members").insert({
    store_id: store.id,
    user_id: user.id,
    role: "owner",
    status: "active",
  });
  await supabase.from("store_categories").insert(
    parsed.data.categories.map((category) => ({ store_id: store.id, category }))
  );
  await supabase.from("store_service_areas").insert(
    parsed.data.serviceZips.map((postal_code) => ({
      store_id: store.id,
      postal_code,
      city: parsed.data.city,
      state: parsed.data.state,
    }))
  );
  await supabase.from("subscriptions").insert({
    store_id: store.id,
    provider: "fastspring",
    plan: "free",
    plan_id: "trial",
    status: "trial",
  });

  return { store: store as Store };
}

export async function getStoreDemandAction(storeId: string): Promise<DemandItem[]> {
  if (!(await canViewOwnerAnalytics(storeId))) return [];
  const { computeStoreDemandFromSupabase } = await import(
    "@/lib/services/store-provisioning"
  );
  if (isDemoMode()) return demoGetStoreDemand(storeId);
  return computeStoreDemandFromSupabase(storeId);
}

export async function getStoreMetricsAction(storeId: string): Promise<StoreMetrics> {
  const empty: StoreMetrics = {
    requests_today: 0,
    answered_today: 0,
    requests_yesterday: 0,
    answered_yesterday: 0,
    waiting_today: 0,
    in_stock_today: 0,
    total_received: 0,
    total_answered: 0,
    avg_response_minutes: null,
    in_stock_pct: 0,
    out_of_stock_pct: 0,
    can_order_pct: 0,
    unanswered_pct: 0,
    week_received: 0,
    week_answered: 0,
    week_response_rate: 0,
    week_avg_response_minutes: null,
    week_in_stock: 0,
    week_customer_finds: 0,
  };
  if (!(await canViewOwnerAnalytics(storeId))) return empty;
  const { computeStoreMetricsFromSupabase } = await import(
    "@/lib/services/store-provisioning"
  );
  if (isDemoMode()) return demoGetStoreMetrics(storeId);
  return computeStoreMetricsFromSupabase(storeId);
}

export async function getNotificationsAction(): Promise<Notification[]> {
  const profile = await getCurrentProfile();
  if (!profile) return [];
  if (isDemoMode()) {
    return getDemoState()
      .notifications.filter((n) => n.user_id === profile.id)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }
  const { supabase, user } = await getSupabaseUser();
  if (!user) return [];
  const { data } = await supabase
    .from("notifications")
    .select("id, user_id, type, title, body, related_request_id, related_store_id, read_at, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(40);
  return (data || []) as Notification[];
}

export async function markNotificationReadAction(id: string) {
  const noteId = boundUuid(id);
  if (!noteId) return;
  const profile = await getCurrentProfile();
  if (!profile) return;
  if (isDemoMode()) {
    const n = getDemoState().notifications.find((x) => x.id === noteId && x.user_id === profile.id);
    if (n) n.read_at = new Date().toISOString();
    return;
  }
  const { supabase, user } = await getSupabaseUser();
  if (!user) return;
  await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", noteId)
    .eq("user_id", user.id);
}

export async function getStoreBySlugAction(slug: string) {
  const safeSlug = boundSlug(slug);
  if (!safeSlug) return null;
  if (isDemoMode()) {
    const state = getDemoState();
    const store = state.stores.find((s) => s.slug === safeSlug);
    if (!store) return null;
    const hours = state.storeHours.filter((h) => h.store_id === store.id);
    const categories = state.storeCategories
      .filter((c) => c.store_id === store.id)
      .map((c) => c.category);
    return { ...store, hours, categories };
  }
  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();
  const { data: store } = await supabase.from("stores").select("*").eq("slug", safeSlug).maybeSingle();
  if (!store) return null;
  const [{ data: hours }, { data: categories }] = await Promise.all([
    supabase.from("store_hours").select("*").eq("store_id", store.id),
    supabase.from("store_categories").select("category").eq("store_id", store.id),
  ]);
  return {
    ...store,
    hours: hours || [],
    categories: (categories || []).map((c) => c.category),
  };
}

export async function getAdminStatsAction() {
  const profile = await getCurrentProfile();
  if (!isSoloAdmin(profile)) return null;

  if (isDemoMode()) {
    const state = getDemoState();
    const applications = demoListStoreApplications();
    return {
      totalUsers: state.profiles.length,
      activeCustomers: state.profiles.filter((p) => p.account_type === "customer").length,
      activeStores: state.stores.filter((s) => s.is_active && !s.is_suspended).length,
      pendingApplications: applications.filter(
        (a) => a.status === "pending" || a.status === "needs_info"
      ).length,
      stores: state.stores,
      storeApplications: applications,
    };
  }

  const { createServiceClient } = await import("@/lib/supabase/admin");
  const admin = createServiceClient();

  const [
    { count: totalUsers },
    { count: activeCustomers },
    { count: activeStores },
    { count: pendingApplications },
    { data: stores },
    { data: storeApplications },
  ] = await Promise.all([
    admin.from("profiles").select("*", { count: "exact", head: true }),
    admin
      .from("profiles")
      .select("*", { count: "exact", head: true })
      .eq("account_type", "customer"),
    admin
      .from("stores")
      .select("*", { count: "exact", head: true })
      .eq("is_active", true)
      .eq("is_suspended", false),
    admin
      .from("store_applications")
      .select("*", { count: "exact", head: true })
      .in("status", ["pending", "needs_info"]),
    admin.from("stores").select("*").order("created_at", { ascending: false }).limit(100),
    admin
      .from("store_applications")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  return {
    totalUsers: totalUsers || 0,
    activeCustomers: activeCustomers || 0,
    activeStores: activeStores || 0,
    pendingApplications: pendingApplications || 0,
    stores: (stores || []) as Store[],
    storeApplications: (storeApplications || []) as StoreApplication[],
  };
}

function adminPersonName(profile: {
  first_name?: string | null;
  last_name?: string | null;
  display_name?: string | null;
} | null | undefined) {
  if (!profile) return "—";
  return (
    [profile.first_name, profile.last_name].filter(Boolean).join(" ") ||
    profile.display_name ||
    "—"
  );
}

export type AdminStoreTeamRow = {
  id: string;
  userId: string | null;
  name: string;
  contact: string;
  role: string;
  status: string;
};

export async function getAdminStoreDetailAction(storeId: string) {
  const profile = await getCurrentProfile();
  if (!isSoloAdmin(profile)) return null;

  if (isDemoMode()) {
    const state = getDemoState();
    const store = state.stores.find((s) => s.id === storeId);
    if (!store) return null;
    const team: AdminStoreTeamRow[] = state.storeMembers
      .filter((m) => m.store_id === storeId)
      .map((m) => {
        const user = state.profiles.find((p) => p.id === m.user_id);
        return {
          id: m.id,
          userId: m.user_id,
          name: adminPersonName(user),
          contact: user ? accountContactLabel(user) : "—",
          role: m.role,
          status: m.status,
        };
      });
    const devices = (state.storeDevices || [])
      .filter((d) => d.store_id === storeId)
      .map((d) => ({
        id: d.id,
        name: d.device_name,
        lastSeenAt: d.last_seen_at,
        revokedAt: d.revoked_at,
      }));
    return { store, team, devices };
  }

  const { createServiceClient } = await import("@/lib/supabase/admin");
  const admin = createServiceClient();
  const { data: store } = await admin.from("stores").select("*").eq("id", storeId).maybeSingle();
  if (!store) return null;

  const [{ data: memberRows }, { data: deviceRows }] = await Promise.all([
    admin
      .from("store_members")
      .select("id, role, status, user_id, profile:profiles(id, email, phone_e164, first_name, last_name, display_name, account_type)")
      .eq("store_id", storeId)
      .order("created_at", { ascending: true }),
    admin
      .from("store_devices")
      .select("id, device_name, last_seen_at, revoked_at")
      .eq("store_id", storeId)
      .order("paired_at", { ascending: false }),
  ]);

  const team: AdminStoreTeamRow[] = (memberRows || []).map((m) => {
    const raw = (m as { profile?: unknown }).profile;
    const user = (Array.isArray(raw) ? raw[0] : raw) as
      | {
          first_name?: string | null;
          last_name?: string | null;
          display_name?: string | null;
          email?: string | null;
          phone_e164?: string | null;
        }
      | null;
    return {
      id: String(m.id),
      userId: m.user_id ? String(m.user_id) : null,
      name: adminPersonName(user),
      contact: user ? accountContactLabel(user) : "—",
      role: String(m.role),
      status: String(m.status),
    };
  });

  return {
    store: store as Store,
    team,
    devices: ((deviceRows || []) as Pick<StoreDevice, "id" | "device_name" | "last_seen_at" | "revoked_at">[]).map(
      (d) => ({
        id: d.id,
        name: d.device_name,
        lastSeenAt: d.last_seen_at,
        revokedAt: d.revoked_at,
      })
    ),
  };
}

export type AdminHubRow = {
  id: string;
  name: string;
  storeId: string;
  storeName: string;
  lastSeenAt: string | null;
  revokedAt: string | null;
  pairedAt: string;
};

export async function getAdminHubsAction(): Promise<AdminHubRow[] | null> {
  const profile = await getCurrentProfile();
  if (!isSoloAdmin(profile)) return null;

  if (isDemoMode()) {
    const state = getDemoState();
    return (state.storeDevices || []).map((d) => ({
      id: d.id,
      name: d.device_name,
      storeId: d.store_id,
      storeName: state.stores.find((s) => s.id === d.store_id)?.name || "Store",
      lastSeenAt: d.last_seen_at,
      revokedAt: d.revoked_at,
      pairedAt: d.paired_at,
    }));
  }

  const { createServiceClient } = await import("@/lib/supabase/admin");
  const admin = createServiceClient();
  const { data } = await admin
    .from("store_devices")
    .select("id, device_name, paired_at, last_seen_at, revoked_at, store_id, store:stores(id, name)")
    .order("paired_at", { ascending: false });

  return ((data || []) as Array<{
    id: string;
    device_name: string;
    paired_at: string;
    last_seen_at: string | null;
    revoked_at: string | null;
    store_id: string;
    store?: { id?: string; name?: string } | { id?: string; name?: string }[] | null;
  }>).map((d) => {
    const store = Array.isArray(d.store) ? d.store[0] : d.store;
    return {
      id: d.id,
      name: d.device_name,
      storeId: store?.id || d.store_id,
      storeName: store?.name || "Store",
      lastSeenAt: d.last_seen_at,
      revokedAt: d.revoked_at,
      pairedAt: d.paired_at,
    };
  });
}

export async function updateProfileAction(input: {
  firstName?: string;
  lastName?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  notifyInStock?: boolean;
  notifyCanOrder?: boolean;
  notifyRequestExpired?: boolean;
}) {
  const profile = await getCurrentProfile();
  if (!profile) return { error: "Unauthorized" };

  if (isDemoMode()) {
    if (input.firstName !== undefined) profile.first_name = input.firstName;
    if (input.lastName !== undefined) profile.last_name = input.lastName;
    if (input.city !== undefined) profile.default_city = input.city;
    if (input.state !== undefined) profile.default_state = input.state;
    if (input.postalCode !== undefined) profile.default_postal_code = input.postalCode;
    if (input.notifyInStock !== undefined) profile.notify_in_stock = input.notifyInStock;
    if (input.notifyCanOrder !== undefined) profile.notify_can_order = input.notifyCanOrder;
    if (input.notifyRequestExpired !== undefined)
      profile.notify_request_expired = input.notifyRequestExpired;
    profile.updated_at = new Date().toISOString();
    return { profile };
  }

  const { supabase, user } = await getSupabaseUser();
  if (!user) return { error: "Unauthorized" };
  const { data, error } = await supabase
    .from("profiles")
    .update({
      first_name: input.firstName,
      last_name: input.lastName,
      default_city: input.city,
      default_state: input.state,
      default_postal_code: input.postalCode,
      notify_in_stock: input.notifyInStock,
      notify_can_order: input.notifyCanOrder,
      notify_request_expired: input.notifyRequestExpired,
    })
    .eq("id", user.id)
    .select("*")
    .single();
  if (error) return { error: toPublicError(error.message, "Couldn't save your profile.") };
  return { profile: data as Profile };
}

export async function deleteAccountAction(confirmation: string) {
  if (!isAccountDeletionConfirmed(confirmation)) {
    return { error: "Type DELETE to confirm." };
  }

  const profile = await getCurrentProfile();
  if (!profile) return { error: "Unauthorized" };

  if (isDemoMode()) {
    const sessionId = await getDemoSessionId();
    const result = demoDeleteAccount(sessionId);
    if ("error" in result && result.error) return result;
    await setDemoSessionCookie(null);
    return { ok: true as const };
  }

  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };

  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const { purgeFinditAccount } = await import("@/lib/account/purge");
    const purged = await purgeFinditAccount({
      userId: user.id,
      isOperator: isSoloAdmin(profile),
      accessToken: sessionData.session?.access_token,
    });
    if (purged.error) return { error: purged.error };
    await supabase.auth.signOut();
    return { ok: true as const };
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.toLowerCase().includes("service role")) {
      return {
        error: "Account deletion is not configured. Email FINDIT support instead.",
      };
    }
    return { error: toPublicError(error, "Could not delete this account. Try again or email support.") };
  }
}

export async function saveRequestAction(requestId: string) {
  const profile = await getCurrentProfile();
  if (!profile) return { error: "Unauthorized" };
  if (isDemoMode()) {
    const state = getDemoState();
    if (
      !state.savedRequests.some(
        (s) => s.customer_id === profile.id && s.request_id === requestId
      )
    ) {
      state.savedRequests.push({
        id: crypto.randomUUID(),
        customer_id: profile.id,
        request_id: requestId,
        created_at: new Date().toISOString(),
      });
    }
    return { ok: true };
  }
  const { supabase, user } = await getSupabaseUser();
  if (!user) return { error: "Unauthorized" };
  await supabase.from("saved_requests").upsert({
    customer_id: user.id,
    request_id: requestId,
  });
  return { ok: true };
}

export async function inviteEmployeeAction(
  storeId: string,
  email: string,
  role: "manager" | "employee",
  inviteeName?: string
) {
  const profile = await getCurrentProfile();
  if (!profile) return { error: "Unauthorized" };

  if (isDemoMode()) {
    const state = getDemoState();
    const member = state.storeMembers.find(
      (m) =>
        m.store_id === storeId &&
        m.user_id === profile.id &&
        m.status === "active" &&
        (m.role === "owner" || m.role === "manager")
    );
    if (!member) return { error: "Only owners and managers can invite" };
    const token = crypto.randomUUID().replace(/-/g, "");
    state.invites.push({
      id: crypto.randomUUID(),
      store_id: storeId,
      email: email.toLowerCase(),
      role,
      token,
      expires_at: new Date(Date.now() + 7 * 86400000).toISOString(),
      accepted_at: null,
      invitee_name: inviteeName?.trim() || null,
    });
    return { token, ok: true as const };
  }

  const workspace = await getStoreWorkspaceAction();
  if (!workspace?.canInvite || workspace.store?.id !== storeId) {
    if (profile.account_type !== "admin") {
      return { error: "Only owners and managers can invite" };
    }
  }

  const { createServiceClient } = await import("@/lib/supabase/admin");
  const admin = createServiceClient();
  const { data, error } = await admin
    .from("store_invites")
    .insert({
      store_id: storeId,
      email: email.toLowerCase(),
      role,
      invitee_name: inviteeName?.trim() || null,
    })
    .select("token")
    .single();
  if (error) return { error: error.message };
  return { token: data.token as string, ok: true as const };
}

export async function isDemoModeAction() {
  return isDemoMode();
}

async function storeJoinEmailBlocked(
  admin: Awaited<ReturnType<typeof import("@/lib/supabase/admin").createServiceClient>>,
  ownerEmail: string
) {
  if (isSoloAdminEmail(ownerEmail)) {
    return { error: EXISTING_ACCOUNT_HOME, code: "existing_account" as const };
  }
  const { data: existing } = await admin
    .from("profiles")
    .select("id")
    .eq("email", ownerEmail)
    .maybeSingle();
  if (existing?.id) {
    return { error: EXISTING_ACCOUNT_HOME, code: "existing_account" as const };
  }
  const { data: existingApp } = await admin
    .from("store_applications")
    .select("id")
    .eq("owner_email", ownerEmail)
    .in("status", ["pending", "needs_info", "approved"])
    .limit(1)
    .maybeSingle();
  if (existingApp?.id) {
    return { error: EXISTING_ACCOUNT_HOME, code: "existing_account" as const };
  }
  return null;
}

async function consumeStoreJoinEmailCode(
  admin: Awaited<ReturnType<typeof import("@/lib/supabase/admin").createServiceClient>>,
  ownerEmail: string,
  codeRaw: string
) {
  const code = normalizeJoinEmailCode(codeRaw);
  if (code.length !== 6) {
    return { error: "Enter the 6-digit code we emailed you." };
  }
  const { data: row } = await admin
    .from("store_join_email_codes")
    .select("email, code_hash, expires_at, attempt_count")
    .eq("email", ownerEmail)
    .maybeSingle();
  if (!row) {
    return { error: "Request a new code, then enter it here." };
  }
  if (new Date(row.expires_at).getTime() < Date.now()) {
    await admin.from("store_join_email_codes").delete().eq("email", ownerEmail);
    return { error: "That code expired. Request a new one." };
  }
  const attempts = Number(row.attempt_count || 0);
  if (attempts >= JOIN_EMAIL_CODE_MAX_ATTEMPTS) {
    await admin.from("store_join_email_codes").delete().eq("email", ownerEmail);
    return { error: "Too many tries. Request a new code." };
  }
  const expected = hashJoinEmailCode(ownerEmail, code);
  if (!joinEmailCodesMatch(String(row.code_hash), expected)) {
    await admin
      .from("store_join_email_codes")
      .update({ attempt_count: attempts + 1 })
      .eq("email", ownerEmail);
    return { error: "That code didn’t match. Try again." };
  }
  await admin.from("store_join_email_codes").delete().eq("email", ownerEmail);
  return { ok: true as const };
}

/** Email a 6-digit code. Does not create an account or application. */
export async function sendStoreJoinEmailCodeAction(emailRaw: string) {
  const email = emailRaw.trim().toLowerCase();
  if (!email || !email.includes("@")) {
    return { error: "Enter a valid email." };
  }
  const limited = await consumeRateLimit({
    bucket: "store-join-email-code",
    limit: 5,
    windowMs: 60 * 60_000,
    key: email,
  });
  if (!limited.ok) return { error: limited.error };
  if (isDemoMode()) {
    return {
      ok: true as const,
      message: "Demo mode: enter 000000 to confirm this email.",
    };
  }

  try {
    const { createServiceClient } = await import("@/lib/supabase/admin");
    const admin = createServiceClient();
    const blocked = await storeJoinEmailBlocked(admin, email);
    if (blocked) return blocked;

    const code = generateJoinEmailCode();
    const { error: writeError } = await admin.from("store_join_email_codes").upsert(
      {
        email,
        code_hash: hashJoinEmailCode(email, code),
        expires_at: new Date(Date.now() + JOIN_EMAIL_CODE_TTL_MS).toISOString(),
        attempt_count: 0,
        created_at: new Date().toISOString(),
      },
      { onConflict: "email" }
    );
    if (writeError) {
      return { error: "Could not start email confirmation. Try again in a moment." };
    }

    const copy = authEmailCopy("store_join");
    const apiKey = process.env.RESEND_API_KEY;
    const from = process.env.RESEND_FROM || "FINDIT <hello@askfindit.com>";
    if (!apiKey) {
      await admin.from("store_join_email_codes").delete().eq("email", email);
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
        to: [email],
        subject: copy.subject,
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
      await admin.from("store_join_email_codes").delete().eq("email", email);
      const detail = await sent.text();
      return { error: authEmailErrorMessage(detail || "Could not send the code.") };
    }
    return {
      ok: true as const,
      message: "Check your email for a 6-digit code. It expires in about 10 minutes.",
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.toLowerCase().includes("service role")) {
      return { error: "Email confirmation is not configured. Try again later." };
    }
    return { error: authEmailErrorMessage(message) };
  }
}

export async function submitStoreApplicationAction(raw: unknown) {
  const parsed = storeJoinApplicationSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message || "Invalid application" };
  }
  const ownerEmail = parsed.data.ownerEmail.toLowerCase();
  const emailCode =
    raw && typeof raw === "object" && "emailCode" in raw
      ? String((raw as { emailCode?: unknown }).emailCode || "")
      : "";

  if (isDemoMode()) {
    if (normalizeJoinEmailCode(emailCode) !== "000000") {
      return { error: "Demo mode: enter 000000 to confirm this email." };
    }
    const profile = await getCurrentProfile();
    const application = demoSubmitStoreApplication({
      businessName: parsed.data.businessName,
      businessType: parsed.data.businessType,
      legalName: parsed.data.legalName,
      ein: parsed.data.ein,
      entityType: parsed.data.entityType,
      streetAddress: parsed.data.streetAddress,
      city: parsed.data.city,
      state: parsed.data.state,
      postalCode: parsed.data.postalCode,
      phone: parsed.data.phone,
      website: parsed.data.website || undefined,
      ownerName: parsed.data.ownerName,
      ownerEmail,
      ownerPhone: parsed.data.ownerPhone || undefined,
      whyLegit: parsed.data.whyLegit,
      confirmedLegitimate: parsed.data.confirmedLegitimate === true,
      requestCategories: parsed.data.requestCategories,
      requiresCustomerId: parsed.data.requiresCustomerId,
      applicantUserId: profile?.id || null,
    });
    return { application };
  }

  const profile = await getCurrentProfile();

  // Service role after validation — public /join is often anonymous; INSERT…RETURNING
  // fails SELECT RLS for anon even when the insert policy allows the row.
  const { createServiceClient } = await import("@/lib/supabase/admin");
  const admin = createServiceClient();
  const blocked = await storeJoinEmailBlocked(admin, ownerEmail);
  if (blocked) return blocked;

  const consumed = await consumeStoreJoinEmailCode(admin, ownerEmail, emailCode);
  if ("error" in consumed && consumed.error) return consumed;

  const limited = await consumeRateLimit({
    bucket: "store-apply",
    limit: 3,
    windowMs: 24 * 60 * 60_000,
    key: ownerEmail,
  });
  if (!limited.ok) return { error: limited.error };

  const ownerName = parsed.data.ownerName.trim();
  const firstName = ownerName.split(" ")[0] || ownerName;
  const lastName = ownerName.split(" ").slice(1).join(" ");
  const location = normalizeStoreLocation({
    streetAddress: parsed.data.streetAddress,
    city: parsed.data.city,
    state: parsed.data.state,
    postalCode: parsed.data.postalCode,
  });
  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email: ownerEmail,
    email_confirm: true,
    user_metadata: {
      first_name: firstName,
      last_name: lastName,
      account_type: "business",
      default_city: location.city,
      default_state: location.state,
      default_postal_code: location.postalCode,
    },
  });
  if (createError || !created.user) {
    if (createError && alreadyHasAccount(createError.message)) {
      return { error: EXISTING_ACCOUNT_HOME, code: "existing_account" as const };
    }
    return { error: createError?.message || "Could not create the store login." };
  }
  const applicantUserId = created.user.id;
  const { data, error } = await admin
    .from("store_applications")
    .insert({
      business_name: parsed.data.businessName,
      business_type: parsed.data.businessType,
      legal_name: parsed.data.legalName,
      ein: parsed.data.ein,
      entity_type: parsed.data.entityType,
      street_address: location.street,
      city: location.city,
      state: location.state,
      postal_code: location.postalCode,
      phone: parsed.data.phone,
      website: parsed.data.website || null,
      owner_name: parsed.data.ownerName,
      owner_email: ownerEmail,
      owner_phone: parsed.data.ownerPhone || null,
      why_legit: parsed.data.whyLegit,
      confirmed_legitimate: true,
      request_categories: parsed.data.requestCategories,
      requires_customer_id: parsed.data.requiresCustomerId,
      applicant_user_id: applicantUserId,
      status: "pending",
    })
    .select("*")
    .single();
  if (error) return { error: error.message };
  return { application: data as StoreApplication };
}

export async function getStoreApplicationsAction() {
  const profile = await getCurrentProfile();
  if (!isSoloAdmin(profile)) return [];
  if (isDemoMode()) return demoListStoreApplications();
  const { supabase } = await getSupabaseUser();
  const { data } = await supabase
    .from("store_applications")
    .select("*")
    .order("created_at", { ascending: false });
  return (data || []) as StoreApplication[];
}

export async function reviewStoreApplicationAction(
  applicationId: string,
  decision: "approved" | "rejected" | "needs_info",
  notes?: string
) {
  const profile = await getCurrentProfile();
  if (!profile || !isSoloAdmin(profile)) {
    return { error: "Admin only" };
  }
  if (isDemoMode()) {
    try {
      if (decision === "approved") {
        const result = demoApproveStoreApplication(applicationId, profile.id);
        return { application: result.application, store: result.store };
      }
      if (decision === "needs_info") {
        const application = demoRequestMoreInfoApplication(
          applicationId,
          profile.id,
          notes || "Please provide more information about your business."
        );
        return { application };
      }
      const application = demoRejectStoreApplication(applicationId, profile.id);
      return { application };
    } catch (e) {
      return { error: e instanceof Error ? e.message : "Failed" };
    }
  }

  const { createServiceClient } = await import("@/lib/supabase/admin");
  const admin = createServiceClient();

  if (decision === "needs_info") {
    const { data, error } = await admin
      .from("store_applications")
      .update({
        status: "needs_info",
        admin_notes: notes || "Please provide more information about your business.",
        reviewed_at: new Date().toISOString(),
        reviewed_by: profile.id,
      })
      .eq("id", applicationId)
      .eq("status", "pending")
      .select("*")
      .single();
    if (error) return { error: "Couldn't update application." };
    await trackEvent("store_application_needs_info", {
      userId: profile.id,
      metadata: { applicationId },
    });
    return { application: data as StoreApplication };
  }

  if (decision === "rejected") {
    const { data, error } = await admin
      .from("store_applications")
      .update({
        status: "rejected",
        reviewed_at: new Date().toISOString(),
        reviewed_by: profile.id,
        admin_notes: notes || null,
      })
      .eq("id", applicationId)
      .in("status", ["pending", "needs_info"])
      .select("*")
      .single();
    if (error) return { error: "Couldn't update application." };
    return { application: data as StoreApplication };
  }

  try {
    const { provisionStoreFromApplication } = await import(
      "@/lib/services/store-provisioning"
    );
    const result = await provisionStoreFromApplication(applicationId, profile.id);
    await trackEvent("store_application_approved", {
      userId: profile.id,
      storeId: result.store.id,
    });
    return { application: result.application as StoreApplication, store: result.store };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to approve application" };
  }
}

export async function getMyStoreApplicationStatusAction() {
  const profile = await getCurrentProfile();
  if (!profile) return null;
  if (isDemoMode()) {
    return demoGetPendingApplicationForEmail(profile.email) || null;
  }
  if (!profile.email) return null;
  const { supabase } = await getSupabaseUser();
  const { data } = await supabase
    .from("store_applications")
    .select("*")
    .eq("owner_email", profile.email)
    .in("status", ["pending", "needs_info"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as StoreApplication) || null;
}

export async function getCustomerPlanUsageAction() {
  const profile = await getCurrentProfile();
  if (!profile) return null;
  const entitlements = getConsumerEntitlements(profile.subscription_plan);
  let used = 0;
  if (isDemoMode()) {
    used = demoCountCustomerRequestsThisMonth(profile.id);
  } else {
    const { supabase, user } = await getSupabaseUser();
    if (!user) return null;
    const { count } = await supabase
      .from("customer_requests")
      .select("*", { count: "exact", head: true })
      .eq("customer_id", user.id)
      .gte("created_at", monthlyFindWindowStart().toISOString());
    used = count || 0;
  }
  return {
    plan: CUSTOMER_PLANS[entitlements.planId],
    entitlements,
    used,
    limit: entitlements.monthlyRequestLimit,
    remaining: Math.max(0, entitlements.monthlyRequestLimit - used),
    bypassed: bypassConsumerPlanLimits(),
    allPlans: CUSTOMER_PLANS,
  };
}

/** Store dashboard only for members of an approved store (or admin). */
export async function canAccessStoreDashboardAction(): Promise<{
  allowed: boolean;
  reason?: "unauthenticated" | "no_store" | "pending_application";
  pendingApplication?: StoreApplication | null;
}> {
  const profile = await getCurrentProfile();
  if (!profile) return { allowed: false, reason: "unauthenticated" };
  if (isSoloAdmin(profile)) return { allowed: false, reason: "no_store" };
  const stores = await getUserStoresAction();
  if (stores.length > 0) return { allowed: true };
  const pending = await getMyStoreApplicationStatusAction();
  if (pending) {
    return { allowed: false, reason: "pending_application", pendingApplication: pending };
  }
  return { allowed: false, reason: "no_store" };
}

export async function fulfillRequestAction(input: {
  requestId: string;
  storeId?: string | null;
  foundWithFindit?: boolean | null;
}) {
  const profile = await getCurrentProfile();
  if (!profile) return { error: "Please sign in" };

  if (isDemoMode()) {
    try {
      const request = demoFulfillRequest({
        requestId: input.requestId,
        customerId: profile.id,
        storeId: input.storeId,
        foundWithFindit: input.foundWithFindit,
      });
      const foundLabel =
        input.foundWithFindit === true
          ? "Found with FINDIT"
          : input.foundWithFindit === false
            ? "Found without FINDIT"
            : "Marked found";
      void notifySupportInbox({
        kind: "found",
        subject: `${foundLabel}: ${request.product_name}`,
        heading: foundLabel,
        body: `Demo customer ${profile.email || profile.id} marked this Find.`,
        replyTo: profile.email,
      });
      return { request };
    } catch (e) {
      return { error: e instanceof Error ? e.message : "Failed" };
    }
  }

  const { supabase, user } = await getSupabaseUser();
  if (!user) return { error: "Please sign in" };

  const { data, error } = await supabase
    .from("customer_requests")
    .update({
      status: "fulfilled",
      fulfilled_at: new Date().toISOString(),
      fulfilled_store_id: input.storeId || null,
      found_with_findit: input.foundWithFindit ?? null,
    })
    .eq("id", input.requestId)
    .eq("customer_id", user.id)
    .select("*")
    .single();
  if (error) return { error: "Couldn't update this request." };

  if (input.storeId) {
    const { data: members } = await supabase
      .from("store_members")
      .select("user_id")
      .eq("store_id", input.storeId)
      .eq("status", "active");
    const rows = (members || [])
      .filter((m) => m.user_id)
      .map((m) => ({
        user_id: m.user_id!,
        type: "customer_found",
        title: "Customer found the product",
        body: `A customer marked "${data.product_name}" as found.`,
        related_request_id: input.requestId,
        related_store_id: input.storeId,
      }));
    if (rows.length) {
      const { createServiceClient } = await import("@/lib/supabase/admin");
      const admin = createServiceClient();
      await admin.from("notifications").insert(rows);
    }
  }

  await trackEvent("request_fulfilled", {
    userId: user.id,
    requestId: input.requestId,
    storeId: input.storeId,
    metadata: { foundWithFindit: input.foundWithFindit },
  });

  const foundLabel =
    input.foundWithFindit === true
      ? "Found with FINDIT"
      : input.foundWithFindit === false
        ? "Found without FINDIT"
        : "Marked found";
  void notifySupportInbox({
    kind: "found",
    subject: `${foundLabel}: ${data.product_name}`,
    heading: foundLabel,
    body: [
      `Product: ${data.product_name}`,
      `Request: ${input.requestId}`,
      input.storeId ? `Store: ${input.storeId}` : "Store: none picked",
      `Customer: ${profile.email || user.email || user.id}`,
    ].join("\n"),
    replyTo: profile.email || user.email,
  });

  return { request: data as CustomerRequest };
}

export async function stillLookingAction(requestId: string) {
  const profile = await getCurrentProfile();
  if (!profile) return { error: "Please sign in" };

  if (isDemoMode()) {
    try {
      return demoStillLooking({ requestId, customerId: profile.id });
    } catch (e) {
      return { error: e instanceof Error ? e.message : "Failed" };
    }
  }

  const { supabase, user } = await getSupabaseUser();
  if (!user) return { error: "Please sign in" };
  const { data: request } = await supabase
    .from("customer_requests")
    .select("*")
    .eq("id", requestId)
    .eq("customer_id", user.id)
    .single();
  if (!request) return { error: "Request not found" };

  const check = canRebroadcastStillLooking({
    status: request.status,
    expiresAt: request.expires_at,
    stillLookingCount: request.still_looking_count || 0,
    lastRebroadcastAt: request.last_rebroadcast_at || null,
  });
  if (!check.ok) return { error: check.reason };

  const extended = new Date(
    Math.max(new Date(request.expires_at).getTime(), Date.now()) + 12 * 3600_000
  ).toISOString();

  await supabase
    .from("customer_requests")
    .update({
      still_looking_count: (request.still_looking_count || 0) + 1,
      last_rebroadcast_at: new Date().toISOString(),
      expires_at: extended,
    })
    .eq("id", requestId);

  const { createServiceClient } = await import("@/lib/supabase/admin");
  const admin = createServiceClient();
  const { data: targets } = await admin
    .from("request_targets")
    .select("store_id, notify_after")
    .eq("request_id", requestId);
  const { data: responses } = await admin
    .from("store_responses")
    .select("store_id")
    .eq("request_id", requestId);
  const responded = new Set((responses || []).map((r) => r.store_id));
  const unanswered = (targets || []).filter(
    (t) =>
      !responded.has(t.store_id) &&
      (!t.notify_after || new Date(t.notify_after).getTime() <= Date.now())
  );

  if (unanswered.length) {
    const { data: members } = await admin
      .from("store_members")
      .select("user_id, store_id")
      .in(
        "store_id",
        unanswered.map((t) => t.store_id)
      )
      .eq("status", "active");
    const notifications = (members || [])
      .filter((m) => m.user_id)
      .map((m) => ({
        user_id: m.user_id!,
        type: "still_looking",
        title: "Customer is still looking",
        body: `Still looking nearby: ${request.product_name}`,
        related_request_id: requestId,
        related_store_id: m.store_id,
      }));
    if (notifications.length) await admin.from("notifications").insert(notifications);
    const staffIds = [
      ...new Set(notifications.map((n) => n.user_id).filter(Boolean)),
    ];
    if (staffIds.length) {
      try {
        await notifyEmployeeDevices({
          admin,
          userIds: staffIds,
          title: "Customer is still looking",
          body: `Still looking nearby: ${request.product_name}`,
          data: {
            type: "still_looking",
            requestId,
            url: `/store/requests/${requestId}`,
          },
        });
      } catch (err) {
        console.error("[FINDIT] Store push failed", err);
      }
    }
  }

  await trackEvent("request_still_looking", {
    userId: user.id,
    requestId,
  });

  return { storesTargeted: unanswered.length };
}

const EXPANDABLE_REQUEST_STATUSES = new Set([
  "active",
  "partially_answered",
  "answered",
]);

export async function expandCustomerRequestRadiusAction(
  requestId: string,
  radiusMiles: number
) {
  const id = boundUuid(requestId);
  if (!id) return { error: "Request not found" };
  const miles = Number(radiusMiles);
  if (
    !Number.isInteger(miles) ||
    !RADIUS_OPTIONS.some((option) => option.miles === miles)
  ) {
    return { error: "Pick a farther distance." };
  }
  if (miles > MAX_CUSTOMER_RADIUS_MILES) {
    return { error: `FINDIT searches up to ${MAX_CUSTOMER_RADIUS_MILES} miles.` };
  }

  const profile = await getCurrentProfile();
  if (!profile) return { error: "Please sign in", needsAuth: true };
  const entitlements = getConsumerEntitlements(profile.subscription_plan);
  if (radiusExceedsPlan(miles, entitlements.maxSearchRadiusMiles)) {
    return { error: radiusLimitMessage(entitlements) };
  }

  const expandLimit = await consumeRateLimit({
    bucket: "expand-radius",
    limit: 8,
    windowMs: 60 * 60_000,
    key: profile.id,
  });
  if (!expandLimit.ok) return { error: expandLimit.error };

  if (isDemoMode()) {
    try {
      return demoExpandRequestRadius({
        requestId: id,
        customerId: profile.id,
        radiusMiles: miles,
      });
    } catch (e) {
      return { error: e instanceof Error ? e.message : "Couldn't look farther." };
    }
  }

  const { supabase, user } = await getSupabaseUser();
  if (!user) return { error: "Please sign in", needsAuth: true };

  const { createServiceClient } = await import("@/lib/supabase/admin");
  const admin = createServiceClient();
  const { data: request } = await admin
    .from("customer_requests")
    .select("id, customer_id, status, expires_at, radius_miles")
    .eq("id", id)
    .eq("customer_id", user.id)
    .maybeSingle();
  if (!request) return { error: "Request not found" };
  if (!EXPANDABLE_REQUEST_STATUSES.has(request.status)) {
    return { error: "This Find isn't waiting on stores anymore." };
  }
  if (new Date(request.expires_at).getTime() <= Date.now()) {
    return { error: "This Find has expired." };
  }
  if (miles <= Number(request.radius_miles)) {
    return { error: "Pick a farther distance than this Find already uses." };
  }

  const { error: updateError } = await admin
    .from("customer_requests")
    .update({ radius_miles: miles, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("customer_id", user.id);
  if (updateError) return { error: "Couldn't look farther." };

  const storesTargeted = await routeRequestToStoresAction(id);
  return { ok: true as const, radiusMiles: miles, storesTargeted };
}

export async function markStoreRequestOpenedAction(storeId: string, requestId: string) {
  const actor = await getStoreActor(storeId);
  if (!actor) return;
  if (isDemoMode()) {
    demoMarkTargetOpened(storeId, requestId, actor.userId);
    return;
  }
  const { createServiceClient } = await import("@/lib/supabase/admin");
  const admin = createServiceClient();
  const { data: target } = await admin
    .from("request_targets")
    .select("id, opened_at")
    .eq("store_id", storeId)
    .eq("request_id", requestId)
    .maybeSingle();
  if (!target || target.opened_at) return;
  const opened = new Date().toISOString();
  await admin
    .from("request_targets")
    .update({ opened_at: opened, viewed_at: opened })
    .eq("id", target.id);
  await trackEvent("store_request_opened", {
    userId: actor.userId,
    storeId,
    requestId,
  });
}

export async function submitPilotFeedbackAction(input: {
  role: "customer" | "store";
  requestId?: string;
  storeId?: string;
  helpful?: boolean | null;
  relevance?: "relevant" | "wrong_category" | "too_far" | "other" | null;
  note?: string;
}) {
  const profile = await getCurrentProfile();
  if (!profile) return { error: "Please sign in" };

  if (isDemoMode()) {
    getDemoState().events.push({
      event_name: "pilot_feedback_submitted",
      user_id: profile.id,
      store_id: input.storeId,
      request_id: input.requestId,
      created_at: new Date().toISOString(),
    });
    const liked =
      input.helpful === true ? "Liked" : input.helpful === false ? "Disliked" : "Feedback";
    void notifySupportInbox({
      kind: "feedback",
      subject: `${liked} a Find`,
      heading: liked,
      body: `Demo ${input.role} ${profile.email || profile.id}`,
      replyTo: profile.email,
    });
    return { ok: true };
  }

  const { supabase, user } = await getSupabaseUser();
  if (!user) return { error: "Please sign in" };
  const { error } = await supabase.from("pilot_feedback").insert({
    user_id: user.id,
    role: input.role,
    request_id: input.requestId || null,
    store_id: input.storeId || null,
    helpful: input.helpful ?? null,
    relevance: input.relevance ?? null,
    note: input.note || null,
  });
  if (error) return { error: "Couldn't save feedback." };
  await trackEvent("pilot_feedback_submitted", {
    userId: user.id,
    requestId: input.requestId,
    storeId: input.storeId,
  });
  const liked =
    input.helpful === true ? "Liked" : input.helpful === false ? "Disliked" : "Feedback";
  void notifySupportInbox({
    kind: "feedback",
    subject: `${liked} a Find`,
    heading: liked,
    body: [
      `Role: ${input.role}`,
      input.helpful === true
        ? "Helpful: yes"
        : input.helpful === false
          ? "Helpful: no"
          : "Helpful: not said",
      input.relevance ? `Relevance: ${input.relevance}` : null,
      input.note ? `Note: ${input.note}` : null,
      input.requestId ? `Request: ${input.requestId}` : null,
      input.storeId ? `Store: ${input.storeId}` : null,
      `Customer: ${profile.email || user.email || user.id}`,
    ]
      .filter(Boolean)
      .join("\n"),
    replyTo: profile.email || user.email,
  });
  return { ok: true };
}

export async function trackDirectionsClickAction(requestId: string, storeId: string) {
  const profile = await getCurrentProfile();
  await trackEvent("directions_clicked", {
    userId: profile?.id,
    requestId,
    storeId,
  });
  return { ok: true };
}

export async function updateStoreCoverageAction(
  storeId: string,
  input: {
    serviceRadiusMiles?: number;
    serviceZips?: string[];
    categories?: string[];
    businessType?: string | null;
    acceptingRequests?: boolean;
    catalogCategoryIds?: string[];
    catalogKeywordIds?: string[];
    customKeywords?: string[];
    hours?: {
      day_of_week: number;
      open_time: string | null;
      close_time: string | null;
      is_closed: boolean;
    }[];
  }
) {
  const profile = await getCurrentProfile();
  if (!profile) return { error: "Unauthorized" };

  if (isDemoMode()) {
    try {
      const store = demoUpdateStoreSettings(storeId, profile.id, input);
      return { store };
    } catch (e) {
      return { error: e instanceof Error ? e.message : "Failed" };
    }
  }

  const { supabase, user } = await getSupabaseUser();
  if (!user) return { error: "Unauthorized" };

  const { data: membership } = await supabase
    .from("store_members")
    .select("role")
    .eq("store_id", storeId)
    .eq("user_id", user.id)
    .eq("status", "active")
    .maybeSingle();
  if (
    !membership ||
    (membership.role !== "owner" && membership.role !== "manager")
  ) {
    return { error: "Only owners and managers can update store settings" };
  }

  if (input.serviceRadiusMiles != null || input.businessType !== undefined || input.acceptingRequests !== undefined) {
    const patch: Record<string, unknown> = {};
    if (input.serviceRadiusMiles != null) patch.service_radius_miles = input.serviceRadiusMiles;
    if (input.businessType !== undefined) patch.business_type = input.businessType;
    if (input.acceptingRequests !== undefined) patch.accepting_requests = input.acceptingRequests;
    await supabase.from("stores").update(patch).eq("id", storeId);
  }
  if (input.serviceZips) {
    await supabase.from("store_service_areas").delete().eq("store_id", storeId);
    if (input.serviceZips.length) {
      await supabase.from("store_service_areas").insert(
        input.serviceZips.map((postal_code) => ({ store_id: storeId, postal_code }))
      );
    }
  }
  if (input.categories) {
    await supabase.from("store_categories").delete().eq("store_id", storeId);
    if (input.categories.length) {
      await supabase.from("store_categories").insert(
        input.categories.map((category) => ({ store_id: storeId, category }))
      );
    }
  }
  if (input.catalogCategoryIds) {
    await supabase.from("store_catalog_categories").delete().eq("store_id", storeId);
    if (input.catalogCategoryIds.length) {
      await supabase.from("store_catalog_categories").insert(
        input.catalogCategoryIds.map((category_id) => ({ store_id: storeId, category_id }))
      );
    }
  }
  if (input.catalogKeywordIds) {
    await supabase.from("store_catalog_keywords").delete().eq("store_id", storeId);
    if (input.catalogKeywordIds.length) {
      await supabase.from("store_catalog_keywords").insert(
        input.catalogKeywordIds.map((keyword_id) => ({ store_id: storeId, keyword_id }))
      );
    }
  }
  if (input.customKeywords) {
    await supabase.from("store_custom_keywords").delete().eq("store_id", storeId);
    const unique = [...new Set(input.customKeywords.map((k) => k.trim()).filter(Boolean))];
    if (unique.length) {
      await supabase.from("store_custom_keywords").insert(
        unique.map((keyword) => ({
          store_id: storeId,
          keyword,
          normalized_keyword: keyword.toLowerCase().replace(/\s+/g, " "),
        }))
      );
    }
  }
  if (input.hours) {
    for (const h of input.hours) {
      await supabase.from("store_hours").upsert(
        {
          store_id: storeId,
          day_of_week: h.day_of_week,
          open_time: h.open_time,
          close_time: h.close_time,
          is_closed: h.is_closed,
        },
        { onConflict: "store_id,day_of_week" }
      );
    }
  }
  return { ok: true };
}

export async function getStoreSettingsAction(storeId: string) {
  const id = boundUuid(storeId);
  if (!id) return null;
  const profile = await getCurrentProfile();
  if (!profile) return null;

  if (isDemoMode()) {
    const state = getDemoState();
    const member = state.storeMembers.find(
      (m) => m.store_id === id && m.user_id === profile.id && m.status === "active"
    );
    if (!member && !isSoloAdmin(profile)) return null;
    const store = state.stores.find((s) => s.id === id);
    if (!store) return null;
    return {
      store,
      role: member?.role || "owner",
      hours: state.storeHours.filter((h) => h.store_id === id),
      categories: state.storeCategories
        .filter((c) => c.store_id === id)
        .map((c) => c.category),
      serviceZips: state.storeServiceAreas
        .filter((a) => a.store_id === id)
        .map((a) => a.postal_code),
      catalogCategoryIds: [] as string[],
      customKeywords: [] as string[],
      pilotMode: isPilotMode() || Boolean(store.trial_ends_at),
    };
  }

  const { supabase, user } = await getSupabaseUser();
  if (!user) return null;
  const { data: membership } = await supabase
    .from("store_members")
    .select("role")
    .eq("store_id", id)
    .eq("user_id", user.id)
    .eq("status", "active")
    .maybeSingle();
  if (!membership && !isSoloAdmin(profile)) return null;

  const [{ data: store }, { data: hours }, { data: cats }, { data: areas }, { data: catalogCats }, { data: customKeys }] =
    await Promise.all([
      supabase.from("stores").select("*").eq("id", id).maybeSingle(),
      supabase.from("store_hours").select("*").eq("store_id", id),
      supabase.from("store_categories").select("category").eq("store_id", id),
      supabase.from("store_service_areas").select("postal_code").eq("store_id", id),
      supabase.from("store_catalog_categories").select("category_id").eq("store_id", id),
      supabase.from("store_custom_keywords").select("keyword").eq("store_id", id),
    ]);
  if (!store) return null;
  return {
    store: store as Store,
    role: membership?.role || "owner",
    hours: hours || [],
    categories: (cats || []).map((c) => c.category),
    catalogCategoryIds: (catalogCats || []).map((c) => c.category_id),
    customKeywords: (customKeys || []).map((c) => c.keyword),
    serviceZips: (areas || []).map((a) => a.postal_code),
    pilotMode: isPilotMode() || Boolean(store.trial_ends_at),
  };
}

export async function getMyStoreSettingsAction() {
  const stores = await getUserStoresAction();
  const first = stores[0];
  if (!first) return null;
  return getStoreSettingsAction(first.id);
}

export async function getPilotAdminStatsAction(): Promise<PilotAdminStats | null> {
  const profile = await getCurrentProfile();
  if (!isSoloAdmin(profile)) return null;
  if (isDemoMode()) return demoGetPilotAdminStats();

  const { createServiceClient } = await import("@/lib/supabase/admin");
  const admin = createServiceClient();
  const start = new Date();
  start.setHours(0, 0, 0, 0);

  const [
    { count: totalCustomers },
    { count: approvedStores },
    { data: apps },
    { data: requests },
    { data: targets },
    { data: responses },
  ] = await Promise.all([
    admin.from("profiles").select("*", { count: "exact", head: true }).eq("account_type", "customer"),
    admin
      .from("stores")
      .select("*", { count: "exact", head: true })
      .eq("is_active", true)
      .eq("is_suspended", false),
    admin.from("store_applications").select("id, status"),
    admin
      .from("customer_requests")
      .select("id, product_name, normalized_product_name, category, status, stores_targeted, created_at, fulfilled_store_id, fulfilled_at")
      .order("created_at", { ascending: false })
      .limit(2000),
    admin.from("request_targets").select("store_id, request_id, response_time_seconds, created_at"),
    admin.from("store_responses").select("store_id, request_id, response_type, created_at"),
  ]);

  const reqs = requests || [];
  const pendingApplications = (apps || []).filter(
    (a) => a.status === "pending" || a.status === "needs_info"
  ).length;
  const activeRequests = reqs.filter((r) =>
    ["active", "partially_answered", "answered"].includes(r.status)
  ).length;
  const completedRequests = reqs.filter((r) =>
    ["fulfilled", "expired", "cancelled"].includes(r.status)
  ).length;
  const requestsToday = reqs.filter((r) => new Date(r.created_at) >= start).length;
  const withResponse = new Set((responses || []).map((r) => r.request_id));
  const withInStock = new Set(
    (responses || []).filter((r) => r.response_type === "in_stock").map((r) => r.request_id)
  );
  const confirmedFound = reqs.filter((r) => r.status === "fulfilled");

  const firstSecs: number[] = [];
  for (const req of reqs) {
    const rs = (responses || [])
      .filter((r) => r.request_id === req.id)
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    if (!rs.length) continue;
    firstSecs.push(
      Math.round(
        (new Date(rs[0].created_at).getTime() - new Date(req.created_at).getTime()) / 1000
      )
    );
  }

  const storesRespondingToday = new Set(
    (responses || [])
      .filter((r) => new Date(r.created_at) >= start)
      .map((r) => r.store_id)
  ).size;

  const catCounts = new Map<string, number>();
  const productCounts = new Map<string, number>();
  for (const r of reqs) {
    if (r.category) catCounts.set(r.category, (catCounts.get(r.category) || 0) + 1);
    productCounts.set(
      r.normalized_product_name,
      (productCounts.get(r.normalized_product_name) || 0) + 1
    );
  }

  const { data: stores } = await admin.from("stores").select("id, name").limit(200);
  const storePerf = (stores || []).map((store) => {
    const t = (targets || []).filter((x) => x.store_id === store.id);
    const r = (responses || []).filter((x) => x.store_id === store.id);
    const finds = reqs.filter((x) => x.fulfilled_store_id === store.id).length;
    const times = t
      .filter((x) => x.response_time_seconds != null)
      .map((x) => x.response_time_seconds as number);
    return {
      id: store.id,
      name: store.name,
      responseRate: Math.round((r.length / Math.max(t.length, 1)) * 100),
      finds,
      avgSeconds: average(times),
    };
  });

  return {
    totalCustomers: totalCustomers || 0,
    approvedStores: approvedStores || 0,
    pendingApplications,
    activeRequests,
    completedRequests,
    requestsToday,
    responseRate: Math.round(
      ((responses || []).length / Math.max((targets || []).length, 1)) * 100
    ),
    successfulFindRate: Math.round(
      (confirmedFound.length / Math.max(reqs.length, 1)) * 100
    ),
    avgFirstResponseSeconds: average(firstSecs),
    medianFirstResponseSeconds: median(firstSecs),
    storesRespondingToday,
    funnel: {
      created: reqs.length,
      routed: reqs.filter((r) => r.stores_targeted > 0).length,
      withResponse: withResponse.size,
      withInStock: withInStock.size,
      confirmedFound: confirmedFound.length,
    },
    topCategories: [...catCounts.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8),
    topProducts: [...productCounts.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8),
    zeroResponseRequests: reqs
      .filter((r) => r.stores_targeted > 0 && !withResponse.has(r.id))
      .slice(0, 20)
      .map((r) => ({
        id: r.id,
        product_name: r.product_name,
        created_at: r.created_at,
      })),
    highestPerformingStores: [...storePerf]
      .sort((a, b) => b.responseRate - a.responseRate || b.finds - a.finds)
      .slice(0, 5)
      .map(({ id, name, responseRate, finds }) => ({ id, name, responseRate, finds })),
    slowestStores: [...storePerf]
      .filter((s) => s.avgSeconds != null)
      .sort((a, b) => (b.avgSeconds || 0) - (a.avgSeconds || 0))
      .slice(0, 5)
      .map(({ id, name, avgSeconds }) => ({ id, name, avgSeconds })),
  };
}

export async function isPilotModeAction() {
  return isPilotMode();
}

export async function updateStoreProfileAction(
  storeId: string,
  input: {
    name?: string;
    description?: string | null;
    phone?: string | null;
    website?: string | null;
    streetAddress?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    ageRestricted?: boolean;
  }
) {
  const id = boundUuid(storeId);
  if (!id) return { error: "Unauthorized" };
  const profile = await getCurrentProfile();
  if (!profile) return { error: "Unauthorized" };
  const { supabase, user } = await getSupabaseUser();
  if (!user) return { error: "Unauthorized" };
  const { data: membership } = await supabase
    .from("store_members")
    .select("role")
    .eq("store_id", id)
    .eq("user_id", user.id)
    .eq("status", "active")
    .maybeSingle();
  if (!membership || (membership.role !== "owner" && membership.role !== "manager")) {
    return { error: "Only owners and managers can update store profile" };
  }
  const patch: Record<string, unknown> = {};
  if (input.name != null) patch.name = input.name.trim();
  if (input.description !== undefined) patch.description = input.description;
  if (input.phone !== undefined) patch.phone = input.phone;
  if (input.website !== undefined) patch.website = input.website;
  if (
    input.streetAddress != null ||
    input.city != null ||
    input.state != null ||
    input.postalCode != null
  ) {
    const location = normalizeStoreLocation({
      streetAddress: input.streetAddress ?? "",
      city: input.city ?? "",
      state: input.state ?? "",
      postalCode: input.postalCode ?? "",
    });
    if (input.streetAddress != null) patch.street_address = location.street;
    if (input.city != null) patch.city = location.city;
    if (input.state != null) patch.state = location.state;
    if (input.postalCode != null) patch.postal_code = location.postalCode;
  }
  if (input.ageRestricted != null) patch.age_restricted = input.ageRestricted;
  const { error } = await supabase.from("stores").update(patch).eq("id", id);
  if (error) return { error: "Couldn't save store profile." };
  return { ok: true };
}

export async function setMemberStatusAction(
  storeId: string,
  memberId: string,
  status: "active" | "disabled"
) {
  const profile = await getCurrentProfile();
  if (!profile) return { error: "Unauthorized" };

  if (isDemoMode()) {
    const state = getDemoState();
    const actor = state.storeMembers.find(
      (m) =>
        m.store_id === storeId &&
        m.user_id === profile.id &&
        m.status === "active" &&
        (m.role === "owner" || m.role === "manager")
    );
    if (!actor) return { error: "Only owners and managers can change staff status" };
    const target = state.storeMembers.find((m) => m.id === memberId && m.store_id === storeId);
    if (!target || target.role === "owner") return { error: "Couldn't update that teammate." };
    target.status = status;
    return { ok: true };
  }

  const { supabase, user } = await getSupabaseUser();
  if (!user) return { error: "Unauthorized" };
  const { data: membership } = await supabase
    .from("store_members")
    .select("role")
    .eq("store_id", storeId)
    .eq("user_id", user.id)
    .eq("status", "active")
    .maybeSingle();
  if (!membership || (membership.role !== "owner" && membership.role !== "manager")) {
    return { error: "Only owners and managers can change staff status" };
  }
  const { error } = await supabase
    .from("store_members")
    .update({ status })
    .eq("id", memberId)
    .eq("store_id", storeId)
    .neq("role", "owner");
  if (error) return { error: "Couldn't update that teammate." };
  return { ok: true };
}

export async function setStoreSuspendedAction(storeId: string, suspended: boolean) {
  const profile = await getCurrentProfile();
  if (!isSoloAdmin(profile)) return { error: "Admin only" };
  const { createServiceClient } = await import("@/lib/supabase/admin");
  const admin = createServiceClient();
  const { error } = await admin
    .from("stores")
    .update({ is_suspended: suspended, is_active: suspended ? false : true })
    .eq("id", storeId);
  if (error) return { error: "Couldn't update store status." };
  return { ok: true };
}

export async function submitReportAction(raw: unknown) {
  const parsed = reportSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message || "Tell us what happened." };
  }
  const profile = await getCurrentProfile();
  if (!profile) return { error: "Please sign in" };

  const limited = await consumeRateLimit({
    bucket: "report",
    limit: 8,
    windowMs: 60 * 60_000,
    key: profile.id,
  });
  if (!limited.ok) return { error: limited.error };

  if (isDemoMode()) {
    void notifySupportInbox({
      kind: "report",
      subject: `Report: ${parsed.data.reason}`,
      heading: "New report",
      body: [
        `Reason: ${parsed.data.reason}`,
        parsed.data.description ? `Details: ${parsed.data.description}` : null,
        parsed.data.requestId ? `Request: ${parsed.data.requestId}` : null,
        parsed.data.storeId ? `Store: ${parsed.data.storeId}` : null,
        `From: ${profile.email || profile.id}`,
      ]
        .filter(Boolean)
        .join("\n"),
      replyTo: profile.email,
    });
    return { ok: true as const };
  }

  const { supabase, user } = await getSupabaseUser();
  if (!user) return { error: "Please sign in" };
  const { error } = await supabase.from("reports").insert({
    reported_by: user.id,
    reason: parsed.data.reason,
    description: parsed.data.description || null,
    request_id: parsed.data.requestId || null,
    store_id: parsed.data.storeId || null,
  });
  if (error) return { error: "Couldn't send that report." };
  void notifySupportInbox({
    kind: "report",
    subject: `Report: ${parsed.data.reason}`,
    heading: "New report",
    body: [
      `Reason: ${parsed.data.reason}`,
      parsed.data.description ? `Details: ${parsed.data.description}` : null,
      parsed.data.requestId ? `Request: ${parsed.data.requestId}` : null,
      parsed.data.storeId ? `Store: ${parsed.data.storeId}` : null,
      `From: ${profile.email || user.email || user.id}`,
    ]
      .filter(Boolean)
      .join("\n"),
    replyTo: profile.email || user.email,
  });
  return { ok: true as const };
}

export async function getAdminReportsAction() {
  const profile = await getCurrentProfile();
  if (!isSoloAdmin(profile)) return [];
  const { createServiceClient } = await import("@/lib/supabase/admin");
  const admin = createServiceClient();
  const { data } = await admin
    .from("reports")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(100);
  return data || [];
}

export async function getAdminActivityAction() {
  const profile = await getCurrentProfile();
  if (!isSoloAdmin(profile)) return [];
  const { createServiceClient } = await import("@/lib/supabase/admin");
  const admin = createServiceClient();
  const { data } = await admin
    .from("analytics_events")
    .select("id, event_name, store_id, request_id, created_at")
    .order("created_at", { ascending: false })
    .limit(40);
  return data || [];
}

