/**
 * In-memory backend for Vitest / offline unit tests.
 * Enabled only when FINDIT_DEMO_MODE=true — never auto-enabled for missing keys.
 * Never use in production.
 */

import { randomUUID } from "crypto";
import type {
  CustomerRequest,
  DemandItem,
  Notification,
  Profile,
  RequestTarget,
  Store,
  StoreApplication,
  StoreDevice,
  StoreMetrics,
  StoreResponse,
  StoreMember,
  DevicePairingCode,
} from "@/types/database";
import { normalizeProductName, slugify } from "@/lib/utils";
import { STORE_PLANS, STORE_TRIAL_DAYS } from "@/lib/config/constants";
import { bypassConsumerPlanLimits, bypassPlanLimits } from "@/lib/config/env";
import {
  AGE_RESTRICTED_ID_REQUIRED,
  DEMO_PHONE_OTP,
  accountDeletionBlockReason,
  createdInMonthlyFindWindow,
  customerNeedsFirstName,
  getConsumerEntitlements,
  isAgeRestrictedFind,
  isSoloAdmin,
  MAX_CUSTOMER_RADIUS_MILES,
} from "@findit/domain";
import { selectEligibleStores } from "@/lib/services/routing";
import {
  canRebroadcastStillLooking,
  deriveRequestStatus,
  isNearDuplicateRequest,
  responseTimeSeconds,
  average,
  median,
} from "@/lib/services/request-lifecycle";
import { isStoreOpenAt } from "@/lib/services/store-hours";
import {
  generatePairingCode,
  generateSecret,
  hashPairingCode,
  sha256Hex,
} from "@/lib/hub/crypto";
import { HUB_PAIRING_TTL_MS } from "@/lib/hub/constants";
import type { PilotAdminStats } from "@/types/database";

type SessionUser = { id: string; email: string | null };

interface DemoState {
  profiles: Profile[];
  stores: Store[];
  storeCategories: { store_id: string; category: string }[];
  storeServiceAreas: { store_id: string; postal_code: string; city?: string; state?: string }[];
  storeHours: {
    store_id: string;
    day_of_week: number;
    open_time: string | null;
    close_time: string | null;
    is_closed: boolean;
  }[];
  storeMembers: StoreMember[];
  requests: CustomerRequest[];
  targets: RequestTarget[];
  responses: StoreResponse[];
  notifications: Notification[];
  savedRequests: { id: string; customer_id: string; request_id: string; created_at: string }[];
  invites: {
    id: string;
    store_id: string;
    email: string;
    role: "manager" | "employee";
    token: string;
    expires_at: string;
    accepted_at: string | null;
    invitee_name?: string | null;
  }[];
  prohibitedTerms: string[];
  locationDemand: {
    id: string;
    city: string;
    state: string;
    postal_code: string;
    product_name?: string;
    notify_email?: string;
  }[];
  events: { event_name: string; user_id?: string; store_id?: string; request_id?: string; created_at: string }[];
  storeApplications: StoreApplication[];
  storeDevices: StoreDevice[];
  devicePairings: DevicePairingCode[];
  sessions: Record<string, SessionUser>;
  currentSessionId: string | null;
  phoneOtps: Record<string, { sentAt: number }>;
}

const g = globalThis as typeof globalThis & { __finditDemo?: DemoState };

function now() {
  return new Date().toISOString();
}

function hoursFromNow(h: number) {
  return new Date(Date.now() + h * 60 * 60 * 1000).toISOString();
}

