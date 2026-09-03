"use server";

import { boundUuid, normalizeHubPin, shiftEmployeeNameSchema } from "@findit/domain";
import { isDemoMode } from "@/lib/config/env";
import { isSoloAdmin } from "@/lib/auth/admin";
import { consumeRateLimit } from "@/lib/security/rate-limit";
import { logSecurityEvent } from "@/lib/security/audit";
import { generateHubPin } from "@/lib/hub/crypto";
import {
  clearHubShiftCookie,
  readHubShiftCookie,
  setHubShiftCookie,
} from "@/lib/hub/session";
import { resolveHubTerminalAction } from "@/lib/services/hub-devices";
import { getCurrentProfile, getStoreWorkspaceAction } from "@/lib/services/actions";
import type { StoreShiftEmployee, StoreShiftPunch } from "@/types/database";

export type ShiftEmployeeView = {
  id: string;
  display_name: string;
  pin: string | null;
  active: boolean;
  on_shift: boolean;
  clocked_in_at: string | null;
  last_clocked_out_at: string | null;
};

export type HubClockState =
  | { required: false }
  | {
      required: true;
      clockedIn: {
        punchId: string;
        employeeId: string;
        name: string;
        since: string;
      } | null;
    };

async function requireStoreManager() {
  const profile = await getCurrentProfile();
  if (!profile) return { error: "Please sign in" as const, profile: null, storeId: null };
  const workspace = await getStoreWorkspaceAction();
  const id = workspace?.store?.id;
  if (!id) return { error: "No store is linked to this account." as const, profile, storeId: null };
  if (isSoloAdmin(profile)) return { profile, storeId: id };
  if (!workspace?.canManageStore) {
    return { error: "Only owners and managers can manage shifts." as const, profile, storeId: null };
  }
  return { profile, storeId: id };
}

function toView(
  employee: StoreShiftEmployee,
  punches: StoreShiftPunch[]
): ShiftEmployeeView {
  const theirs = punches.filter((row) => row.employee_id === employee.id);
  const open = theirs.find((row) => !row.clocked_out_at) || null;
  const lastOut = theirs
    .filter((row) => row.clocked_out_at)
    .sort(
      (a, b) =>
        new Date(b.clocked_out_at || 0).getTime() - new Date(a.clocked_out_at || 0).getTime()
    )[0];
  return {
    id: employee.id,
    display_name: employee.display_name,
    pin: employee.pin,
    active: employee.active,
    on_shift: Boolean(open),
    clocked_in_at: open?.clocked_in_at || null,
    last_clocked_out_at: lastOut?.clocked_out_at || null,
  };
}

async function unusedPin(
  existing: { pin: string | null }[],
  pick: () => string
): Promise<string | { error: string }> {
  const taken = new Set(existing.map((row) => row.pin).filter(Boolean) as string[]);
  for (let i = 0; i < 40; i += 1) {
    const pin = pick();
    if (!taken.has(pin)) return pin;
  }
  return { error: "Couldn't pick a free PIN. Try again." };
}

export async function listShiftEmployeesAction(): Promise<ShiftEmployeeView[]> {
  const manager = await requireStoreManager();
  if (manager.error || !manager.storeId) return [];

  if (isDemoMode()) {
    const { demoListShiftEmployees, getDemoState } = await import("@/lib/demo/store");
    const people = demoListShiftEmployees(manager.storeId);
    const punches = getDemoState().shiftPunches.filter((row) => row.store_id === manager.storeId);
    return people.map((row) => toView(row, punches));
  }

  const { createServiceClient } = await import("@/lib/supabase/admin");
  const admin = createServiceClient();
  const [{ data: people }, { data: punches }] = await Promise.all([
    admin
      .from("store_shift_employees")
      .select("*")
      .eq("store_id", manager.storeId)
      .order("display_name", { ascending: true }),
    admin.from("store_shift_punches").select("*").eq("store_id", manager.storeId),
  ]);
  return ((people || []) as StoreShiftEmployee[]).map((row) =>
    toView(row, (punches || []) as StoreShiftPunch[])
  );
}

export async function addShiftEmployeeAction(displayName: string) {
  const parsed = shiftEmployeeNameSchema.safeParse(displayName);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message || "Name this person." };
  }
  const manager = await requireStoreManager();
  if (manager.error || !manager.storeId) return { error: manager.error || "Unauthorized" };

  if (isDemoMode()) {
    const { demoAddShiftEmployee } = await import("@/lib/demo/store");
    const result = demoAddShiftEmployee(manager.storeId, parsed.data);
    if ("error" in result) return result;
    return { ok: true as const, employee: toView(result, []) };
  }

  const { createServiceClient } = await import("@/lib/supabase/admin");
  const admin = createServiceClient();
  const { data: existing } = await admin
    .from("store_shift_employees")
    .select("pin")
    .eq("store_id", manager.storeId);
  const pin = await unusedPin((existing || []) as { pin: string | null }[], generateHubPin);
  if (typeof pin !== "string") return pin;

  const { data, error } = await admin
    .from("store_shift_employees")
    .insert({
      store_id: manager.storeId,
      display_name: parsed.data,
      pin,
      active: true,
    })
    .select("*")
    .maybeSingle();
  if (error || !data) return { error: "Couldn't add that person." };
  void logSecurityEvent({
    actorId: manager.profile?.id,
    action: "shift_employee_added",
    resource: (data as StoreShiftEmployee).id,
    metadata: { storeId: manager.storeId },
  });
  return { ok: true as const, employee: toView(data as StoreShiftEmployee, []) };
}

