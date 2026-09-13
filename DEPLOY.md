# Deploying SASI — free hosting from this GitHub repo

SASI's recommended home is **Vercel** (free tier). It is made by the
creators of Next.js, deploys straight from this GitHub repository, and
gives HTTPS + global CDN out of the box. Total time: ~5 minutes.

> Why not GitHub Pages? SASI has a server (authentication, database,
> AI endpoints). GitHub Pages hosts static files only, so it cannot run
> SASI. Vercel/Netlify/Render/Railway/Cloudflare Pages all run Next.js
> apps; the steps below are written for Vercel and translate 1:1.

---

## One-time setup (Vercel, free)

1. Go to **https://vercel.com** → **Sign up with GitHub** (no credit card).
2. **Add New… → Project** → import the repository **AndersonAzariah/sasi**.
3. Vercel auto-detects Next.js. **Before clicking Deploy**, open
   **Environment Variables** and add exactly these:

   | Name | Value | Notes |
   |---|---|---|
   | `DATABASE_URL` | **THIS PROJECT (ref `awcceckvuiarlbnzemsv`, region eu-west-1):** `postgresql://postgres.awcceckvuiarlbnzemsv:<DB-PASSWORD>@aws-1-eu-west-1.pooler.supabase.com:5432/postgres?sslmode=require` — replace only `<DB-PASSWORD>` | **USE EXACTLY THIS HOST.** The direct URL (`…@db.awcceckvuiarlbnzemsv.supabase.co:5432/…`) is IPv6-only and WILL FAIL on Vercel — if your Supabase dashboard shows `db.awcceckvuiarlbnzemsv.supabase.co` in the URI, that is the WRONG one. Use **Supabase dashboard → Connect → Session pooler** (port 5432), or the transaction pooler (port 6543) from the same panel. Every login requires this query path. |
   | `NEXTAUTH_SECRET` | a long random string | generate: `openssl rand -base64 32` |
   | `NEXTAUTH_URL` | `https://<your-app>.vercel.app` | OPTIONAL now — SASI auto-derives it from Vercel's own `VERCEL_PROJECT_PRODUCTION_URL`/`VERCEL_URL` when unset; set it explicitly only when using a custom domain |
   | `NEXT_PUBLIC_SUPABASE_URL` | `https://awcceckvuiarlbnzemsv.supabase.co` | safe to expose |
   | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | your `sb_publishable_…` key | safe to expose (RLS denies it everything) |
   | `SUPABASE_SECRET_KEY` | your `sb_secret_…` key | SERVER ONLY — used for read-only health probes. Never prefix with `NEXT_PUBLIC_`. |
   | `OPENROUTER_API_KEY` | your `sk-or-…` key | SERVER ONLY — the real AI provider (Ask SASI, briefings, document and photo analysis, address refinement). Never prefix with `NEXT_PUBLIC_`, never commit it. |
   | `OPENROUTER_MODEL` | e.g. `nvidia/nemotron-3-super-120b-a12b:free` | OPTIONAL — the built-in default is already a FREE-tier model verified for SASI's structured output; set this only to switch models. A free-tier key cannot call paid models (402). |
   | `OPENROUTER_VISION_MODEL` | e.g. `inclusionai/ling-3.0-flash-vl:free` | OPTIONAL — used for photo/document-image analysis; defaults to `OPENROUTER_MODEL`. Use a `:free` vision-capable model with a free-tier key. |

   When `OPENROUTER_API_KEY` is absent the app stays fully functional
   (services, journeys, search, Explore, My SASI, documents storage)
   and AI features honestly report "SASI AI is temporarily
   unavailable. The platform's AI provider is not configured." — no
   fake answers are ever shown.

4. Under **Project → Settings → Domains**, pick a short name. Free
   options on `vercel.app` (first come, first served):
   `sasi.vercel.app` → if taken try `sasi-app.vercel.app`,
   `getsasi.vercel.app`, `sasi-za.vercel.app`.
   Set `NEXTAUTH_URL` to the final URL (or leave it unset — it is
   derived) and **redeploy** once if you changed it.

