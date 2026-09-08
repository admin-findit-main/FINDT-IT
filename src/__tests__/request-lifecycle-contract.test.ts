import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function source(file: string) {
  return readFileSync(path.join(process.cwd(), file), "utf8");
}

function exportedFunction(file: string, name: string) {
  const text = source(file);
  const start = text.indexOf(`export async function ${name}`);
  expect(start).toBeGreaterThanOrEqual(0);
  const next = text.indexOf("\nexport async function ", start + 1);
  return text.slice(start, next < 0 ? undefined : next);
}

describe("request lifecycle migration integration", () => {
  it("uses only atomic response RPC writes and gates retry side effects", () => {
    for (const file of [
      "src/lib/services/actions.ts",
      "supabase/functions/respond-to-request/index.ts",
    ]) {
      const text =
        file.endsWith("actions.ts")
          ? exportedFunction(file, "respondToRequestAction")
          : source(file);
      expect(text).toContain('"respond_to_store_request"');
      expect(text).toContain("notify_customer");
      expect(text).toContain("created_new");
      expect(text).toContain("p_employee_user_id");
      expect(text).toContain("p_shift_employee_id");
      expect(text).toContain("p_hub_device_id");
      expect(text).not.toMatch(
        /\.from\("store_responses"\)\s*\.(?:insert|update|upsert)/
      );
      expect(text).not.toMatch(
        /\.from\("customer_requests"\)\s*\.update/
      );
    }
  });

  it("uses customer lifecycle RPCs without direct lifecycle updates", () => {
    const cases = [
      ["cancelRequestAction", "cancel_customer_request"],
      ["fulfillRequestAction", "fulfill_customer_request"],
      ["stillLookingAction", "rebroadcast_customer_request"],
    ] as const;
    for (const [name, rpc] of cases) {
      const text = exportedFunction("src/lib/services/actions.ts", name);
      expect(text).toContain(`"${rpc}"`);
      expect(text).not.toMatch(
        /\.from\("customer_requests"\)\s*\.update/
      );
    }

    const mobile = source("apps/customer-mobile/lib/api.ts");
    expect(mobile).toContain('"cancel_customer_request"');
    expect(mobile).toContain('"fulfill_customer_request"');
    expect(mobile).toContain('"rebroadcast_customer_request"');
    expect(mobile).not.toMatch(
      /\.from\("customer_requests"\)\s*\.update/
    );
  });

  it("keeps logically expired open requests out of Active and in Past", () => {
    for (const file of [
      "src/lib/services/actions.ts",
      "apps/customer-mobile/lib/api.ts",
    ]) {
      const text = source(file);
      expect(text).toContain('.gt("expires_at", now)');
      expect(text).toContain("expires_at.lte.${now}");
      expect(text).toContain(
        "status.in.(active,partially_answered,answered,draft)"
      );
    }
  });

  it("authorizes Hub inbox and keeps list/count predicates aligned", () => {
    const route = source("src/app/api/hub/inbox/route.ts");
    const actions = source("src/lib/services/actions.ts");
    expect(route).toContain("authorizeHubInboxStoreAction");
    expect(route).toContain('? 401 : 403');
    expect(actions.match(/\.in\("delivery_status", \["sent", "delivered"\]\)/g))
      .toHaveLength(2);
    expect(
      actions.match(
        /\.in\("request\.status", \["active", "partially_answered", "answered"\]\)/g
      )
    ).toHaveLength(2);
    expect(actions).toContain("responseByRequest.has(request.id)");
    expect(actions).toContain("!responded.has(target.request_id)");
  });

  it("keeps mobile submission and Edge creation idempotent", () => {
    const mobile = source(
      "apps/customer-mobile/app/(app)/(tabs)/index.tsx"
    );
    const edge = source(
      "supabase/functions/create-and-route-request/index.ts"
    );
    expect(mobile).toContain("submissionRef");
    expect(mobile).toContain("globalThis.crypto.randomUUID()");
    expect(mobile).toContain("clientRequestKey: submissionRef.current.key");
    expect(edge).toContain("client_request_key: clientRequestKey");
    expect(edge).toContain('error?.code === "23505"');
    expect(edge).toContain('.eq("customer_id", user.id)');
  });

  it("enforces owned image paths at creation and before signing", () => {
    const web = exportedFunction(
      "src/lib/services/actions.ts",
      "createCustomerRequestAction"
    );
    const edge = source(
      "supabase/functions/create-and-route-request/index.ts"
    );
    const signing = source("src/lib/services/request-images-server.ts");
    expect(web).toContain("resolveOwnedRequestImageInput");
    expect(edge).toContain("resolveOwnedRequestImageInput");
    expect(signing).toContain("normalizeOwnedRequestImagePath");
    expect(signing).toContain("customerId");
  });
});
