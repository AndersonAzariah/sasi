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
   **Environment Variables** and add exactly these five:

   | Name | Value | Notes |
   |---|---|---|
   | `NEXTAUTH_URL` | `https://<your-app>.vercel.app` | set AFTER you know the name (step 4); you can edit it later and redeploy |
   | `NEXTAUTH_SECRET` | a long random string | generate: `openssl rand -base64 32` |
   | `NEXT_PUBLIC_SUPABASE_URL` | `https://awcceckvuiarlbnzemsv.supabase.co` | safe to expose |
   | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | your `sb_publishable_…` key | safe to expose (RLS denies it everything) |
   | `DATABASE_URL` | `postgresql://postgres.<ref>:<PASSWORD>@aws-0-<region>.pooler.supabase.com:6543/postgres?sslmode=require&pgbouncer=true&connection_limit=1` | **Supabase pooler** — copy from Supabase dashboard → Connect ("Transaction pooler"); serverless needs the pooler, not the direct `db.…supabase.co:5432` address |

   The `SUPABASE_SECRET_KEY` is used only by the server for
   read-only health probes (`/api/sasi/system-status`). If you add it,
   add it with the name `SUPABASE_SECRET_KEY`. It must NEVER be
   prefixed with `NEXT_PUBLIC_`.

4. Under **Project → Settings → Domains**, pick a short name. Free
   options on `vercel.app` (first come, first served):
   `sasi.vercel.app` → if taken try `sasi-app.vercel.app`,
   `getsasi.vercel.app`, `sasi-za.vercel.app`.
   Set `NEXTAUTH_URL` to the final URL and **redeploy** once.

5. **Deploy.** Every `git push` to `main` now auto-deploys.

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
  `supabase.schemaApplied: true` and `supabase.anonLocked: true`.

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