function seedState(): DemoState {
  const customerId = "11111111-1111-1111-1111-111111111111";
  const ownerId = "22222222-2222-2222-2222-222222222222";
  const employeeId = "33333333-3333-3333-3333-333333333333";
  const adminId = "44444444-4444-4444-4444-444444444444";

  const profiles: Profile[] = [
    {
      id: customerId,
      email: "customer@demo.findit.local",
      first_name: "Jordan",
      last_name: "Lee",
      display_name: "Jordan",
      avatar_url: null,
      account_type: "customer",
      subscription_plan: "free",
      default_city: "Falls Church",
      default_state: "VA",
      default_postal_code: "22044",
      notify_in_stock: true,
      notify_can_order: true,
      notify_request_expired: true,
      notify_new_request: true,
      notify_demand_alerts: true,
      is_suspended: false,
      phone_e164: null,
      created_at: now(),
      updated_at: now(),
    },
    {
      id: ownerId,
      email: "owner@demo.findit.local",
      first_name: "Alex",
      last_name: "Martinez",
      display_name: "Alex",
      avatar_url: null,
      account_type: "business",
      subscription_plan: "free",
      default_city: "Falls Church",
      default_state: "VA",
      default_postal_code: "22044",
      notify_in_stock: true,
      notify_can_order: true,
      notify_request_expired: true,
      notify_new_request: true,
      notify_demand_alerts: true,
      is_suspended: false,
      phone_e164: null,
      created_at: now(),
      updated_at: now(),
    },
    {
      id: employeeId,
      email: "employee@demo.findit.local",
      first_name: "Sam",
      last_name: "Nguyen",
      display_name: "Sam",
      avatar_url: null,
      account_type: "business",
      subscription_plan: "free",
      default_city: "Falls Church",
      default_state: "VA",
      default_postal_code: "22044",
      notify_in_stock: true,
      notify_can_order: true,
      notify_request_expired: true,
      notify_new_request: true,
      notify_demand_alerts: false,
      is_suspended: false,
      phone_e164: null,
      created_at: now(),
      updated_at: now(),
    },
    {
      id: adminId,
      email: "ceo@askfindit.com",
      first_name: "Admin",
      last_name: "User",
      display_name: "Admin",
      avatar_url: null,
      account_type: "admin",
      subscription_plan: "plus",
      default_city: "Falls Church",
      default_state: "VA",
      default_postal_code: "22044",
      notify_in_stock: true,
      notify_can_order: true,
      notify_request_expired: true,
      notify_new_request: true,
      notify_demand_alerts: true,
      is_suspended: false,
      phone_e164: null,
      created_at: now(),
      updated_at: now(),
    },
  ];

  const storeDefs = [
    { name: "ABC Market", slug: "abc-market", zip: "22044", cats: ["Grocery", "Convenience"] },
    { name: "Local Market", slug: "local-market", zip: "22042", cats: ["Grocery"] },
    { name: "Corner Convenience", slug: "corner-convenience", zip: "22044", cats: ["Convenience"] },
    { name: "Falls Beauty Bar", slug: "falls-beauty-bar", zip: "22046", cats: ["Beauty"] },
    { name: "Tech Shelf Electronics", slug: "tech-shelf", zip: "22044", cats: ["Electronics"] },
    { name: "AutoRight Parts", slug: "autoright-parts", zip: "22041", cats: ["Auto Parts"] },
    { name: "Hardware Haven", slug: "hardware-haven", zip: "22043", cats: ["Hardware"] },
    { name: "Collectible Corner", slug: "collectible-corner", zip: "22044", cats: ["Collectibles"] },
  ];

  const stores: Store[] = storeDefs.map((s, i) => ({
    id: `store-0000-0000-0000-00000000000${i + 1}`,
    owner_id: ownerId,
    name: s.name,
    slug: s.slug,
    description: `${s.name} serving Falls Church and nearby.`,
    phone: "703-555-010" + i,
    website: null,
    street_address: `${100 + i * 10} Broad St`,
    city: "Falls Church",
    state: "VA",
    postal_code: s.zip,
    country: "US",
    latitude: null,
    longitude: null,
    is_active: true,
    is_verified: i < 3,
    is_suspended: false,
    age_restricted: false,
    subscription_plan: i === 0 ? "starter" : "free",
    subscription_status: "active",
    trial_ends_at:
      i === 0
        ? null
        : new Date(Date.now() + STORE_TRIAL_DAYS * 86400000).toISOString(),
    avg_response_minutes: 8 + i,
    service_radius_miles: 10,
    created_at: now(),
    updated_at: now(),
  }));

  const storeCategories = stores.flatMap((store, i) =>
    storeDefs[i].cats.map((category) => ({ store_id: store.id, category }))
  );

  const storeServiceAreas = stores.flatMap((store) => {
    const zips = new Set([store.postal_code, "22044", "22042", "22046"]);
    return [...zips].map((postal_code) => ({
      store_id: store.id,
      postal_code,
      city: "Falls Church",
      state: "VA",
    }));
  });

  const storeMembers: StoreMember[] = [
    {
      id: randomUUID(),
      store_id: stores[0].id,
      user_id: ownerId,
      role: "owner",
      status: "active",
      created_at: now(),
    },
    {
      id: randomUUID(),
      store_id: stores[0].id,
      user_id: employeeId,
      role: "employee",
      status: "active",
      created_at: now(),
    },
    ...stores.slice(1).map((store) => ({
      id: randomUUID(),
      store_id: store.id,
      user_id: ownerId,
      role: "owner" as const,
      status: "active" as const,
      created_at: now(),
    })),
  ];

  const products = [
    "Cherry Coke Zero 12 Pack",
    "Red Bull Sea Blue Edition",
    "Black iPhone 16 case",
    "Blue Takis",
    "Canon LP-E6 battery",
    "Nike Air Max size 10",
    "Olaplex No.3",
    "WD-40 Smart Straw",
  ];

  const requests: CustomerRequest[] = products.map((product_name, i) => ({
    id: `req-0000-0000-0000-00000000000${i + 1}`,
    customer_id: customerId,
    product_name,
    normalized_product_name: normalizeProductName(product_name),
    description: i === 0 ? "Looking specifically for the 12-pack cans." : null,
    image_url: null,
    category: i < 2 ? "Grocery" : i === 2 ? "Electronics" : null,
    city: "Falls Church",
    state: "VA",
    postal_code: "22044",
    radius_miles: 10,
    status: i < 3 ? "active" : i < 5 ? "answered" : "expired",
    expires_at: hoursFromNow(i < 3 ? 20 : -2),
    stores_targeted: 4,
    created_at: new Date(Date.now() - (i + 1) * 3600_000).toISOString(),
    updated_at: now(),
  }));

  // Extra demand for Red Bull so analytics demo works
  for (let n = 0; n < 12; n++) {
    requests.push({
      id: randomUUID(),
      customer_id: customerId,
      product_name: "Red Bull Sea Blue Edition",
      normalized_product_name: "red bull sea blue edition",
      description: null,
      image_url: null,
      category: "Grocery",
      city: "Falls Church",
      state: "VA",
      postal_code: "22044",
      radius_miles: 10,
      status: "answered",
      expires_at: hoursFromNow(-1),
      stores_targeted: 3,
      created_at: new Date(Date.now() - (n + 2) * 7200_000).toISOString(),
      updated_at: now(),
    });
  }

  const targets: RequestTarget[] = [];
  const responses: StoreResponse[] = [];

  for (const req of requests) {
    const eligible = stores.slice(0, 4);
    for (const store of eligible) {
      targets.push({
        id: randomUUID(),
        request_id: req.id,
        store_id: store.id,
        delivery_status: "sent",
        viewed_at: null,
        route_sent_at: req.created_at,
        opened_at: null,
        responded_at: null,
        response_time_seconds: null,
        notify_after: null,
        was_closed_at_route: false,
        created_at: req.created_at,
      });
    }
  }

  // Seed out-of-stock responses for Red Bull at ABC Market for demand analytics
  const redBullReqs = requests.filter(
    (r) => r.normalized_product_name === "red bull sea blue edition"
  );
  for (const req of redBullReqs.slice(0, 10)) {
    responses.push({
      id: randomUUID(),
      request_id: req.id,
      store_id: stores[0].id,
      responded_by: employeeId,
      response_type: "out_of_stock",
      price: null,
      quantity: null,
      note: null,
      hold_minutes: null,
      estimated_available_at: null,
      estimated_availability_label: null,
      track_demand: true,
      created_at: req.created_at,
      updated_at: req.created_at,
    });
  }

  return {
    profiles,
    stores,
    storeCategories,
    storeServiceAreas,
    storeHours: stores.flatMap((store) =>
      Array.from({ length: 7 }, (_, day) => ({
        store_id: store.id,
        day_of_week: day,
        open_time: day === 0 ? null : "09:00",
        close_time: day === 0 ? null : "21:00",
        is_closed: day === 0,
      }))
    ),
    storeMembers,
    requests,
    targets,
    responses,
    notifications: [],
    savedRequests: [],
    invites: [],
    prohibitedTerms: ["cocaine", "heroin", "fentanyl", "illegal drugs", "stolen goods"],
    locationDemand: [],
    events: [],
    storeApplications: [
      {
        id: "app-0000-0000-0000-000000000001",
        business_name: "Sunrise Corner Market",
        business_type: "Convenience",
        street_address: "412 W Broad St",
        city: "Falls Church",
        state: "VA",
        postal_code: "22046",
        phone: "703-555-0199",
        website: null,
        owner_name: "Pat Rivera",
        owner_email: "pat@sunrisecorner.example",
        owner_phone: "703-555-0198",
        why_legit:
          "We are a licensed convenience store in Falls Church serving the neighborhood for 8 years. Want to answer local product asks during the pilot.",
        confirmed_legitimate: true,
        request_categories: ["Grocery", "Convenience"],
        requires_customer_id: false,
        status: "pending",
        applicant_user_id: null,
        admin_notes: null,
        applicant_reply: null,
        reviewed_at: null,
        reviewed_by: null,
        created_at: now(),
        updated_at: now(),
      },
    ],
    storeDevices: [],
    devicePairings: [],
    sessions: {},
    currentSessionId: null,
    phoneOtps: {},
  };
}

export function getDemoState(): DemoState {
  if (!g.__finditDemo) {
    g.__finditDemo = seedState();
  }
  return g.__finditDemo;
}

export function resetDemoState() {
  g.__finditDemo = seedState();
  return g.__finditDemo;
}

export const DEMO_PASSWORDS: Record<string, string> = {
  "customer@demo.findit.local": "demo1234",
  "owner@demo.findit.local": "demo1234",
  "employee@demo.findit.local": "demo1234",
  "ceo@askfindit.com": "demo1234",
};

export function demoLogin(email: string, password: string): Profile | null {
  const state = getDemoState();
  if (DEMO_PASSWORDS[email.toLowerCase()] !== password) return null;
  const profile = state.profiles.find(
    (p) => p.email && p.email.toLowerCase() === email.toLowerCase()
  );
  if (!profile || profile.is_suspended) return null;
  const sessionId = randomUUID();
  state.sessions[sessionId] = { id: profile.id, email: profile.email };
  state.currentSessionId = sessionId;
  return profile;
}

export function demoLoginWithSession(
  email: string,
  password: string
): { profile: Profile; sessionId: string } | null {
  const profile = demoLogin(email, password);
  if (!profile) return null;
  const state = getDemoState();
  return { profile, sessionId: state.currentSessionId! };
}

