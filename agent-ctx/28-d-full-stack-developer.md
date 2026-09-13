# Task 28-d — full-stack-developer — Document Intelligence (Phase 15)

## Scope honoured
- CREATED: `src/app/api/sasi/documents/route.ts`
- REWROTE: `src/components/sasi/views/documents.tsx`
- Did NOT edit store.ts / sasi-app.tsx / app-shell.tsx / types.ts / i18n.ts / ask-sasi.tsx / api-auth.ts.

## API contract (src/app/api/sasi/documents/route.ts)
- `POST /api/sasi/documents` (multipart/form-data: `file`, `sessionId`)
  - 200 → `{ id, name, mimeType, sizeBytes, createdAt, summary: string|null, keyInfo: {importantInfo[], dates[{label,value,iso?}], actions[]}|null, analysisError: string|null }`
  - 400 missing sessionId / no file / empty file · 413 > 5MB · 415 PDF (honest: "PDF parsing is not supported yet") or unsupported type · 429 rate-limited (Retry-After)
  - Accepted: text/plain, text/markdown, text/x-markdown, text/csv, application/csv, image/png, image/jpeg, image/webp (extension fallback when browser sends empty MIME).
  - Text path: UTF-8 read capped at 20,000 chars → ONE `zai.chat.completions.create` (briefing/ask pattern, thinking disabled).
  - Image path: base64 data URL → ONE `zai.chat.completions.createVision` (vision/route.ts pattern) with "read ONLY what is legible" instruction.
  - Analysis JSON validated server-side (trim/type/caps only: 8×240 strings, 8 dates, ISO `YYYY-MM-DD` check, summary ≤700). Parse failure ⇒ row stored with `summary=null`, `keyInfo=null`, honest `analysisError` — never a fabricated analysis.
- `GET ?sessionId=` → `{ documents: [...] }`, owner-scoped (sessionId OR NextAuth userId when present — state/route.ts canonical pattern), newest first, take 50, keyInfo parsed.
- `DELETE ?sessionId=&id=` → `{ deleted: true }` or honest 404. Immediate + permanent.
- Rate limit: `rateLimitService.limit("documents:post:<userId|sessionId>", 12, 300_000)` + `tooManyRequests()` — migrated to Agent 28-a's new RateLimitService signature (the old `rateLimit()` became async mid-task; tsc caught it).
- Raw file bytes are NEVER persisted — DocumentRecord metadata + analysis only.

## View (documents.tsx)
- All states: loading (ThinkingDots), load error w/ retry, honest empty state + CTA, dropzone disabled while in flight, analysing (ThinkingDots + rotating honest stages + "Analysing…" chip — NO bars), upload error w/ retry, success card, unanalysed card ("Analysis unavailable" honest chip), deleting chip, AlertDialog delete ("Deleted immediately and permanently…"), optimistic remove + restore on failure.
- Privacy line verbatim in a TrustNotice (implementation matches it).
- 390px-safe, h-10 (44px) touch targets, max-h-48 overflow-y-auto lists, zero horizontal overflow verified.

## Ask SASI prefill (needs follow-up)
- ask-sasi.tsx supports neither param nor event prefill and was not owned by this task.
- Mechanism used: `navigate("ask-sasi", question)` (question rides the URL `?p=`) **plus** `window.dispatchEvent(new CustomEvent("sasi:prefill-question", { detail: { question } }))`.
- **ask-sasi.tsx should listen for `sasi:prefill-question` (or read the view param) and drop `detail.question` into its composer input.** Until then an honest toast shows the full question to the user.

## QA results
- `bun run lint` → 0 errors; `bunx tsc --noEmit` → 0 errors.
- curl: POST realistic City of Cape Town bill → 200 grounded summary / 6 importantInfo / 4 dates / 4 actions; foreign-session GET = empty; foreign DELETE = 404; own DELETE = `{deleted:true}`; re-GET empty; PDF 415; 5.7MB → 413; no sessionId → 400.
- agent-browser 390px (golden.path QA login): full flow passed, console clean, 0px horizontal overflow.
- dev.log: no compile errors; all routes returned expected statuses.

## Deferred
- PDF text extraction (needs a parser dependency — rejected honestly for now).
- Re-analysis of unanalysed rows; i18n keys for view copy (i18n.ts not owned here).
