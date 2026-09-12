import type { NextConfig } from "next";

/* Security headers (Task 16) — baseline hardening for every response.
   geolocation stays (self) because the map's Locate-me feature uses it. */
const SECURITY_HEADERS = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), payment=(), geolocation=(self)",
  },
];

const nextConfig: NextConfig = {
  output: "standalone",
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  images: {
    /* allow the auth hero photograph's tuned quality tiers (88 blur-up
       source plate, 80 banner) without dev warnings */
    qualities: [70, 75, 80, 88],
  },
  async headers() {
    return [{ source: "/(.*)", headers: SECURITY_HEADERS }];
  },
};

export default nextConfig;
