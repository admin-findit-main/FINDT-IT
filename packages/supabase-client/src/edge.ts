import type { SupabaseClient } from "@supabase/supabase-js";
import type { CreateRequestInput } from "@findit/domain";
import type { CustomerRequest, StoreResponse } from "@findit/types";

export type CreateAndRouteResult =
  | {
      request: CustomerRequest;
      storesTargeted: number;
      noStores: boolean;
    }
  | {
      error: string;
      needsAuth?: boolean;
      duplicateOf?: string;
      code?: string;
      upgradeRequired?: boolean;
    };

export type RespondToRequestResult =
  | { response: StoreResponse }
  | { error: string };

type InvokeError = {
  message?: string;
  context?: unknown;
};

async function readFunctionPayload(
  data: unknown,
  error: InvokeError | null
): Promise<Record<string, unknown> | null> {
  if (data && typeof data === "object") return data as Record<string, unknown>;
  const ctx = error?.context;
  if (!ctx) return null;
  if (typeof ctx === "string") {
    try {
      const parsed = JSON.parse(ctx) as unknown;
      return parsed && typeof parsed === "object"
        ? (parsed as Record<string, unknown>)
        : null;
    } catch {
      return null;
    }
  }
  if (typeof ctx === "object" && ctx !== null && "error" in ctx) {
    return ctx as Record<string, unknown>;
  }
  const res = ctx as { json?: () => Promise<unknown>; clone?: () => { json: () => Promise<unknown> } };
  try {
    const body = res.clone ? await res.clone().json() : await res.json?.();
    if (body && typeof body === "object") return body as Record<string, unknown>;
  } catch {
    return null;
  }
  return null;
}

function fallbackFunctionError(error: InvokeError | null, fallback: string) {
  const message = error?.message || fallback;
  if (/non-2xx status code/i.test(message)) {
    return "Couldn't send this Find. Check your city and ZIP, then try again.";
  }
  return message;
}

/**
 * Call Edge Function create-and-route-request with the user's JWT.
 */
export async function invokeCreateAndRouteRequest(
  supabase: SupabaseClient,
  input: CreateRequestInput
): Promise<CreateAndRouteResult> {
  const { data, error } = await supabase.functions.invoke("create-and-route-request", {
    body: input,
  });
  const payload = await readFunctionPayload(data, error);
  if (payload && typeof payload.error === "string" && payload.error) {
    return payload as CreateAndRouteResult;
  }
  if (payload && payload.request) {
    return payload as CreateAndRouteResult;
  }
  if (error) {
    return { error: fallbackFunctionError(error, "Couldn't create your request.") };
  }
  return { error: "Couldn't create your request." };
}

/**
 * Call Edge Function respond-to-request (notification fanout + lifecycle).
 */
export async function invokeRespondToRequest(
  supabase: SupabaseClient,
  input: {
    requestId: string;
    storeId: string;
    responseType: "in_stock" | "out_of_stock" | "can_order";
    price?: number | null;
    quantity?: number | null;
    note?: string;
    holdMinutes?: number | null;
    estimatedAvailabilityLabel?: string;
    availabilityAmount?: "plenty" | "few_left" | "last_one" | null;
    trackDemand?: boolean;
  }
): Promise<RespondToRequestResult> {
  const { data, error } = await supabase.functions.invoke("respond-to-request", {
    body: input,
  });
  const payload = await readFunctionPayload(data, error);
  if (payload && typeof payload.error === "string" && payload.error) {
    return { error: payload.error };
  }
  if (payload && payload.response) {
    return payload as RespondToRequestResult;
  }
  if (error) {
    return { error: fallbackFunctionError(error, "Couldn't save your response.") };
  }
  return (data as RespondToRequestResult) || { error: "Couldn't save your response." };
}
