-- ============================================================
-- SASI — Supabase hardening: deny-by-default for the public API.
--
-- Applied AFTER the schema migration by the "supabase-db" GitHub
-- Action (and safe to re-run any time; it is idempotent).
--
-- What this does, in order:
--   1. ENABLE ROW LEVEL SECURITY on every table in schema public.
--      No policies are created, so anon/authenticated roles match
--      ZERO rows even if grants were accidentally re-added.
--   2. REVOKE every table/sequence/function privilege from the
--      anon and authenticated roles (the roles used by the
--      publishable key over the REST API).
--   3. REVOKE USAGE ON SCHEMA public from anon/authenticated, so
--      the REST API cannot even see the tables.
--
-- Unaffected:
--   - Prisma / the app server: connects as `postgres` (table owner,
--     superuser) — owners bypass RLS and grants still allow it.
--   - Supabase internals: auth.*, storage.*, realtime.* live in
--     other schemas and are not touched.
--   - service_role (server-side admin key) keeps its grants — but
--     the secret key never leaves the server.
--
-- Net effect: the publishable key can do NOTHING to SASI data.
-- All reads/writes go through the app's authenticated API.
-- ============================================================

DO $$
DECLARE
  t text;
BEGIN
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'public'
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
  END LOOP;
END $$;

REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM authenticated;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM anon;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM authenticated;
REVOKE ALL ON SCHEMA public FROM anon;
REVOKE ALL ON SCHEMA public FROM authenticated;