export function demoSignup(input: {
  email: string;
  password: string;
  firstName: string;
  lastName?: string;
  accountType: "customer" | "business";
  city?: string;
  state?: string;
  postalCode?: string;
}): Profile {
  const state = getDemoState();
  if (
    state.profiles.some(
      (p) => p.email && p.email.toLowerCase() === input.email.toLowerCase()
    )
  ) {
    throw new Error("An account with this email already exists.");
  }
  const profile: Profile = {
    id: randomUUID(),
    email: input.email.toLowerCase(),
    first_name: input.firstName,
    last_name: input.lastName || null,
    display_name: input.firstName,
    avatar_url: null,
    account_type: input.accountType,
    subscription_plan: "free",
    default_city: input.city || null,
    default_state: input.state || "VA",
    default_postal_code: input.postalCode || null,
    notify_in_stock: true,
    notify_can_order: true,
    notify_request_expired: true,
    notify_new_request: true,
    notify_demand_alerts: true,
    is_suspended: false,
    phone_e164: null,
    created_at: now(),
    updated_at: now(),
  };
  state.profiles.push(profile);
  DEMO_PASSWORDS[profile.email!] = input.password;
  const sessionId = randomUUID();
  state.sessions[sessionId] = { id: profile.id, email: profile.email };
  state.currentSessionId = sessionId;
  track("account_created", { user_id: profile.id });
  return profile;
}

export function demoSignupWithSession(input: {
  email: string;
  password: string;
  firstName: string;
  lastName?: string;
  accountType: "customer" | "business";
  city?: string;
  state?: string;
  postalCode?: string;
}): { profile: Profile; sessionId: string } {
  const profile = demoSignup(input);
  const state = getDemoState();
  return { profile, sessionId: state.currentSessionId! };
}

export function demoSendPhoneOtp(phoneE164: string): { phone: string } {
  const state = getDemoState();
  state.phoneOtps[phoneE164] = { sentAt: Date.now() };
  return { phone: phoneE164 };
}

export function demoVerifyPhoneOtp(
  phoneE164: string,
  token: string,
  createIfMissing: boolean
): { profile: Profile; sessionId: string; needsName: boolean } {
  if (token !== DEMO_PHONE_OTP) {
    throw new Error("That code is incorrect.");
  }
  const state = getDemoState();
  let profile = state.profiles.find((p) => p.phone_e164 === phoneE164) || null;
  if (!profile) {
    if (!createIfMissing) {
      throw new Error("No FINDIT account for this number yet. Sign up to continue.");
    }
    profile = {
      id: randomUUID(),
      email: null,
      phone_e164: phoneE164,
      first_name: "",
      last_name: null,
      display_name: "Customer",
      avatar_url: null,
      account_type: "customer",
      subscription_plan: "free",
      default_city: null,
      default_state: "VA",
      default_postal_code: null,
      notify_in_stock: true,
      notify_can_order: true,
      notify_request_expired: true,
      notify_new_request: true,
      notify_demand_alerts: true,
      is_suspended: false,
      created_at: now(),
      updated_at: now(),
    };
    state.profiles.push(profile);
    track("account_created", { user_id: profile.id });
  }
  const sessionId = randomUUID();
  state.sessions[sessionId] = { id: profile.id, email: profile.email };
  state.currentSessionId = sessionId;
  return {
    profile,
    sessionId,
    needsName: customerNeedsFirstName(profile),
  };
}

export function demoSetFirstName(userId: string, firstName: string): Profile {
  const state = getDemoState();
  const profile = state.profiles.find((p) => p.id === userId);
  if (!profile) throw new Error("Profile not found");
  profile.first_name = firstName;
  profile.display_name = firstName;
  profile.updated_at = now();
  return profile;
}

export function demoCurrentUser(sessionId?: string | null): Profile | null {
  const state = getDemoState();
  const sid = sessionId ?? state.currentSessionId;
  if (!sid) return null;
  const session = state.sessions[sid];
  if (!session) return null;
  return state.profiles.find((p) => p.id === session.id) || null;
}

export function demoLogout(sessionId?: string | null) {
  const state = getDemoState();
  const sid = sessionId ?? state.currentSessionId;
  if (sid) delete state.sessions[sid];
  if (state.currentSessionId === sid) state.currentSessionId = null;
}

export function demoDeleteAccount(
  sessionId?: string | null
): { ok: true } | { error: string } {
  const profile = demoCurrentUser(sessionId);
  if (!profile) return { error: "Unauthorized" };
  const state = getDemoState();
  const ownedStoreNames = state.stores
    .filter((store) => store.owner_id === profile.id)
    .map((store) => store.name);
  const blocked = accountDeletionBlockReason({
    isOperator: isSoloAdmin(profile),
    ownedStoreNames,
  });
  if (blocked) return { error: blocked };

  for (const response of state.responses) {
    if (response.responded_by !== profile.id) continue;
    const store = state.stores.find((item) => item.id === response.store_id);
    if (store && store.owner_id !== profile.id) {
      response.responded_by = store.owner_id;
    }
  }

  const userId = profile.id;
  state.requests = state.requests.filter((request) => request.customer_id !== userId);
  state.notifications = state.notifications.filter(
    (notification) => notification.user_id !== userId
  );
  state.savedRequests = state.savedRequests.filter(
    (saved) => saved.customer_id !== userId
  );
  state.storeMembers = state.storeMembers.filter((member) => member.user_id !== userId);
  state.profiles = state.profiles.filter((item) => item.id !== userId);
  demoLogout(sessionId);
  return { ok: true };
}

export const DEMO_SESSION_COOKIE = "findit_demo_session";

export function demoSetCurrentUser(userId: string | null) {
  const state = getDemoState();
  if (!userId) {
    state.currentSessionId = null;
    return;
  }
  const profile = state.profiles.find((p) => p.id === userId);
  if (!profile) return;
  const sessionId = randomUUID();
  state.sessions[sessionId] = { id: profile.id, email: profile.email };
  state.currentSessionId = sessionId;
}

function track(event_name: string, meta: { user_id?: string; store_id?: string; request_id?: string }) {
  getDemoState().events.push({ event_name, ...meta, created_at: now() });
}

export function demoRouteRequestToStores(requestId: string): number {
  const state = getDemoState();
  const request = state.requests.find((r) => r.id === requestId);
  if (!request) return 0;

  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const candidates = state.stores.map((store) => {
    const monthTargets = state.targets.filter(
      (t) => t.store_id === store.id && new Date(t.created_at) >= monthStart
    ).length;
    return {
      id: store.id,
      is_active: store.is_active,
      is_suspended: store.is_suspended,
      is_verified: store.is_verified,
      postal_code: store.postal_code,
      city: store.city,
      service_radius_miles: store.service_radius_miles ?? 10,
      subscription_plan: store.subscription_plan,
      categories: state.storeCategories
        .filter((c) => c.store_id === store.id)
        .map((c) => c.category),
      service_zips: state.storeServiceAreas
        .filter((a) => a.store_id === store.id)
        .map((a) => a.postal_code),
      month_targets_received: monthTargets,
      free_plan_monthly_cap: STORE_PLANS.free.monthlyRequests,
      latitude: store.latitude,
      longitude: store.longitude,
    };
  });

  const already = new Set(
    state.targets.filter((t) => t.request_id === requestId).map((t) => t.store_id)
  );

  const { eligible } = selectEligibleStores({
    request: {
      id: request.id,
      postal_code: request.postal_code,
      city: request.city,
      category: request.category,
      radius_miles: request.radius_miles,
      latitude: request.latitude,
      longitude: request.longitude,
    },
    stores: candidates,
    alreadyTargetedStoreIds: already,
    bypassPlanCaps: bypassPlanLimits(),
  });

  for (const decision of eligible) {
    const store = state.stores.find((s) => s.id === decision.storeId)!;
    const hours = state.storeHours.filter((h) => h.store_id === store.id);
    const openInfo = isStoreOpenAt(hours);
    const notifyAfter =
      !openInfo.open && openInfo.reopenAt ? openInfo.reopenAt.toISOString() : null;

    state.targets.push({
      id: randomUUID(),
      request_id: requestId,
      store_id: store.id,
      delivery_status: "sent",
      viewed_at: null,
      route_sent_at: now(),
      opened_at: null,
      responded_at: null,
      response_time_seconds: null,
      notify_after: notifyAfter,
      was_closed_at_route: !openInfo.open,
      created_at: now(),
    });

    // Don't repeatedly notify closed stores — wait until reopen
    if (notifyAfter && new Date(notifyAfter).getTime() > Date.now()) {
      continue;
    }

    const members = state.storeMembers.filter(
      (m) => m.store_id === store.id && m.status === "active" && m.user_id
    );
    for (const member of members) {
      const profile = state.profiles.find((p) => p.id === member.user_id);
      if (!profile?.notify_new_request) continue;
      state.notifications.push({
        id: randomUUID(),
        user_id: member.user_id!,
        type: "new_request",
        title: "New product request",
        body: `New request nearby: ${request.product_name}`,
        related_request_id: request.id,
        related_store_id: store.id,
        read_at: null,
        created_at: now(),
      });
    }
  }

  request.stores_targeted = state.targets.filter((t) => t.request_id === requestId).length;
  request.updated_at = now();
  track("request_routed", { request_id: requestId });
  return request.stores_targeted;
}

