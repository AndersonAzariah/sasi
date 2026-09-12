import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/* ============================================================
   SASI — Supabase server client (React Server Components /
   Route Handlers). Session cookies are read (and refreshed when
   possible) through Next's cookie store. The publishable key is
   used here as well; privileged operations use Prisma against
   Supabase PostgreSQL with credentials that never leave the server.
   ============================================================ */

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    supabaseUrl!,
    supabaseKey!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Called from a Server Component — harmless when the
            // middleware refreshes sessions on every request.
          }
        },
      },
    }
  );
}
