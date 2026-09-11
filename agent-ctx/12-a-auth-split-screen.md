# Task 12-a — Split-screen fashion-minimal auth (login + signup, chrome-less)

Agent: auth-split-screen (subagent) · Date: 2026-09-11 · Status: COMPLETE

## Scope owned / edited
- `src/components/sasi/views/login.tsx` (rewritten layout+style, logic preserved)
- `src/components/sasi/views/signup.tsx` (rewritten layout+style, logic preserved)
- `src/components/sasi/public-shell.tsx` (conditional chrome)

No other files touched. No i18n.ts edits. No globals.css edits (only consumed existing classes).

## What changed

### public-shell.tsx
- Added `isAuthView = view === "login" || view === "signup"`.
- Header and footer render `{isAuthView ? null : (...)}` — auth views are bare; split screen fills `min-h-screen`.
- Shell skeleton (`min-h-screen flex flex-col`, `main flex-1`, footer `mt-auto`) untouched → other public views keep chrome and sticky-footer behavior.

### login.tsx / signup.tsx (shared pattern)
- **LEFT panel** (lg+, hidden on mobile): `sasi-hero-word` "SASI", 2× `sasi-ambient` breathing lights (login: red/blue, signup: gold/green — inline radial-gradient styles), `sasi-eyebrow` + breathing national-gradient dot, `sasi-serif` headline "Service intelligence for South Africa.", honest line "Independent civic technology. Not a government website.", national accent dot + "South African Service Intelligence" wordmark. `overflow-hidden border-r border-white/6 bg-[#070708]`.
- **RIGHT panel**: card-less form, max-w-[400px]:
  - Inputs wrapped in `GlowField` → `sasi-search-glow rounded-lg border border-white/10` (circulating conic national glow on focus-within); inner Input borderless `h-11` (44px).
  - Submit: `PrimaryButton` + `sasi-btn-white-glass` `h-11 w-full`.
  - Toggle link to the other auth page, "Forgot password" (login, state kept), subtle "Back to home" link, Terms/Privacy note, demo hint as plain line (login) / line + NOT SENT ANYWHERE badge (signup).
  - Signup keeps eye toggle — now a 44×44 hit area inside the glow wrapper.
- **Mobile**: single column, compact `SasiLogo` header + `sasi-line` on top (`lg:hidden`); all targets ≥44px.

### Logic preserved byte-for-byte
- login: email/password/loading/success/forgot state, timers, `handleContinue`, `signIn()` → dashboard (900ms), SA ID ghost button + COMING SOON, success message with DEMO_USER.name.
- signup: name/email/password/showPassword/loading/success, `handleCreate`, same flow, demo copy.

## QA results (agent-browser + VLM)
- `navigate('login'|'signup')`: `header` count = 0, `footer` count = 0 on both ✓
- Split screen renders: aside + hero-word + glow fields + white-glass submit present ✓
- Viewport fill exact: 390×844 → scrollHeight 844 (no double-scroll) ✓
- Form works: typed into every field (values held in state), glow `::before` computed opacity = 1 on focus ✓
- Eye toggle flips password↔text ✓
- Submit login AND signup → `authed:true` → auto-navigate to dashboard ✓
- landing/about: header (4 nav buttons) + footer present; footer bottom == innerHeight (sticks) ✓
- Screenshots: `/tmp/auth-login.png`, `/tmp/auth-login-filled.png`, `/tmp/auth-login-desktop.png`, `/tmp/auth-login-mobile.png`, `/tmp/auth-signup.png`, `/tmp/auth-signup-filled.png`
- VLM visual QA: split screen / no nav / no footer / no glitches confirmed for desktop login, mobile 390 login, filled signup ✓
- Console: zero error messages. NOTE: `agent-browser errors` shows 6 EMPTY pageerror entries — reproduced on a fresh tab before any navigation → pre-existing dev artifact (HMR/service worker), not from these views.
- `bun run lint` exit 0; `tsc --noEmit` clean for src (only pre-existing examples/+skills/ errors).
- dev.log: all 200s, compiles clean.

## Risks / handover notes
1. Auth bare-render is keyed off `view` in PublicShell — any future auth-like public view must be added to `isAuthView`.
2. `sasi-hero-word` uses 30vw — clipped by panel `overflow-hidden`; verified no horizontal overflow.
3. Very tall future content on ≤320px screens will just scroll (by design).
4. Round 10 backlog still open: sidebar collapse toggle, dashboard declutter, map icons polish, fake-data removal audit.