export function demoCreateRequest(input: {
  customerId: string;
  productName: string;
  description?: string;
  category?: string;
  city: string;
  state: string;
  postalCode: string;
  radiusMiles: number;
  expirationHours: number;
  imageUrl?: string | null;
  imageStoragePath?: string | null;
  forceDuplicate?: boolean;
  latitude?: number | null;
  longitude?: number | null;
  ageRestrictedConfirmed?: boolean;
}): {
  request: CustomerRequest;
  storesTargeted: number;
  blocked?: string;
  duplicateOf?: string;
} {
  const state = getDemoState();
  const normalized = normalizeProductName(input.productName);
  if (
    isAgeRestrictedFind({
      category: input.category,
      productName: input.productName,
      description: input.description,
    }) &&
    !input.ageRestrictedConfirmed
  ) {
    return {
      request: null as unknown as CustomerRequest,
      storesTargeted: 0,
      blocked: AGE_RESTRICTED_ID_REQUIRED,
    };
  }
  for (const term of state.prohibitedTerms) {
    if (normalized.includes(term)) {
      return {
        request: null as unknown as CustomerRequest,
        storesTargeted: 0,
        blocked: "This request contains a prohibited term.",
      };
    }
  }

  if (!input.forceDuplicate) {
    const dup = isNearDuplicateRequest({
      normalizedProductName: normalized,
      category: input.category,
      existing: state.requests.filter((r) => r.customer_id === input.customerId),
    });
    if (dup.duplicate) {
      const existing = state.requests.find(
        (r) =>
          r.customer_id === input.customerId &&
          r.normalized_product_name === normalized &&
          ["active", "partially_answered", "answered"].includes(r.status)
      );
      return {
        request: existing || (null as unknown as CustomerRequest),
        storesTargeted: existing?.stores_targeted || 0,
        duplicateOf: existing?.id,
        blocked: "You already have an active request for this.",
      };
    }
  }

  const hourAgo = Date.now() - 60 * 60 * 1000;
  const recent = state.requests.filter(
    (r) =>
      r.customer_id === input.customerId &&
      new Date(r.created_at).getTime() > hourAgo &&
      ["active", "partially_answered", "answered", "draft"].includes(r.status)
  );
  if (recent.length >= 10) {
    return {
      request: null as unknown as CustomerRequest,
      storesTargeted: 0,
      blocked: "You can create up to 10 requests per hour.",
    };
  }

  const customer = state.profiles.find((p) => p.id === input.customerId);
  const entitlements = getConsumerEntitlements(customer?.subscription_plan);
  if (!bypassConsumerPlanLimits()) {
    const monthCount = state.requests.filter(
      (r) =>
        r.customer_id === input.customerId &&
        createdInMonthlyFindWindow(r.created_at)
    ).length;
    if (monthCount >= entitlements.monthlyRequestLimit) {
      return {
        request: null as unknown as CustomerRequest,
        storesTargeted: 0,
        blocked:
          entitlements.planId === "free"
            ? `You've used your ${entitlements.monthlyRequestLimit} free Finds this month.`
            : `FINDIT+ includes ${entitlements.monthlyRequestLimit} Finds per month.`,
      };
    }
  }

  if (input.radiusMiles > MAX_CUSTOMER_RADIUS_MILES) {
    return {
      request: null as unknown as CustomerRequest,
      storesTargeted: 0,
      blocked: `FINDIT searches up to ${MAX_CUSTOMER_RADIUS_MILES} miles.`,
    };
  }

  const request: CustomerRequest = {
    id: randomUUID(),
    customer_id: input.customerId,
    product_name: input.productName.trim(),
    normalized_product_name: normalized,
    description: input.description || null,
    image_url: input.imageUrl || null,
    image_storage_path: input.imageStoragePath || null,
    category: input.category || null,
    city: input.city,
    state: input.state,
    postal_code: input.postalCode,
    radius_miles: input.radiusMiles,
    latitude: input.latitude ?? null,
    longitude: input.longitude ?? null,
    status: "active",
    expires_at: hoursFromNow(input.expirationHours),
    stores_targeted: 0,
    fulfilled_at: null,
    fulfilled_store_id: null,
    found_with_findit: null,
    still_looking_count: 0,
    last_rebroadcast_at: null,
    created_at: now(),
    updated_at: now(),
  };
  state.requests.unshift(request);
  track("request_created", { user_id: input.customerId, request_id: request.id });
  const storesTargeted = demoRouteRequestToStores(request.id);
  if (storesTargeted === 0) {
    state.locationDemand.push({
      id: randomUUID(),
      city: input.city,
      state: input.state,
      postal_code: input.postalCode,
      product_name: input.productName,
    });
  }
  return { request, storesTargeted };
}

