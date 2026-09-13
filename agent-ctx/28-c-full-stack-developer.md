# Task 28-c — Service Registry + Journeys + My SASI (Phases 8 / 9 / 11)

Agent: full-stack-developer (28-c)
Date: finished after 28-1 scaffolding; runs against Supabase PostgreSQL dev server (port 3000, untouched).

## Files owned & delivered
- `src/lib/sasi/services-registry.ts` (NEW — THE registry, client-safe, DTOs included)
- `src/app/api/sasi/journeys/route.ts` (NEW)
- `src/app/api/sasi/save/route.ts` (NEW)
- `src/app/api/sasi/reminders/route.ts` (NEW)
- `src/app/api/sasi/mysasi/route.ts` (NEW)
- `src/components/sasi/views/journeys.tsx` (REWRITTEN — catalogue)
- `src/components/sasi/views/journey.tsx` (REWRITTEN — runner)
- `src/components/sasi/views/activity.tsx` (REWRITTEN — MY SASI)
- `src/components/sasi/views/service-detail.tsx` (EDITED — registry upgrade, graceful)
- `src/lib/sasi/civic-ai.ts` (ONE additive line: `summary?: string` on agent 28-b's tolerant RegistryEntry — their serviceDetailBlock() reads entry.summary; fixed to unblock the shared tsc gate)

## Registry shape (17 entries)
- Guided (journeyId `${slug}-apply`, 4–5 real steps each): passport, smart-id, birth-certificate, sassa-grants, driver-licence, vehicle-renewal, police-clearance.
- Categories (journeyId null, empty requirement lists by design): documents, safety, local-government, water, electricity, roads, waste, healthcare, education, housing.
- verified=true ONLY: dha.gov.za (passport/smart-id/birth-certificate/documents), sassa.gov.za, saps.gov.za (police-clearance/safety), gov.za (driver-licence, vehicle-renewal, local-government). Uncertain URL ⇒ officialSource null + department named.
- locationCategory values: home-affairs, sassa-office, police-station, dltc, licensing-office.

## API contracts
- `GET /api/sasi/journeys?sessionId=` → `{ runs: JourneyRunDTO[] }`; `POST { sessionId, journeyId, status: ACTIVE|PAUSED|COMPLETED, stepsDone?: number[] }` → upsert by (sessionId, journeyId); unknown journeyId ⇒ 400; payload snapshot built SERVER-SIDE from registry; userId from getAuthSession() when present.
- `POST /api/sasi/save { sessionId, kind, itemId, payload? }` (idempotent, `{saved:true}`), kind=service slug validated; `GET ?sessionId=`; `DELETE ?sessionId=&kind=&itemId=` → `{saved:false}`.
- `POST /api/sasi/reminders { sessionId, title, note?, dueAt? }`; `GET` pending-first; `PATCH { sessionId, id, done }` (404 honest); `DELETE ?sessionId=&id=`.
- `GET /api/sasi/mysasi?sessionId=` → `{ activeJourneys(ACTIVE|PAUSED≤12), savedItems(50), reminders(pending-first,50), recentConversations(last 20 chat rows grouped by UTC day), recentNotifications(20, read column wins) }` — honest empties, corrupt rows skipped.

## Honesty guarantees
- Journey view carries the standing banner "Completing this SASI checklist does not complete an official government application…"; COMPLETED = SASI checklist only; completion copy states no application was made via SASI.
- Reminders labelled "SASI reminder · not from government" per row + section TrustNotice.
- No fabricated stats anywhere; every fetch has honest loading (skeletons/ThinkingDots, no bars) + inline error/retry or toast.

## Verification
- lint 0 errors; tsc 0 errors; all curls green (journeys/save/reminders/mysasi + 400/404 paths); pages `/`, `/?view=journeys`, `/?view=activity`, `/?view=service-detail&p=documents` → 200; dev.log clean. Smoke rows left under sessionId `agent-c-test`.

## Hand-offs / deferred
- Agent 28-b: wire answer-saving (`kind:"answer"`, payload `{title, question}`) + journey save from ask-sasi — API ready.
- Agent on map: map may ignore the locationCategory param today; navigation is safe.
- i18n sidebar label still "Activity" (i18n.ts not mine); state-route userId migration carry applies to my routes too.
