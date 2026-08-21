import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { decideHostRouting } from "@/lib/config/host-gateway";

function req(host: string, path: string) {
  return new NextRequest(`https://${host}${path}`, {
    headers: { host },
  });
}

describe("decideHostRouting", () => {
  it("permanently sends the apex domain to www", () => {
    const decision = decideHostRouting(req("askfindit.com", "/join"), "anonymous");
    expect(decision.kind).toBe("redirect");
    if (decision.kind === "redirect") {
      expect(decision.permanent).toBe(true);
      expect(decision.url.hostname).toBe("www.askfindit.com");
      expect(decision.url.pathname).toBe("/join");
    }
  });

  it("keeps the public website on www even for signed-in customers", () => {
    const decision = decideHostRouting(req("www.askfindit.com", "/"), "customer");
    expect(decision.kind).toBe("continue");
    if (decision.kind === "continue") {
      expect(decision.internalPath).toBe("/");
      expect(decision.rewrite).toBe(false);
    }
  });

  it("sends www login/signup to the customer app", () => {
    const signup = decideHostRouting(req("www.askfindit.com", "/signup"), "anonymous");
    expect(signup.kind).toBe("redirect");
    if (signup.kind === "redirect") {
      expect(signup.url.hostname).toBe("dashboard.askfindit.com");
      expect(signup.url.pathname).toBe("/signup");
    }
  });

  it("rewrites dashboard / to /home for customers and /login when signed out", () => {
    const inApp = decideHostRouting(req("dashboard.askfindit.com", "/"), "customer");
    expect(inApp.kind).toBe("continue");
    if (inApp.kind === "continue") {
      expect(inApp.internalPath).toBe("/home");
      expect(inApp.rewrite).toBe(true);
    }
    const signedOut = decideHostRouting(req("dashboard.askfindit.com", "/"), "anonymous");
    expect(signedOut.kind).toBe("continue");
    if (signedOut.kind === "continue") {
      expect(signedOut.internalPath).toBe("/login");
    }
  });

  it("pretty-redirects /store/requests on the store host", () => {
    const decision = decideHostRouting(
      req("store.askfindit.com", "/store/requests"),
      "manager"
    );
    expect(decision.kind).toBe("redirect");
    if (decision.kind === "redirect") {
      expect(decision.url.pathname).toBe("/requests");
      expect(decision.url.hostname).toBe("store.askfindit.com");
    }
  });

  it("sends employees from / to /hub", () => {
    const decision = decideHostRouting(req("store.askfindit.com", "/"), "employee");
    expect(decision.kind).toBe("redirect");
    if (decision.kind === "redirect") {
      expect(decision.url.pathname).toBe("/hub");
    }
  });

  it("does not send store staff to the customer dashboard", () => {
    const decision = decideHostRouting(req("dashboard.askfindit.com", "/"), "manager");
    expect(decision.kind).toBe("redirect");
    if (decision.kind === "redirect") {
      expect(decision.url.hostname).toBe("store.askfindit.com");
    }
  });

  it("returns a safe JSON payload on the app host", () => {
    const decision = decideHostRouting(req("app.askfindit.com", "/"), "anonymous");
    expect(decision.kind).toBe("json");
  });

  it("leaves localhost paths unchanged", () => {
    const decision = decideHostRouting(req("localhost:3002", "/store"), "manager");
    expect(decision.kind).toBe("continue");
    if (decision.kind === "continue") {
      expect(decision.internalPath).toBe("/store");
      expect(decision.rewrite).toBe(false);
    }
  });
});
