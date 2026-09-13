import { NextResponse, type NextRequest } from "next/server";

/* ============================================================
   SASI — edge proxy (Next.js 16: the middleware convention is now "proxy").

   Supabase session refresh REMOVED (audit 28-a): SASI authentication is
   100% NextAuth credentials + JWT cookies. Nothing in the codebase ever
   signs a user in to Supabase Auth, so no sb-* session cookies exist and
   the per-request refresh was a guaranteed no-op network hop. Verified
   by grep: the only supabase.auth call in the repo lived in the removed
   src/utils/supabase/middleware.ts.

   Security headers on every HTML/API response:
   - Content-Security-Policy → conservative allow-list (see below)
   - X-Content-Type-Options: nosniff       → no MIME sniffing
   - X-Frame-Options: DENY + frame-ancestors 'none'
                                           → no clickjacking/iframes
   - Referrer-Policy: strict-origin-…      → URLs never leak out
   - Permissions-Policy                    → camera/mic/geolocation
     stay same-origin (report wizard & voice composer keep working)
   - Cross-Origin-Opener-Policy            → isolates this tab from any
     opened window (no OAuth popups exist, so same-origin is safe)
   - Strict-Transport-Security (production) → force HTTPS
   ============================================================ */

/* script-src keeps 'unsafe-inline'/'unsafe-eval': Next.js hydration and
   dev-mode react-refresh require both today. Tightening to nonces is the
   follow-up once the Next.js version supports it cleanly in prod. */
const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "connect-src 'self' " +
    [
      "https://awcceckvuiarlbnzemsv.supabase.co",
      "https://*.supabase.co",
      "https://nominatim.openstreetmap.org",
      "https://openrouter.ai",
      "https://api.openstreetmap.org",
    ].join(" "),
  "font-src 'self' data:",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

export function proxy(request: NextRequest) {
  const response = NextResponse.next();

  const headers = response.headers;
  headers.set("Content-Security-Policy", CSP);
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("X-Frame-Options", "DENY");
  headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  headers.set(
    "Permissions-Policy",
    "camera=(self), microphone=(self), geolocation=(self), payment=(), usb=()"
  );
  headers.set("X-DNS-Prefetch-Control", "off");
  headers.set("Cross-Origin-Opener-Policy", "same-origin");
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
