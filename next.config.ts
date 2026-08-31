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
  async redirects() {
    return [
      {
        source: "/:path*",
        has: [{ type: "host", value: "askfindit.com" }],
        destination: "https://www.askfindit.com/:path*",
        permanent: true,
      },
    ];
  },
  async headers() {
    return [
      {
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(self)",
          },
          ...(process.env.NODE_ENV === "production"
            ? [
                {
                  key: "Strict-Transport-Security",
                  value: "max-age=63072000; includeSubDomains; preload",
                },
              ]
            : []),
        ],
      },
    ];
  },
};

export default nextConfig;