export function demoRespondToRequest(input: {
  requestId: string;
  storeId: string;
  userId: string;
  responseType: "in_stock" | "out_of_stock" | "can_order" | "not_relevant";
  price?: number | null;
  quantity?: number | null;
  note?: string;
  holdMinutes?: number | null;
  estimatedAvailabilityLabel?: string;
  availabilityAmount?: "plenty" | "few_left" | "last_one" | null;
  trackDemand?: boolean;
}): StoreResponse {
  const state = getDemoState();
  const request = state.requests.find((r) => r.id === input.requestId);
  if (!request) throw new Error("Request not found");
  if (request.status === "cancelled") throw new Error("Request was cancelled");
  if (request.status === "fulfilled") throw new Error("Customer already found this item");
  if (new Date(request.expires_at).getTime() < Date.now() || request.status === "expired") {
    throw new Error("This request has expired");
  }
  const member = state.storeMembers.find(
    (m) =>
      m.store_id === input.storeId &&
      m.user_id === input.userId &&
      m.status === "active"
  );
  if (!member) throw new Error("Not a store member");
  const target = state.targets.find(
    (t) => t.request_id === input.requestId && t.store_id === input.storeId
  );
  if (!target) throw new Error("Request was not sent to this store");

  const existing = state.responses.find(
    (r) => r.request_id === input.requestId && r.store_id === input.storeId
  );

  const respondedAt = now();
  const routeSent = target.route_sent_at || target.created_at;
  const secs = responseTimeSeconds(routeSent, respondedAt);

  const payload: StoreResponse = {
    id: existing?.id || randomUUID(),
    request_id: input.requestId,
    store_id: input.storeId,
    responded_by: input.userId,
    response_type: input.responseType,
    price: input.price ?? null,
    quantity: input.quantity ?? null,
    note: input.note || null,
    hold_minutes: input.holdMinutes ?? null,
    estimated_available_at: null,
    estimated_availability_label: input.estimatedAvailabilityLabel || null,
    availability_amount: input.availabilityAmount ?? null,
    track_demand: input.trackDemand ?? false,
    created_at: existing?.created_at || respondedAt,
    updated_at: respondedAt,
  };

  if (existing) {
    Object.assign(existing, payload);
  } else {
    state.responses.push(payload);
  }

  target.responded_at = respondedAt;
  target.response_time_seconds = secs;
  if (!target.opened_at) {
    target.opened_at = respondedAt;
    target.viewed_at = respondedAt;
  }

  const responseCount = state.responses.filter((r) => r.request_id === input.requestId).length;
  const targetCount = state.targets.filter((t) => t.request_id === input.requestId).length;
  request.status = deriveRequestStatus({
    responseCount,
    targetCount,
  });
  request.updated_at = now();

  const store = state.stores.find((s) => s.id === input.storeId);
  const customer = state.profiles.find((p) => p.id === request.customer_id);
  if (customer && store) {
    if (input.responseType === "in_stock" && customer.notify_in_stock) {
      state.notifications.push({
        id: randomUUID(),
        user_id: customer.id,
        type: "in_stock",
        title: `${store.name} has it in stock`,
        body: `${request.product_name}`,
        related_request_id: request.id,
        related_store_id: store.id,
        read_at: null,
        created_at: now(),
      });
    }
    if (input.responseType === "can_order" && customer.notify_can_order) {
      state.notifications.push({
        id: randomUUID(),
        user_id: customer.id,
        type: "can_order",
        title: `${store.name} can order it`,
        body: `${store.name} can order ${request.product_name}`,
        related_request_id: request.id,
        related_store_id: store.id,
        read_at: null,
        created_at: now(),
      });
    }
    if (responseCount === 1 || responseCount === 3) {
      state.notifications.push({
        id: randomUUID(),
        user_id: customer.id,
        type: "responses_update",
        title:
          responseCount === 1
            ? "A store responded to your request"
            : `${responseCount} stores responded to your request`,
        body: request.product_name,
        related_request_id: request.id,
        related_store_id: store.id,
        read_at: null,
        created_at: now(),
      });
    }
  }

  // Update rolling avg response minutes for store
  if (store) {
    const times = state.targets
      .filter((t) => t.store_id === store.id && t.response_time_seconds != null)
      .map((t) => t.response_time_seconds!);
    const avgSec = average(times);
    store.avg_response_minutes = avgSec != null ? Math.max(1, Math.round(avgSec / 60)) : store.avg_response_minutes;
  }

  track("store_response_created", {
    user_id: input.userId,
    store_id: input.storeId,
    request_id: input.requestId,
  });

  return payload;
}

export function demoFulfillRequest(input: {
  requestId: string;
  customerId: string;
  storeId?: string | null;
  foundWithFindit?: boolean | null;
}): CustomerRequest {
  const state = getDemoState();
  const request = state.requests.find(
    (r) => r.id === input.requestId && r.customer_id === input.customerId
  );
  if (!request) throw new Error("Request not found");
  request.status = "fulfilled";
  request.fulfilled_at = now();
  request.fulfilled_store_id = input.storeId || null;
  request.found_with_findit = input.foundWithFindit ?? null;
  request.updated_at = now();
  track("request_fulfilled", {
    user_id: input.customerId,
    request_id: input.requestId,
    store_id: input.storeId || undefined,
  });

  if (input.storeId) {
    const members = state.storeMembers.filter(
      (m) => m.store_id === input.storeId && m.status === "active" && m.user_id
    );
    for (const m of members) {
      state.notifications.push({
        id: randomUUID(),
        user_id: m.user_id!,
        type: "customer_found",
        title: "Customer found the product",
        body: `A customer marked "${request.product_name}" as found.`,
        related_request_id: request.id,
        related_store_id: input.storeId,
        read_at: null,
        created_at: now(),
      });
    }
  }
  return request;
}

export function demoStillLooking(input: {
  requestId: string;
  customerId: string;
}): { request: CustomerRequest; storesTargeted: number } {
  const state = getDemoState();
  const request = state.requests.find(
    (r) => r.id === input.requestId && r.customer_id === input.customerId
  );
  if (!request) throw new Error("Request not found");
  const check = canRebroadcastStillLooking({
    status: request.status,
    expiresAt: request.expires_at,
    stillLookingCount: request.still_looking_count || 0,
    lastRebroadcastAt: request.last_rebroadcast_at || null,
  });
  if (!check.ok) throw new Error(check.reason || "Cannot rebroadcast");

  request.still_looking_count = (request.still_looking_count || 0) + 1;
  request.last_rebroadcast_at = now();
  request.updated_at = now();
  // Extend expiry modestly
  const extended = new Date(
    Math.max(new Date(request.expires_at).getTime(), Date.now()) + 12 * 3600_000
  );
  request.expires_at = extended.toISOString();

  // Notify stores that haven't responded yet (skip closed until reopen)
  const unanswered = state.targets.filter(
    (t) =>
      t.request_id === request.id &&
      !state.responses.some((r) => r.request_id === request.id && r.store_id === t.store_id)
  );
  for (const t of unanswered) {
    if (t.notify_after && new Date(t.notify_after).getTime() > Date.now()) continue;
    const members = state.storeMembers.filter(
      (m) => m.store_id === t.store_id && m.status === "active" && m.user_id
    );
    for (const m of members) {
      state.notifications.push({
        id: randomUUID(),
        user_id: m.user_id!,
        type: "still_looking",
        title: "Customer is still looking",
        body: `Still looking nearby: ${request.product_name}`,
        related_request_id: request.id,
        related_store_id: t.store_id,
        read_at: null,
        created_at: now(),
      });
    }
  }
  track("request_still_looking", {
    user_id: input.customerId,
    request_id: request.id,
  });
  return { request, storesTargeted: unanswered.length };
}

export function demoMarkTargetOpened(storeId: string, requestId: string, userId: string) {
  const state = getDemoState();
  const member = state.storeMembers.find(
    (m) => m.store_id === storeId && m.user_id === userId && m.status === "active"
  );
  if (!member) return;
  const target = state.targets.find(
    (t) => t.store_id === storeId && t.request_id === requestId
  );
  if (target && !target.opened_at) {
    target.opened_at = now();
    target.viewed_at = target.opened_at;
    track("store_request_opened", {
      user_id: userId,
      store_id: storeId,
      request_id: requestId,
    });
  }
}

