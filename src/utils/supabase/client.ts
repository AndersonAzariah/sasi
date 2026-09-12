import { createBrowserClient } from "@supabase/ssr";

/* ============================================================
   SASI — Supabase browser client.

   Uses ONLY the publishable key. The database is hardened so that
   this client has zero table grants and zero schema usage (see
   supabase/rls-hardening.sql): the browser can never read or write
   SASI data directly. All data access goes through the app's
   authenticated API routes (NextAuth + Prisma). This client exists
   for auth-adjacent features and future realtime use.
   ============================================================ */

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

export function createClient() {
  if (!supabaseUrl || !supabaseKey) {
    throw new Error(
      "Supabase is not configured: set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY."
    );
  }
  return createBrowserClient(supabaseUrl, supabaseKey);
}
