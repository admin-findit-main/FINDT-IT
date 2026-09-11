"use server";

import {
  normalizeStoreLocation,
  storeJoinApplicationSchema,
} from "@findit/domain";
import { isDemoMode } from "@/lib/config/env";
import { consumeRateLimit } from "@/lib/security/rate-limit";
import {
  getCurrentProfile,
  getStoreWorkspaceAction,
} from "@/lib/services/actions";

/**
 * Signed-in owners/managers apply for another location with the same form fields.
 * Does not create a new login — attaches the application to the current account.
 */
export async function submitAdditionalLocationAction(raw: unknown) {
  const profile = await getCurrentProfile();
  if (!profile?.email) return { error: "Sign in to add a location." };

  const workspace = await getStoreWorkspaceAction();
  if (!workspace?.canManageStore) {
    return { error: "Only owners and managers can add a location." };
  }

  const parsed = storeJoinApplicationSchema.safeParse({
    ...(typeof raw === "object" && raw ? raw : {}),
    ownerEmail: profile.email,
    ownerName:
      (typeof raw === "object" &&
        raw &&
        "ownerName" in raw &&
        String((raw as { ownerName?: string }).ownerName || "").trim()) ||
      profile.first_name ||
      profile.display_name ||
      profile.email,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message || "Invalid application" };
  }

  const limited = await consumeRateLimit({
    bucket: "store-add-location",
    limit: 5,
    windowMs: 24 * 60 * 60_000,
    key: profile.id,
  });
  if (!limited.ok) return { error: limited.error };

  if (isDemoMode()) {
    return {
      ok: true as const,
      applicationId: "demo-location",
      message: "Demo mode — location request recorded locally.",
    };
  }

  const location = normalizeStoreLocation({
    streetAddress: parsed.data.streetAddress,
    city: parsed.data.city,
    state: parsed.data.state,
    postalCode: parsed.data.postalCode,
  });

  const { createServiceClient } = await import("@/lib/supabase/admin");
  const admin = createServiceClient();

  const { data: existingPending } = await admin
    .from("store_applications")
    .select("id")
    .eq("applicant_user_id", profile.id)
    .in("status", ["pending", "needs_info"])
    .limit(1)
    .maybeSingle();
  if (existingPending?.id) {
    return {
      error:
        "You already have a location application waiting for FINDIT review. Finish that one first.",
    };
  }

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
      owner_email: profile.email.toLowerCase(),
      owner_phone: parsed.data.ownerPhone || null,
      why_legit: parsed.data.whyLegit,
      confirmed_legitimate: true,
      request_categories: parsed.data.requestCategories,
      requires_customer_id: parsed.data.requiresCustomerId,
      applicant_user_id: profile.id,
      status: "pending",
    })
    .select("id")
    .single();

  if (error || !data) {
    return { error: error?.message || "Could not submit this location." };
  }

  return {
    ok: true as const,
    applicationId: data.id as string,
    message:
      "Submitted. FINDIT will review this location like a normal business application.",
  };
}