export function demoGetStoreDemand(storeId: string): DemandItem[] {
  const state = getDemoState();
  const requestIds = state.targets.filter((t) => t.store_id === storeId).map((t) => t.request_id);
  const map = new Map<string, DemandItem>();

  for (const req of state.requests.filter((r) => requestIds.includes(r.id))) {
    if (req.status === "fulfilled" || req.status === "cancelled") {
      // Fulfilled still counts historically for demand, but not as active missed demand
    }
    const key = req.normalized_product_name;
    const item =
      map.get(key) ||
      ({
        product_name: req.product_name,
        normalized_product_name: key,
        request_count: 0,
        out_of_stock_count: 0,
        in_stock_count: 0,
        can_order_count: 0,
        unanswered_count: 0,
        out_of_stock_rate: 0,
        opportunity_score: 0,
        insight: null,
        consider_stocking: false,
      } satisfies DemandItem);
    item.request_count += 1;
    const response = state.responses.find(
      (r) => r.request_id === req.id && r.store_id === storeId
    );
    if (!response) item.unanswered_count += 1;
    if (response?.response_type === "out_of_stock") item.out_of_stock_count += 1;
    if (response?.response_type === "in_stock") item.in_stock_count += 1;
    if (response?.response_type === "can_order") item.can_order_count += 1;
    map.set(key, item);
  }

  return [...map.values()]
    .map((item) => {
      const answered =
        item.in_stock_count + item.out_of_stock_count + item.can_order_count || 1;
      item.out_of_stock_rate = item.out_of_stock_count / answered;
      item.opportunity_score = Math.round(
        item.request_count * item.out_of_stock_rate + item.unanswered_count * 0.5
      );
      item.consider_stocking =
        item.request_count >= 5 &&
        (item.out_of_stock_count + item.unanswered_count) / item.request_count >= 0.4;
      item.insight = item.consider_stocking
        ? `${item.request_count} people searched for ${item.product_name} nearby. Consider stocking this product.`
        : item.unanswered_count > 0
          ? `${item.unanswered_count} request${item.unanswered_count === 1 ? " was" : "s were"} unanswered.`
          : `${item.request_count} search${item.request_count === 1 ? "" : "es"} this period.`;
      return item;
    })
    .sort((a, b) => b.request_count - a.request_count);
}

export function demoGetStoreMetrics(storeId: string): StoreMetrics {
  const state = getDemoState();
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const week = new Date();
  week.setDate(week.getDate() - 7);

  const targetIdsToday = state.targets.filter(
    (t) => t.store_id === storeId && new Date(t.created_at) >= start
  );
  const requestIdsToday = targetIdsToday.map((t) => t.request_id);
  const responsesToday = state.responses.filter(
    (r) => r.store_id === storeId && requestIdsToday.includes(r.request_id)
  );
  const weekTargets = state.targets.filter(
    (t) => t.store_id === storeId && new Date(t.created_at) >= week
  );
  const weekResponses = state.responses.filter(
    (r) =>
      r.store_id === storeId &&
      weekTargets.some((t) => t.request_id === r.request_id)
  );
  const weekTimes = weekTargets
    .filter((t) => t.response_time_seconds != null)
    .map((t) => t.response_time_seconds!);
  const weekFinds = state.requests.filter(
    (r) =>
      r.fulfilled_store_id === storeId &&
      r.fulfilled_at &&
      new Date(r.fulfilled_at) >= week
  ).length;

  const allTargets = state.targets.filter((t) => t.store_id === storeId);
  const allResponses = state.responses.filter((r) => r.store_id === storeId);
  const answered = allResponses.length;
  const total = allTargets.length || 1;

  return {
    requests_today: targetIdsToday.length,
    answered_today: responsesToday.length,
    requests_yesterday: 0,
    answered_yesterday: 0,
    waiting_today: targetIdsToday.length - responsesToday.length,
    in_stock_today: responsesToday.filter((r) => r.response_type === "in_stock").length,
    total_received: allTargets.length,
    total_answered: answered,
    avg_response_minutes:
      state.stores.find((s) => s.id === storeId)?.avg_response_minutes ?? null,
    in_stock_pct: Math.round(
      (allResponses.filter((r) => r.response_type === "in_stock").length / total) * 100
    ),
    out_of_stock_pct: Math.round(
      (allResponses.filter((r) => r.response_type === "out_of_stock").length / total) * 100
    ),
    can_order_pct: Math.round(
      (allResponses.filter((r) => r.response_type === "can_order").length / total) * 100
    ),
    unanswered_pct: Math.round(((allTargets.length - answered) / total) * 100),
    week_received: weekTargets.length,
    week_answered: weekResponses.length,
    week_response_rate: Math.round(
      (weekResponses.length / Math.max(weekTargets.length, 1)) * 100
    ),
    week_avg_response_minutes:
      average(weekTimes) != null ? Math.max(1, Math.round(average(weekTimes)! / 60)) : null,
    week_in_stock: weekResponses.filter((r) => r.response_type === "in_stock").length,
    week_customer_finds: weekFinds,
  };
}

export function demoCreateStore(input: {
  ownerId: string;
  name: string;
  categories: string[];
  streetAddress: string;
  city: string;
  state: string;
  postalCode: string;
  phone?: string;
  website?: string;
  serviceZips: string[];
  requestCategories: string[];
  ageRestricted?: boolean;
}): Store {
  const state = getDemoState();
  let slug = slugify(input.name);
  if (state.stores.some((s) => s.slug === slug)) slug = `${slug}-${Date.now().toString(36)}`;

  const store: Store = {
    id: randomUUID(),
    owner_id: input.ownerId,
    name: input.name,
    slug,
    description: null,
    phone: input.phone || null,
    website: input.website || null,
    street_address: input.streetAddress,
    city: input.city,
    state: input.state,
    postal_code: input.postalCode,
    country: "US",
    latitude: null,
    longitude: null,
    is_active: true,
    is_verified: false,
    is_suspended: false,
    age_restricted: input.ageRestricted ?? false,
    subscription_plan: "free",
    subscription_status: "active",
    trial_ends_at: new Date(Date.now() + STORE_TRIAL_DAYS * 86400000).toISOString(),
    avg_response_minutes: null,
    service_radius_miles: 10,
    created_at: now(),
    updated_at: now(),
  };
  state.stores.push(store);
  for (const category of input.categories) {
    state.storeCategories.push({ store_id: store.id, category });
  }
  for (const category of input.requestCategories) {
    if (!state.storeCategories.some((c) => c.store_id === store.id && c.category === category)) {
      state.storeCategories.push({ store_id: store.id, category });
    }
  }
  for (const postal_code of input.serviceZips) {
    state.storeServiceAreas.push({
      store_id: store.id,
      postal_code,
      city: input.city,
      state: input.state,
    });
  }
  for (let day = 0; day < 7; day++) {
    state.storeHours.push({
      store_id: store.id,
      day_of_week: day,
      open_time: day === 0 ? null : "09:00",
      close_time: day === 0 ? null : "21:00",
      is_closed: day === 0,
    });
  }
  state.storeMembers.push({
    id: randomUUID(),
    store_id: store.id,
    user_id: input.ownerId,
    role: "owner",
    status: "active",
    created_at: now(),
  });
  track("store_created", { user_id: input.ownerId, store_id: store.id });
  return store;
}

export function demoCountCustomerRequestsThisMonth(customerId: string): number {
  const state = getDemoState();
  return state.requests.filter(
    (r) =>
      r.customer_id === customerId && createdInMonthlyFindWindow(r.created_at)
  ).length;
}