export async function setShiftEmployeePinAction(employeeId: string, pinValue: string | null) {
  const id = boundUuid(employeeId);
  if (!id) return { error: "Person not found." };
  const pin = pinValue === null ? null : normalizeHubPin(pinValue);
  if (pinValue !== null && !pin) return { error: "Use a 4-digit PIN." };
  const manager = await requireStoreManager();
  if (manager.error || !manager.storeId) return { error: manager.error || "Unauthorized" };

  if (isDemoMode()) {
    const { demoSetShiftEmployeePin } = await import("@/lib/demo/store");
    const result = demoSetShiftEmployeePin(manager.storeId, id, pin);
    if ("error" in result) return result;
    return { ok: true as const, employee: toView(result, []) };
  }

  const { createServiceClient } = await import("@/lib/supabase/admin");
  const admin = createServiceClient();
  if (pin) {
    const { data: clash } = await admin
      .from("store_shift_employees")
      .select("id")
      .eq("store_id", manager.storeId)
      .eq("pin", pin)
      .neq("id", id)
      .maybeSingle();
    if (clash) return { error: "That PIN is already used at this store." };
  }
  const { data, error } = await admin
    .from("store_shift_employees")
    .update({ pin, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("store_id", manager.storeId)
    .select("*")
    .maybeSingle();
  if (error || !data) return { error: "Couldn't update that PIN." };
  if (!pin) {
    await admin
      .from("store_shift_punches")
      .update({ clocked_out_at: new Date().toISOString() })
      .eq("employee_id", id)
      .eq("store_id", manager.storeId)
      .is("clocked_out_at", null);
  }
  void logSecurityEvent({
    actorId: manager.profile?.id,
    action: pin ? "shift_pin_changed" : "shift_pin_removed",
    resource: id,
    metadata: { storeId: manager.storeId },
  });
  return { ok: true as const, employee: toView(data as StoreShiftEmployee, []) };
}

export async function deleteShiftEmployeeAction(employeeId: string) {
  const id = boundUuid(employeeId);
  if (!id) return { error: "Person not found." };
  const manager = await requireStoreManager();
  if (manager.error || !manager.storeId) return { error: manager.error || "Unauthorized" };

  if (isDemoMode()) {
    const { demoDeleteShiftEmployee } = await import("@/lib/demo/store");
    return demoDeleteShiftEmployee(manager.storeId, id);
  }

  const { createServiceClient } = await import("@/lib/supabase/admin");
  const admin = createServiceClient();
  const { data, error } = await admin
    .from("store_shift_employees")
    .delete()
    .eq("id", id)
    .eq("store_id", manager.storeId)
    .select("id")
    .maybeSingle();
  if (error || !data) return { error: "Couldn't remove that person." };
  void logSecurityEvent({
    actorId: manager.profile?.id,
    action: "shift_employee_removed",
    resource: id,
    metadata: { storeId: manager.storeId },
  });
  return { ok: true as const };
}

export async function getHubClockStateAction(): Promise<HubClockState> {
  const linked = await resolveHubTerminalAction();
  if (!linked.ok) return { required: false };
  if (linked.runtime.source !== "device") return { required: false };
  const storeId = linked.runtime.store.id;

  if (isDemoMode()) {
    const { demoCountClockableEmployees, demoGetOpenPunch } = await import("@/lib/demo/store");
    if (demoCountClockableEmployees(storeId) === 0) return { required: false };
    const cookie = await readHubShiftCookie();
    if (!cookie) return { required: true, clockedIn: null };
    const open = demoGetOpenPunch(cookie.punchId, storeId);
    if (!open) {
      await clearHubShiftCookie();
      return { required: true, clockedIn: null };
    }
    return {
      required: true,
      clockedIn: {
        punchId: open.punch.id,
        employeeId: open.employee.id,
        name: open.employee.display_name,
        since: open.punch.clocked_in_at,
      },
    };
  }

  const { createServiceClient } = await import("@/lib/supabase/admin");
  const admin = createServiceClient();
  const { count } = await admin
    .from("store_shift_employees")
    .select("id", { count: "exact", head: true })
    .eq("store_id", storeId)
    .eq("active", true)
    .not("pin", "is", null);
  if (!count) return { required: false };

  const cookie = await readHubShiftCookie();
  if (!cookie) return { required: true, clockedIn: null };
  const { data: punch } = await admin
    .from("store_shift_punches")
    .select("*")
    .eq("id", cookie.punchId)
    .eq("store_id", storeId)
    .is("clocked_out_at", null)
    .maybeSingle();
  if (!punch) {
    await clearHubShiftCookie();
    return { required: true, clockedIn: null };
  }
  const { data: employee } = await admin
    .from("store_shift_employees")
    .select("*")
    .eq("id", (punch as StoreShiftPunch).employee_id)
    .eq("active", true)
    .maybeSingle();
  if (!employee) {
    await clearHubShiftCookie();
    return { required: true, clockedIn: null };
  }
  return {
    required: true,
    clockedIn: {
      punchId: (punch as StoreShiftPunch).id,
      employeeId: (employee as StoreShiftEmployee).id,
      name: (employee as StoreShiftEmployee).display_name,
      since: (punch as StoreShiftPunch).clocked_in_at,
    },
  };
}

export async function clockInHubAction(pinValue: string) {
  const pin = normalizeHubPin(pinValue);
  if (!pin) return { error: "Enter the 4-digit PIN." };
  const limited = await consumeRateLimit({
    bucket: "hub-clock",
    limit: 8,
    windowMs: 10 * 60 * 1000,
  });
  if (!limited.ok) return { error: limited.error };

  const linked = await resolveHubTerminalAction();
  if (!linked.ok) return { error: "This tablet is not connected to a store." };
  if (linked.runtime.source !== "device") {
    return { error: "Clock in from the store Hub tablet." };
  }
  const storeId = linked.runtime.store.id;
  const deviceId = linked.runtime.deviceId;

  if (isDemoMode()) {
    const { demoClockInHub } = await import("@/lib/demo/store");
    const result = demoClockInHub({ storeId, pin, deviceId });
    if ("error" in result) return result;
    await setHubShiftCookie(result.punch.id);
    return {
      ok: true as const,
      name: result.employee.display_name,
      punchId: result.punch.id,
      since: result.punch.clocked_in_at,
    };
  }

  const { createServiceClient } = await import("@/lib/supabase/admin");
  const admin = createServiceClient();
  const { data: employee } = await admin
    .from("store_shift_employees")
    .select("*")
    .eq("store_id", storeId)
    .eq("active", true)
    .eq("pin", pin)
    .maybeSingle();
  if (!employee) return { error: "That PIN is not on this store." };
  const person = employee as StoreShiftEmployee;

  const { data: open } = await admin
    .from("store_shift_punches")
    .select("*")
    .eq("employee_id", person.id)
    .is("clocked_out_at", null)
    .maybeSingle();
  if (open) {
    if (deviceId && (open as StoreShiftPunch).device_id !== deviceId) {
      await admin
        .from("store_shift_punches")
        .update({ device_id: deviceId })
        .eq("id", (open as StoreShiftPunch).id);
    }
    await setHubShiftCookie((open as StoreShiftPunch).id);
    return {
      ok: true as const,
      name: person.display_name,
      punchId: (open as StoreShiftPunch).id,
      since: (open as StoreShiftPunch).clocked_in_at,
    };
  }

  const { data: punch, error } = await admin
    .from("store_shift_punches")
    .insert({
      store_id: storeId,
      employee_id: person.id,
      device_id: deviceId,
    })
    .select("*")
    .maybeSingle();
  if (error || !punch) return { error: "Couldn't clock in. Try again." };
  await setHubShiftCookie((punch as StoreShiftPunch).id);
  return {
    ok: true as const,
    name: person.display_name,
    punchId: (punch as StoreShiftPunch).id,
    since: (punch as StoreShiftPunch).clocked_in_at,
  };
}

export async function clockOutHubAction() {
  const linked = await resolveHubTerminalAction();
  if (!linked.ok) {
    await clearHubShiftCookie();
    return { ok: true as const };
  }
  const storeId = linked.runtime.store.id;
  const cookie = await readHubShiftCookie();
  if (!cookie) return { ok: true as const };

  if (isDemoMode()) {
    const { demoClockOutHub } = await import("@/lib/demo/store");
    demoClockOutHub(cookie.punchId, storeId);
    await clearHubShiftCookie();
    return { ok: true as const };
  }

  const { createServiceClient } = await import("@/lib/supabase/admin");
  const admin = createServiceClient();
  await admin
    .from("store_shift_punches")
    .update({ clocked_out_at: new Date().toISOString() })
    .eq("id", cookie.punchId)
    .eq("store_id", storeId)
    .is("clocked_out_at", null);
  await clearHubShiftCookie();
  return { ok: true as const };
}