5. **Deploy.** Every `git push` to `main` now auto-deploys.

6. **Test SASI AI.** Ask SASI a question (e.g. "How do I apply for a
   passport?") — you should get a real, structured answer routed
   through OpenRouter. If you see "the platform's AI provider is not
   configured", re-check `OPENROUTER_API_KEY` in Vercel and redeploy.

## One-time database sync (already automated)

The schema is NOT applied by the Vercel build (deploys must never
mutate the database). Instead, the GitHub Action
**“Supabase database sync”** (`.github/workflows/supabase-db.yml`)
applies the Prisma schema + the RLS hardening to Supabase:

- It runs on every push that touches `prisma/` or `supabase/`, and on
  demand from GitHub → **Actions → Supabase database sync → Run workflow**.
- It needs two **repo secrets** (Settings → Secrets and variables → Actions):
  - `SUPABASE_DIRECT_DATABASE_URL` —
    `postgresql://postgres:<PASSWORD>@db.awcceckvuiarlbnzemsv.supabase.co:5432/postgres?sslmode=require`
    (direct connection; GitHub runners can reach port 5432)
  - (already set by the maintainer where applicable)

To apply the schema manually instead: Supabase dashboard → **SQL
Editor** → paste `supabase/migrations/0001_init.sql`, run it, then
paste and run `supabase/rls-hardening.sql`.

## Verify after deploying

- Open `https://<your-app>.vercel.app` → sign up / sign in.
- Settings → **App & offline** → the “Cloud database (Supabase)” row
  must say *“Supabase PostgreSQL — connected and answering queries”*.
- `GET /api/sasi/system-status` must report
  `database.ok: true`, `ai.configured: true` (after adding the
  OpenRouter key), `supabase.schemaApplied: true` and
  `supabase.anonLocked: true`.

### Reading the status endpoint (no secrets are ever included)

```jsonc
{
  "database": {
    "provider": "postgres",
    "ok": true,              // ← must be true; sign-in needs the DB
    "hostClass": "pooler",   // ← "pooler" = correct for serverless
    // "hint" only appears when ok is false — one honest reason
  },
  "ai": { "provider": "openrouter", "configured": true, "model": "…" },
  "supabase": { "configured": true, "restReachable": true,
                "schemaApplied": true, "anonLocked": true }
}
```

`database.hostClass` classifies the configured DATABASE_URL host
WITHOUT exposing any value:

- `"pooler"` — `aws-*.pooler.supabase.com` (correct for Vercel)
- `"direct"` — `db.<ref>.supabase.co` (IPv6-only; **unreachable from
  Vercel serverless** — this is the known "authentication not working"
  cause; replace DATABASE_URL with the pooler string and redeploy)
- `"local"` — `file:` / localhost (development only)
- `"other"` / `"unset"` — check the variable

If `database.ok` is `false`, the response includes a `database.hint`
explaining the likely cause, and the sign-in screen says SASI cannot
reach its database instead of pretending the password was wrong.

## Alternatives if Vercel is not available

| Host | Free tier | How |
|---|---|---|
| Netlify | Yes (Next.js runtime) | Import repo from GitHub, same env vars |
| Render | Yes (web service) | New Web Service → Build: `prisma generate --schema prisma/schema.postgres.prisma && next build`, Start: `next start` |
| Railway | Trial credits | Connect repo, same variables |
| Cloudflare Pages | Yes | Next.js via OpenNext adapter (more setup) |

## Security notes for the deployment

- Rotate `NEXTAUTH_SECRET` and the Supabase keys if they have ever
  been shared in chat or screenshots (Supabase → Settings → API →
  Rotate keys; then update Vercel + GitHub secrets).
- The publishable key is safe in the browser: the database denies the
  `anon`/`authenticated` roles everything (RLS on + grants revoked).
- Never commit `.env`. It is gitignored; `.env.example` documents it.
