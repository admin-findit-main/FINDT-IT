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
    };

export type RespondToRequestResult =
  | { response: StoreResponse }
  | { error: string };

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
  if (error) {
    return { error: error.message || "Couldn't create your request." };
  }
  return data as CreateAndRouteResult;
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
  if (error) {
    return { error: error.message || "Couldn't save your response." };
  }
  return data as RespondToRequestResult;
}
