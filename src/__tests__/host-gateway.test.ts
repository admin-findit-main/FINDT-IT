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

  it("keeps public /stores pages on www instead of treating them as /store", () => {
    const decision = decideHostRouting(
      req("www.askfindit.com", "/stores/acme"),
      "anonymous"
    );
    expect(decision.kind).toBe("continue");
    if (decision.kind === "continue") {
      expect(decision.internalPath).toBe("/stores/acme");
      expect(decision.rewrite).toBe(false);
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

  it("pretty-redirects team and notifications on the store host", () => {
    const team = decideHostRouting(req("store.askfindit.com", "/store/team"), "manager");
    expect(team.kind).toBe("redirect");
    if (team.kind === "redirect") {
      expect(team.url.pathname).toBe("/team");
    }
    const notes = decideHostRouting(
      req("store.askfindit.com", "/store/notifications"),
      "manager"
    );
    expect(notes.kind).toBe("redirect");
    if (notes.kind === "redirect") {
      expect(notes.url.pathname).toBe("/notifications");
    }
    const prettyTeam = decideHostRouting(req("store.askfindit.com", "/team"), "manager");
    expect(prettyTeam.kind).toBe("continue");
    if (prettyTeam.kind === "continue") {
      expect(prettyTeam.internalPath).toBe("/store/team");
      expect(prettyTeam.rewrite).toBe(true);
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

  it("keeps magic-link and reset callbacks on the dashboard even for the operator", () => {
    const decision = decideHostRouting(
      req("dashboard.askfindit.com", "/auth/callback"),
      "admin"
    );
    expect(decision.kind).toBe("continue");
    if (decision.kind === "continue") {
      expect(decision.internalPath).toBe("/auth/callback");
    }
  });

  it("sends the app host home to the public website", () => {
    const decision = decideHostRouting(req("app.askfindit.com", "/"), "anonymous");
    expect(decision.kind).toBe("redirect");
    if (decision.kind === "redirect") {
      expect(decision.permanent).toBe(true);
      expect(decision.url.hostname).toBe("www.askfindit.com");
      expect(decision.url.pathname).toBe("/");
    }
  });

  it("leaves localhost paths unchanged", () => {
    const decision = decideHostRouting(req("localhost:3002", "/store"), "manager");
    expect(decision.kind).toBe("continue");
    if (decision.kind === "continue") {
      expect(decision.internalPath).toBe("/store");
      expect(decision.rewrite).toBe(false);
    }
  });

  it("does not rewrite API push delivery on dashboard or store hosts", () => {
    for (const host of ["dashboard.askfindit.com", "store.askfindit.com"]) {
      const decision = decideHostRouting(req(host, "/api/push/deliver"), "anonymous");
      expect(decision.kind).toBe("continue");
      if (decision.kind === "continue") {
        expect(decision.internalPath).toBe("/api/push/deliver");
        expect(decision.rewrite).toBe(false);
      }
    }
  });
});
