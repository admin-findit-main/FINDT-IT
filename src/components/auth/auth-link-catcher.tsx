"use client";

import { useEffect } from "react";

function shouldHandoff(url: URL): boolean {
  if (url.pathname.startsWith("/auth/callback")) return false;
  const hash = new URLSearchParams(url.hash.replace(/^#/, ""));
  if (url.searchParams.has("token_hash") || hash.has("token_hash")) return true;
  if (hash.has("access_token") && hash.has("refresh_token")) return true;
  if (!url.searchParams.has("code")) return false;
  return (
    url.pathname === "/" ||
    url.pathname.startsWith("/login") ||
    url.pathname.startsWith("/signup") ||
    url.pathname.startsWith("/forgot-password") ||
    url.pathname.startsWith("/auth/update-password")
  );
}

/** Moves email/reset tokens from the landing URL onto /auth/callback. */
export function AuthLinkCatcher() {
  useEffect(() => {
    const url = new URL(window.location.href);
    if (!shouldHandoff(url)) return;
    const next = new URL("/auth/callback", window.location.origin);
    url.searchParams.forEach((value, key) => {
      next.searchParams.set(key, value);
    });
    if (
      url.pathname.startsWith("/auth/update-password") &&
      !next.searchParams.get("next")
    ) {
      next.searchParams.set("next", "/auth/update-password");
    }
    window.location.replace(`${next.pathname}${next.search}${url.hash}`);
  }, []);
  return null;
}
