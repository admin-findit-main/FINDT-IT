import { createHmac, timingSafeEqual } from "node:crypto";
import { BILLING_PLANS, type BillingAudience } from "@findit/domain";
import { fastSpringConfig, isFastSpringLiveMode } from "@/lib/config/env";

export function verifyFastSpringSignature(
  rawBody: string,
  signatureHeader: string | null | undefined,
  secret = fastSpringConfig().webhookSecret
): boolean {
  if (!secret || !signatureHeader) return false;
  const computed = createHmac("sha256", secret).update(rawBody).digest("base64");
  const expected = Buffer.from(computed);
  const provided = Buffer.from(signatureHeader.trim());
  if (expected.length !== provided.length) return false;
  return timingSafeEqual(expected, provided);
}

function basicAuthHeader() {
  const { apiUsername, apiPassword } = fastSpringConfig();
  if (!apiUsername || !apiPassword) {
    throw new Error("FastSpring API credentials are not configured.");
  }
  return `Basic ${Buffer.from(`${apiUsername}:${apiPassword}`).toString("base64")}`;
}

async function fastSpringFetch(path: string, init: RequestInit = {}) {
  const response = await fetch(`https://api.fastspring.com${path}`, {
    ...init,
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: basicAuthHeader(),
      ...(init.headers || {}),
    },
    cache: "no-store",
  });
  const text = await response.text();
  let json: unknown = null;
  if (text) {
    try {
      json = JSON.parse(text);
    } catch {
      json = { raw: text };
    }
  }
  if (!response.ok) {
    const message =
      typeof json === "object" && json && "error" in json
        ? String((json as { error: unknown }).error)
        : `FastSpring request failed (${response.status})`;
    throw new Error(message);
  }
  return json;
}

export type FastSpringCheckoutInput = {
  audience: BillingAudience;
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  company?: string | null;
  storeId?: string | null;
  profileId?: string | null;
  liveApproved: boolean;
};

export type FastSpringCheckoutResult = {
  checkoutUrl: string;
  sessionId?: string;
  live: false | true;
  testMode: boolean;
};

function productPath(audience: BillingAudience) {
  const cfg = fastSpringConfig();
  return audience === "store" ? cfg.businessProduct : cfg.plusProduct;
}

/** Live charges require env + admin approval. Otherwise always test/sandbox. */
export function checkoutIsLive(liveApproved: boolean): boolean {
  return isFastSpringLiveMode() && liveApproved;
}

export async function createFastSpringCheckout(
  input: FastSpringCheckoutInput
): Promise<FastSpringCheckoutResult> {
  const live = checkoutIsLive(input.liveApproved);
  const cfg = fastSpringConfig();
  const tags = {
    findit_audience: input.audience,
    findit_plan_id:
      input.audience === "store" ? BILLING_PLANS.business.id : BILLING_PLANS.plus.id,
    ...(input.storeId ? { findit_store_id: input.storeId } : {}),
    ...(input.profileId ? { findit_profile_id: input.profileId } : {}),
  };
  const paymentMethodsOrder =
    input.audience === "store"
      ? ["ACH", "CARD"]
      : ["CARD", "ACH"];

  if (cfg.checkoutPath) {
    const session = (await fastSpringFetch(
      `/v2/checkouts/${cfg.checkoutPath}/sessions`,
      {
        method: "POST",
        body: JSON.stringify({
          live,
          country: "US",
          currency: "USD",
          customer: {
            billToContact: {
              email: input.email,
              firstName: input.firstName || undefined,
              lastName: input.lastName || undefined,
            },
          },
          orderTags: tags,
          cart: {
            lineItems: [{ productPath: productPath(input.audience), quantity: 1 }],
          },
          paymentMethodsOrder,
        }),
      }
    )) as {
      id?: string;
      checkoutUrls?: { webcheckoutUrl?: string };
    };
    const checkoutUrl = session.checkoutUrls?.webcheckoutUrl;
    if (!checkoutUrl) {
      throw new Error("FastSpring did not return a checkout URL.");
    }
    return {
      checkoutUrl,
      sessionId: session.id,
      live,
      testMode: !live,
    };
  }

  const session = (await fastSpringFetch("/sessions", {
    method: "POST",
    body: JSON.stringify({
      products: [{ path: productPath(input.audience), quantity: 1 }],
      tags,
    }),
  })) as { id?: string; session?: string };

  const sessionId = session.id || session.session;
  if (!sessionId) {
    throw new Error("FastSpring did not return a session id.");
  }
  if (!cfg.storefront) {
    throw new Error("FASTSPRING_STOREFRONT is required when checkout path is empty.");
  }
  return {
    checkoutUrl: `https://${cfg.storefront}/session/${sessionId}`,
    sessionId,
    live,
    testMode: !live,
  };
}

export async function createFastSpringAccountManagementUrl(
  accountId: string
): Promise<string> {
  const result = (await fastSpringFetch(`/accounts/${accountId}`, {
    method: "GET",
  })) as {
    accounts?: Array<{ url?: string; account?: string }>;
    url?: string;
  };
  const url = result.url || result.accounts?.[0]?.url;
  if (!url) {
    throw new Error("FastSpring did not return an account management URL.");
  }
  return url;
}

export async function cancelFastSpringSubscription(subscriptionId: string) {
  await fastSpringFetch(`/subscriptions/${subscriptionId}`, {
    method: "POST",
    body: JSON.stringify({ deactivation: null }),
  });
}
