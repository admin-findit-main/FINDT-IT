import { describe, expect, it } from "vitest";
import {
  hostnameOf,
  isLocalHostname,
  marketingHomeHref,
  matchProductSurface,
  postAuthLocation,
  productUrl,
  resolveBrandHomeHref,
  surfaceForAppPath,
  supabaseCookieDomain,
  toInternalPath,
  toPublicPath,
} from "@/lib/config/product-hosts";

describe("product host matching", () => {
  it("keeps localhost and Vercel previews on path-based routing", () => {
    expect(matchProductSurface("localhost:3002")).toBe("local");
    expect(matchProductSurface("127.0.0.1")).toBe("local");
    expect(matchProductSurface("findit-git-main.vercel.app")).toBe("local");
  });

  it("maps production FINDIT hosts", () => {
    expect(matchProductSurface("askfindit.com")).toBe("apex");
    expect(matchProductSurface("www.askfindit.com")).toBe("www");
    expect(matchProductSurface("dashboard.askfindit.com")).toBe("dashboard");
    expect(matchProductSurface("store.askfindit.com")).toBe("store");
    expect(matchProductSurface("app.askfindit.com")).toBe("app");
    expect(hostnameOf("STORE.askfindit.com:443")).toBe("store.askfindit.com");
  });

  it("does not share cookies on localhost", () => {
    expect(supabaseCookieDomain("localhost:3002")).toBeUndefined();
    expect(supabaseCookieDomain("www.askfindit.com")).toBe(".askfindit.com");
  });
});

describe("pretty store and dashboard paths", () => {
  it("maps store.askfindit.com/ to the existing /store page", () => {
    expect(toInternalPath("store", "/")).toBe("/store");
    expect(toPublicPath("store", "/store")).toBe("/");
  });

  it("maps /hub to the existing FINDIT Hub", () => {
    expect(toInternalPath("store", "/hub")).toBe("/store/hub");
    expect(toInternalPath("store", "/hub/connect")).toBe("/store/hub/connect");
    expect(toPublicPath("store", "/store/hub")).toBe("/hub");
    expect(toPublicPath("store", "/store/hub/connect")).toBe("/hub/connect");
  });

  it("maps store request and settings paths without a /store prefix in the URL", () => {
    expect(toInternalPath("store", "/requests")).toBe("/store/requests");
    expect(toInternalPath("store", "/requests/abc")).toBe("/store/requests/abc");
    expect(toInternalPath("store", "/team")).toBe("/store/team");
    expect(toPublicPath("store", "/store/requests/abc")).toBe("/requests/abc");
    expect(toPublicPath("store", "/login/business")).toBe("/login");
    expect(toInternalPath("store", "/login")).toBe("/login/business");
  });

  it("keeps public /stores pages on the marketing site", () => {
    expect(surfaceForAppPath("/stores/acme")).toBe("www");
    expect(surfaceForAppPath("/store")).toBe("store");
    expect(surfaceForAppPath("/store/requests")).toBe("store");
  });

  it("maps dashboard.askfindit.com/ to the existing /home page", () => {
    expect(toInternalPath("dashboard", "/")).toBe("/home");
    expect(toPublicPath("dashboard", "/home")).toBe("/");
    expect(toInternalPath("dashboard", "/requests")).toBe("/requests");
    expect(toPublicPath("dashboard", "/requests")).toBe("/requests");
  });
});

describe("post-auth locations", () => {
  it("stays relative on localhost", () => {
    expect(postAuthLocation("/home", "localhost:3002")).toBe("/home");
    expect(postAuthLocation("/store", "localhost:3002")).toBe("/store");
  });

  it("sends customers and stores to their product hosts", () => {
    expect(postAuthLocation("/home", "www.askfindit.com")).toBe(
      "https://dashboard.askfindit.com/"
    );
    expect(postAuthLocation("/store", "www.askfindit.com")).toBe(
      "https://store.askfindit.com/"
    );
    expect(postAuthLocation("/admin", "www.askfindit.com")).toBe(
      "https://store.askfindit.com/admin"
    );
    expect(productUrl("dashboard", "/signup", "www.askfindit.com")).toBe(
      "https://dashboard.askfindit.com/signup"
    );
  });

  it("does not treat local hostnames as dedicated", () => {
    expect(isLocalHostname("localhost")).toBe(true);
    expect(isLocalHostname("www.askfindit.com")).toBe(false);
  });

  it("sends people home to askfindit.com off localhost", () => {
    expect(marketingHomeHref("localhost:3002")).toBe("/");
    expect(marketingHomeHref("www.askfindit.com")).toBe(
      "https://www.askfindit.com"
    );
  });

  it("points the logo at the surface the visitor is on", () => {
    expect(
      resolveBrandHomeHref({ surface: "local", pathname: "/home" })
    ).toBe("/home");
    expect(
      resolveBrandHomeHref({ surface: "local", pathname: "/store/requests" })
    ).toBe("/store");
    expect(
      resolveBrandHomeHref({ surface: "local", pathname: "/admin/stores" })
    ).toBe("/admin");
    expect(
      resolveBrandHomeHref({
        surface: "www",
        pathname: "/terms",
        hostHeader: "www.askfindit.com",
      })
    ).toBe("https://www.askfindit.com");
  });
});
