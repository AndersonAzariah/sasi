#!/usr/bin/env bash
set -u
cd /home/z/my-project
pkill -f "next dev" 2>/dev/null
sleep 1
setsid bun run dev < /dev/null > /dev/null 2>&1 &
disown
for i in $(seq 1 45); do curl -s -o /dev/null http://localhost:3000 && break; sleep 2; done
curl -s -o /dev/null -w "SERVER:%{http_code} " http://localhost:3000
# pre-warm all routes used below (dev compiles 15-20s per route on first hit)
for u in "/?view=activity" "/?view=ask-sasi" "/?view=journey&p=passport-apply" "/?view=login"; do
  curl -s -o /dev/null -w "%{http_code}:" "http://localhost:3000$u"
done
echo "WARMED"
S="agent-browser"
SES="--session t30f"
$S close $SES > /dev/null 2>&1
sleep 1

say() { echo ""; echo "=== $1 ==="; }

$S open "http://localhost:3000" $SES 2>&1 | head -1
sleep 2
$S eval "(async () => { const regs = await navigator.serviceWorker.getRegistrations(); for (const r of regs) await r.unregister(); const keys = await caches.keys(); for (const k of keys) await caches.delete(k); return 'cleaned:' + regs.length; })()" $SES 2>&1 | head -1
$S open "http://localhost:3000" $SES > /dev/null 2>&1
sleep 2

say "1. RIGHTS INTENT"
$S press "Control+k" $SES > /dev/null 2>&1
sleep 1
$S keyboard type "what are my rights" $SES > /dev/null 2>&1
sleep 2
$S eval "JSON.stringify([...document.querySelectorAll('[role=option]')].map(o=>o.textContent.slice(0,40)))" $SES 2>&1 | head -2
$S press "Escape" $SES > /dev/null 2>&1

say "2. DOCS INTENT"
$S press "Control+k" $SES > /dev/null 2>&1
sleep 1
$S keyboard type "explain this document" $SES > /dev/null 2>&1
sleep 2
$S eval "JSON.stringify([...document.querySelectorAll('[role=option]')].map(o=>o.textContent.slice(0,40)))" $SES 2>&1 | head -2
$S press "Escape" $SES > /dev/null 2>&1

say "3. LOGIN GOLDEN PATH"
$S eval "[...document.querySelectorAll('button')].find(b => b.textContent.trim() === 'Sign in')?.click(); 'nav'" $SES 2>&1 | head -1
sleep 2
$S fill "#login-email" "golden.path@sasi.test" $SES > /dev/null 2>&1
$S fill "#login-password" 'SasiGolden!2026' $SES > /dev/null 2>&1
$S click "button[type=submit]" $SES > /dev/null 2>&1
sleep 6
$S eval "JSON.stringify({h1: document.querySelector('h1')?.textContent?.slice(0,40)})" $SES 2>&1 | head -1

say "4. MY SASI SECTIONS"
$S open "http://localhost:3000/?view=activity" $SES > /dev/null 2>&1
sleep 3
$S eval "JSON.stringify([...document.querySelectorAll('[aria-labelledby]')].map(e=>e.getAttribute('aria-labelledby')).filter(i=>i.startsWith('mysasi')))" $SES 2>&1 | head -2

say "5. ASK SASI HONEST DEGRADATION"
$S open "http://localhost:3000/?view=ask-sasi" $SES > /dev/null 2>&1
sleep 2
$S keyboard type "I need a passport" $SES > /dev/null 2>&1
$S press "Enter" $SES > /dev/null 2>&1
sleep 8
$S eval "JSON.stringify([...document.querySelectorAll('div')].map(d=>d.textContent).find(t=>t && (t.includes('temporarily unavailable')||t.includes('too many requests')) )?.slice(0,80) ?? 'NO-MESSAGE')" $SES 2>&1 | head -2

say "6. JOURNEY CONTEXT COOKIE"
$S open "http://localhost:3000/?view=journey&p=passport-apply" $SES > /dev/null 2>&1
sleep 3
$S eval "JSON.stringify({h1: document.querySelector('h1')?.textContent?.slice(0,50), cookie: document.cookie.match(/sasi_ctx=([^;]+)/)?.[1]?.slice(0,70) ?? 'none'})" $SES 2>&1 | head -2

say "QA-COMPACT-DONE"