export function demoSubmitStoreApplication(input: {
  businessName: string;
  businessType: string;
  streetAddress: string;
  city: string;
  state: string;
  postalCode: string;
  phone: string;
  website?: string;
  ownerName: string;
  ownerEmail: string;
  ownerPhone?: string;
  whyLegit: string;
  confirmedLegitimate: boolean;
  requestCategories?: string[];
  requiresCustomerId?: boolean;
  applicantUserId?: string | null;
}): StoreApplication {
  const state = getDemoState();
  const application: StoreApplication = {
    id: randomUUID(),
    business_name: input.businessName.trim(),
    business_type: input.businessType,
    street_address: input.streetAddress.trim(),
    city: input.city.trim(),
    state: input.state,
    postal_code: input.postalCode,
    phone: input.phone.trim(),
    website: input.website?.trim() || null,
    owner_name: input.ownerName.trim(),
    owner_email: input.ownerEmail.toLowerCase().trim(),
    owner_phone: input.ownerPhone?.trim() || null,
    why_legit: input.whyLegit.trim(),
    confirmed_legitimate: input.confirmedLegitimate,
    request_categories:
      input.requestCategories && input.requestCategories.length
        ? input.requestCategories
        : [input.businessType],
    requires_customer_id: Boolean(input.requiresCustomerId),
    status: "pending",
    applicant_user_id: input.applicantUserId || null,
    admin_notes: null,
    applicant_reply: null,
    reviewed_at: null,
    reviewed_by: null,
    created_at: now(),
    updated_at: now(),
  };
  state.storeApplications.unshift(application);
  track("store_application_submitted", {
    user_id: input.applicantUserId || undefined,
  });
  return application;
}

export function demoListStoreApplications(status?: StoreApplication["status"]) {
  const apps = getDemoState().storeApplications;
  const filtered = status ? apps.filter((a) => a.status === status) : apps;
  return [...filtered].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
}

export function demoGetPendingApplicationForEmail(email: string | null | undefined) {
  if (!email) return undefined;
  return getDemoState().storeApplications.find(
    (a) =>
      a.owner_email.toLowerCase() === email.toLowerCase() && a.status === "pending"
  );
}

export function demoApproveStoreApplication(
  applicationId: string,
  reviewerId: string
): { application: StoreApplication; store: Store } {
  const state = getDemoState();
  const application = state.storeApplications.find((a) => a.id === applicationId);
  if (!application) throw new Error("Application not found");
  if (application.status !== "pending" && application.status !== "needs_info") {
    throw new Error("Application already reviewed");
  }

  let owner = state.profiles.find(
    (p) =>
      Boolean(p.email) &&
      p.email!.toLowerCase() === application.owner_email.toLowerCase()
  );
  if (!owner && application.applicant_user_id) {
    owner = state.profiles.find((p) => p.id === application.applicant_user_id);
  }
  if (!owner) {
    owner = {
      id: randomUUID(),
      email: application.owner_email,
      first_name: application.owner_name.split(" ")[0] || application.owner_name,
      last_name: application.owner_name.split(" ").slice(1).join(" ") || null,
      display_name: application.owner_name,
      avatar_url: null,
      account_type: "business",
      subscription_plan: "free",
      default_city: application.city,
      default_state: application.state,
      default_postal_code: application.postal_code,
      notify_in_stock: true,
      notify_can_order: true,
      notify_request_expired: true,
      notify_new_request: true,
      notify_demand_alerts: true,
      is_suspended: false,
      phone_e164: null,
      created_at: now(),
      updated_at: now(),
    };
    state.profiles.push(owner);
  } else {
    owner.account_type = "business";
    owner.updated_at = now();
  }

  const store = demoCreateStore({
    ownerId: owner.id,
    name: application.business_name,
    categories: [application.business_type],
    streetAddress: application.street_address,
    city: application.city,
    state: application.state,
    postalCode: application.postal_code,
    phone: application.phone,
    website: application.website || undefined,
    serviceZips: [application.postal_code, "22044"],
    requestCategories:
      application.request_categories?.length
        ? application.request_categories
        : [application.business_type],
    ageRestricted: Boolean(application.requires_customer_id),
  });
  store.is_verified = true;
  store.subscription_plan = "free";
  store.trial_ends_at = new Date(
    Date.now() + STORE_TRIAL_DAYS * 86400000
  ).toISOString();
  application.created_store_id = store.id;

  application.status = "approved";
  application.reviewed_at = now();
  application.reviewed_by = reviewerId;
  application.updated_at = now();
  track("store_application_approved", {
    user_id: reviewerId,
    store_id: store.id,
  });
  return { application, store };
}

export function demoRejectStoreApplication(applicationId: string, reviewerId: string) {
  const state = getDemoState();
  const application = state.storeApplications.find((a) => a.id === applicationId);
  if (!application) throw new Error("Application not found");
  if (application.status !== "pending" && application.status !== "needs_info") {
    throw new Error("Application already reviewed");
  }
  application.status = "rejected";
  application.reviewed_at = now();
  application.reviewed_by = reviewerId;
  application.updated_at = now();
  return application;
}

export function demoRequestMoreInfoApplication(
  applicationId: string,
  reviewerId: string,
  notes: string
) {
  const state = getDemoState();
  const application = state.storeApplications.find((a) => a.id === applicationId);
  if (!application) throw new Error("Application not found");
  if (application.status !== "pending") throw new Error("Application already reviewed");
  application.status = "needs_info";
  application.admin_notes = notes.trim();
  application.reviewed_at = now();
  application.reviewed_by = reviewerId;
  application.updated_at = now();
  track("store_application_needs_info", { user_id: reviewerId });
  return application;
}

