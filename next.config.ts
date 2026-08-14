import type { NextConfig } from "next";

// Phone-on-Wi-Fi testing needs the dev server to accept your machine's LAN IP.
// Set FINDIT_DEV_ORIGIN in .env.local (ipconfig getifaddr en0) instead of
// hardcoding an address that goes stale on the next DHCP lease.
const devOrigin = process.env.FINDIT_DEV_ORIGIN?.trim();

const nextConfig: NextConfig = {
  allowedDevOrigins: ["localhost", "127.0.0.1", ...(devOrigin ? [devOrigin] : [])],
  experimental: {
    serverActions: {
      // Product photos are sent as data URLs in demo mode; allow up to 5MB.
      bodySizeLimit: "5mb",
    },
  },
};

export default nextConfig;
