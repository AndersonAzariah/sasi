import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

/* ============================================================
   SASI — Supabase session refresh for middleware.

   On every request this revalidates any Supabase auth session
   (sb-* cookies) so access tokens never expire mid-session.
   SASI's primary auth is NextAuth; when no Supabase session is
   present this is a fast no-op. If Supabase env vars are absent
   the middleware degrades to a plain pass-through so the app
   never hard-fails on a missing integration.
   ============================================================ */

export async function updateSupabaseSession(request: NextRequest) {
  // Create an unmodified response
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!supabaseUrl || !supabaseKey) {
    return supabaseResponse;
  }

  const supabase = createServerClient(
    supabaseUrl,
    supabaseKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // IMPORTANT: do not run code between createServerClient and this call —
  // refreshing the session (if any) must complete before the response ships.
  await supabase.auth.getUser();

  return supabaseResponse;
}