export function demoGetPilotAdminStats(): PilotAdminStats {
  const state = getDemoState();
  const start = new Date();
  start.setHours(0, 0, 0, 0);

  const customers = state.profiles.filter((p) => p.account_type === "customer");
  const approvedStores = state.stores.filter((s) => s.is_active && !s.is_suspended);
  const pendingApps = state.storeApplications.filter(
    (a) => a.status === "pending" || a.status === "needs_info"
  );
  const activeRequests = state.requests.filter((r) =>
    ["active", "partially_answered", "answered"].includes(r.status)
  );
  const completed = state.requests.filter((r) =>
    ["fulfilled", "expired", "cancelled"].includes(r.status)
  );
  const requestsToday = state.requests.filter((r) => new Date(r.created_at) >= start);
  const routed = state.requests.filter((r) => r.stores_targeted > 0);
  const withResponse = state.requests.filter((r) =>
    state.responses.some((x) => x.request_id === r.id)
  );
  const withInStock = state.requests.filter((r) =>
    state.responses.some((x) => x.request_id === r.id && x.response_type === "in_stock")
  );
  const confirmedFound = state.requests.filter((r) => r.status === "fulfilled");

  const firstResponseSecs: number[] = [];
  for (const req of state.requests) {
    const responses = state.responses
      .filter((r) => r.request_id === req.id)
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    if (!responses.length) continue;
    firstResponseSecs.push(
      Math.round((new Date(responses[0].created_at).getTime() - new Date(req.created_at).getTime()) / 1000)
    );
  }

  const storesRespondingToday = new Set(
    state.responses
      .filter((r) => new Date(r.created_at) >= start)
      .map((r) => r.store_id)
  ).size;

  const catCounts = new Map<string, number>();
  const productCounts = new Map<string, number>();
  for (const r of state.requests) {
    if (r.category) catCounts.set(r.category, (catCounts.get(r.category) || 0) + 1);
    productCounts.set(
      r.normalized_product_name,
      (productCounts.get(r.normalized_product_name) || 0) + 1
    );
  }

  const zeroResponse = state.requests
    .filter(
      (r) =>
        r.stores_targeted > 0 &&
        !state.responses.some((x) => x.request_id === r.id) &&
        ["active", "partially_answered", "expired"].includes(r.status)
    )
    .slice(0, 20)
    .map((r) => ({
      id: r.id,
      product_name: r.product_name,
      created_at: r.created_at,
    }));

  const storePerf = approvedStores.map((store) => {
    const targets = state.targets.filter((t) => t.store_id === store.id);
    const responses = state.responses.filter((r) => r.store_id === store.id);
    const finds = state.requests.filter((r) => r.fulfilled_store_id === store.id).length;
    const times = targets
      .filter((t) => t.response_time_seconds != null)
      .map((t) => t.response_time_seconds!);
    return {
      id: store.id,
      name: store.name,
      responseRate: Math.round((responses.length / Math.max(targets.length, 1)) * 100),
      finds,
      avgSeconds: average(times),
    };
  });

  return {
    totalCustomers: customers.length,
    approvedStores: approvedStores.length,
    pendingApplications: pendingApps.length,
    activeRequests: activeRequests.length,
    completedRequests: completed.length,
    requestsToday: requestsToday.length,
    responseRate: Math.round(
      (state.responses.length / Math.max(state.targets.length, 1)) * 100
    ),
    successfulFindRate: Math.round(
      (confirmedFound.length / Math.max(state.requests.length, 1)) * 100
    ),
    avgFirstResponseSeconds: average(firstResponseSecs),
    medianFirstResponseSeconds: median(firstResponseSecs),
    storesRespondingToday,
    funnel: {
      created: state.requests.length,
      routed: routed.length,
      withResponse: withResponse.length,
      withInStock: withInStock.length,
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
    zeroResponseRequests: zeroResponse,
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

export function demoUpdateStoreSettings(
  storeId: string,
  userId: string,
  input: {
    serviceRadiusMiles?: number;
    serviceZips?: string[];
    categories?: string[];
    hours?: {
      day_of_week: number;
      open_time: string | null;
      close_time: string | null;
      is_closed: boolean;
    }[];
  }
) {
  const state = getDemoState();
  const member = state.storeMembers.find(
    (m) =>
      m.store_id === storeId &&
      m.user_id === userId &&
      m.status === "active" &&
      (m.role === "owner" || m.role === "manager")
  );
  if (!member) throw new Error("Only owners and managers can update store settings");
  const store = state.stores.find((s) => s.id === storeId);
  if (!store) throw new Error("Store not found");

  if (input.serviceRadiusMiles != null) {
    store.service_radius_miles = input.serviceRadiusMiles;
  }
  if (input.serviceZips) {
    state.storeServiceAreas = state.storeServiceAreas.filter((a) => a.store_id !== storeId);
    for (const postal_code of input.serviceZips) {
      state.storeServiceAreas.push({
        store_id: storeId,
        postal_code,
        city: store.city,
        state: store.state,
      });
    }
  }
  if (input.categories) {
    state.storeCategories = state.storeCategories.filter((c) => c.store_id !== storeId);
    for (const category of input.categories) {
      state.storeCategories.push({ store_id: storeId, category });
    }
  }
  if (input.hours) {
    state.storeHours = state.storeHours.filter((h) => h.store_id !== storeId);
    for (const h of input.hours) {
      state.storeHours.push({ store_id: storeId, ...h });
    }
  }
  store.updated_at = now();
  return store;
}

export function demoCreateHubPairing(): {
  pairingId: string;
  code: string;
  secret: string;
  expiresAt: string;
} {
  const state = getDemoState();
  let code = generatePairingCode();
  let hash = hashPairingCode(code);
  for (let i = 0; i < 8; i++) {
    const clash = state.devicePairings.some(
      (row) => row.code_hash === hash && !row.used_at && new Date(row.expires_at) > new Date()
    );
    if (!clash) break;
    code = generatePairingCode();
    hash = hashPairingCode(code);
  }
  const secret = generateSecret();
  const pairing: DevicePairingCode = {
    id: randomUUID(),
    code_hash: hash,
    requester_secret_hash: sha256Hex(secret),
    expires_at: new Date(Date.now() + HUB_PAIRING_TTL_MS).toISOString(),
    used_at: null,
    store_id: null,
    device_id: null,
    issued_token: null,
    created_at: now(),
  };
  state.devicePairings.push(pairing);
  return { pairingId: pairing.id, code, secret, expiresAt: pairing.expires_at };
}

export function demoLookupHubPairing(code: string): DevicePairingCode | null {
  const hash = hashPairingCode(code);
  const row = getDemoState().devicePairings.find(
    (p) =>
      p.code_hash === hash &&
      !p.used_at &&
      new Date(p.expires_at).getTime() > Date.now()
  );
  return row || null;
}

export function demoClaimHubPairing(input: {
  code: string;
  storeId: string;
  deviceName: string;
  pairedBy: string;
}): { device: StoreDevice; pairing: DevicePairingCode } | { error: string } {
  const state = getDemoState();
  const pairing = demoLookupHubPairing(input.code);
  if (!pairing) return { error: "That code is invalid or expired." };
  const token = generateSecret();
  const device: StoreDevice = {
    id: randomUUID(),
    store_id: input.storeId,
    device_name: input.deviceName.trim().slice(0, 80) || "Store device",
    token_hash: sha256Hex(token),
    paired_by: input.pairedBy,
    paired_at: now(),
    last_seen_at: now(),
    revoked_at: null,
    created_at: now(),
    updated_at: now(),
  };
  state.storeDevices.push(device);
  pairing.used_at = now();
  pairing.store_id = input.storeId;
  pairing.device_id = device.id;
  pairing.issued_token = token;
  return { device, pairing };
}

export function demoRedeemHubPairing(input: {
  pairingId: string;
  secret: string;
}): { deviceId: string; token: string; storeId: string } | { error: string; pending?: boolean } {
  const pairing = getDemoState().devicePairings.find((p) => p.id === input.pairingId);
  if (!pairing) return { error: "Pairing expired. Generate a new code." };
  if (pairing.requester_secret_hash !== sha256Hex(input.secret)) {
    return { error: "This screen is not the one that started pairing." };
  }
  if (new Date(pairing.expires_at).getTime() <= Date.now() && !pairing.issued_token) {
    return { error: "That code expired. Generate a new one." };
  }
  if (!pairing.used_at || !pairing.device_id || !pairing.store_id) {
    return { error: "Waiting for the owner to connect this device.", pending: true };
  }
  if (!pairing.issued_token) {
    return { error: "This pairing was already used." };
  }
  const token = pairing.issued_token;
  pairing.issued_token = null;
  return { deviceId: pairing.device_id, token, storeId: pairing.store_id };
}

export function demoGetStoreDeviceBySession(
  deviceId: string,
  token: string
): StoreDevice | null {
  const device = getDemoState().storeDevices.find((d) => d.id === deviceId);
  if (!device || device.revoked_at) return null;
  if (device.token_hash !== sha256Hex(token)) return null;
  return device;
}

export function demoListStoreDevices(storeId: string): StoreDevice[] {
  return getDemoState()
    .storeDevices.filter((d) => d.store_id === storeId)
    .sort((a, b) => new Date(b.paired_at).getTime() - new Date(a.paired_at).getTime());
}

export function demoRenameStoreDevice(
  storeId: string,
  deviceId: string,
  name: string
): StoreDevice | { error: string } {
  const device = getDemoState().storeDevices.find(
    (d) => d.id === deviceId && d.store_id === storeId
  );
  if (!device || device.revoked_at) return { error: "Device not found." };
  device.device_name = name.trim().slice(0, 80) || device.device_name;
  device.updated_at = now();
  return device;
}

export function demoRevokeStoreDevice(
  storeId: string,
  deviceId: string
): StoreDevice | { error: string } {
  const device = getDemoState().storeDevices.find(
    (d) => d.id === deviceId && d.store_id === storeId
  );
  if (!device) return { error: "Device not found." };
  device.revoked_at = now();
  device.updated_at = now();
  return device;
}

export function demoTouchStoreDevice(deviceId: string): void {
  const device = getDemoState().storeDevices.find((d) => d.id === deviceId);
  if (!device || device.revoked_at) return;
  device.last_seen_at = now();
  device.updated_at = now();
}
