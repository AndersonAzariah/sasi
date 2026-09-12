import { NextResponse, type NextRequest } from "next/server";

import { updateSupabaseSession } from "@/utils/supabase/middleware";

/* ============================================================
   SASI — edge proxy (Next.js 16: the middleware convention is now "proxy").

   1. Supabase session refresh (no-op unless sb-* cookies exist).
   2. Security headers on every HTML/API response:
      - X-Content-Type-Options: nosniff       → no MIME sniffing
      - X-Frame-Options: DENY                 → no clickjacking/iframes
      - Referrer-Policy: strict-origin-…      → URLs never leak out
      - Permissions-Policy                    → camera/mic/geolocation
        stay same-origin (report wizard & voice composer keep working)
      - Strict-Transport-Security (production) → force HTTPS
   ============================================================ */

export async function proxy(request: NextRequest) {
  const response = await updateSupabaseSession(request);

  const headers = response.headers;
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("X-Frame-Options", "DENY");
  headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  headers.set(
    "Permissions-Policy",
    "camera=(self), microphone=(self), geolocation=(self), payment=(), usb=()"
  );
  headers.set("X-DNS-Prefetch-Control", "off");
  if (process.env.NODE_ENV === "production") {
    headers.set(
      "Strict-Transport-Security",
      "max-age=63072000; includeSubDomains; preload"
    );
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Run on everything except static assets and Next internals.
     * Static files carry no cookies and need no headers of their own.
     */
    "/((?!_next/static|_next/image|favicon.ico|manifest.json|sw.js|robots.txt|.*\\.(?:png|jpg|jpeg|gif|webp|svg|ico|css|js|mjs|map|txt|xml|woff2?)$).*)",
  ],
};
