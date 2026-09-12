"use client";

/* ============================================================
   VerifyView — VERIFY, one of SASI's five actions (master prompt
   §14). A resident pastes a suspicious message / claim / URL and
   SASI runs a TRANSPARENT, rule-based signal check:

   - Scam-signal patterns (urgency, payment, PIN/OTP requests,
     impersonation, odd contact channels, short links).
   - Good signals (official .gov.za domains, real published
     helplines).
   - An assessment that NEVER claims certainty: "potential scam
     signals" / "needs verification" / "no obvious red flags —
     verify independently".
   - Real official fraud-reporting channels for the next step.
   - An Ask SASI hand-off with the claim pre-loaded.

   HONESTY: this is pattern recognition, not proof. The page says
   so in plain language. No fake AI score, no fabricated database
   of known scams — the signals matched are shown verbatim.
   ============================================================ */

import { useMemo, useState } from "react";
import {
  ArrowRight,
  BadgeCheck,
  Ban,
  ScanSearch,
  ShieldAlert,
  ShieldQuestion,
} from "lucide-react";
import { useSasiStore } from "@/lib/sasi/store";
import { OfficialSource, TrustNotice } from "@/components/sasi/primitives";
import { cn } from "@/lib/utils";

/* ---------- transparent signal rules ---------- */

interface SignalRule {
  id: string;
  label: string;
  /** what the resident is told about why this matters */
  why: string;
  pattern: RegExp;
  weight: "high" | "medium";
}

const SCAM_RULES: SignalRule[] = [
  {
    id: "urgency",
    label: "Urgency pressure",
    why: "Real government processes give you time. “Act now / final warning / within 24 hours” pressure is a classic scam signal.",
    pattern: /\b(act now|immediately|within \d+ (hours|days)|final (warning|notice)|urgent(ly)?|expires? (today|tomorrow|within)|your (grant|application) (will be|has been) (cancel|stop|suspend))/i,
    weight: "high",
  },
  {
    id: "payment",
    label: "Asks for money",
    why: "SASSA and government departments do not collect fees through SMS, WhatsApp or e-wallets.",
    pattern: /\b(pay|payment|fee|deposit|r\d{2,}(\s|,|\.)(00)?|e-?wallet|money ?gram|send (money|R)\b)/i,
    weight: "high",
  },
  {
    id: "credentials",
    label: "Asks for PIN, OTP or passwords",
    why: "No government department or bank will ever ask for your PIN, OTP or password — not by phone, SMS or email.",
    pattern: /\b(pin|otp|one[- ]time (pin|code)|password|secret code|banking details|card number)\b/i,
    weight: "high",
  },
  {
    id: "personal-info",
    label: "Asks for ID or personal details",
    why: "Be careful when a message asks for your ID number or full personal details together with anything else on this list.",
    pattern: /\b(id number|identity number|full names? (and|&)? ?(id|surname)?|date of birth|phone the? (following )?details)\b/i,
    weight: "medium",
  },
  {
    id: "impersonation",
    label: "Claims to be a government body",
    why: "Scams often impersonate SASSA, Home Affairs or a municipality. A claim alone proves nothing — check the channel it arrived on.",
    pattern: /\b(sassa|home affairs|department of|municipality|government (grant|agency)|president|minister)\b/i,
    weight: "medium",
  },
  {
    id: "channel",
    label: "Unusual contact channel",
    why: "Official bodies do not move conversations to WhatsApp or personal numbers, and they do not use shortened links.",
    pattern: /\b(whatsapp|telegram|bit\.ly|tinyurl|cutt\.ly|shorturl|click (this|here)|forward (this )?(to \d+|message)|wa\.me)\b/i,
    weight: "medium",
  },
  {
    id: "prize",
    label: "You apparently won something",
    why: "“Congratulations, you have been selected/you won” — especially for something you never entered — is a hallmark of advance-fee scams.",
    pattern: /\b(congratulations|you (have been )?(selected|won)|winner|lucky draw|claim your (prize|money))\b/i,
    weight: "high",
  },
];

const GOOD_RULES: SignalRule[] = [
  {
    id: "official-domain",
    label: "Official .gov.za web address",
    why: "The message points to an official South African government domain — still check the exact spelling before you trust it.",
    pattern: /https?:\/\/[^\s]*\.gov\.za\b|\bgov\.za\b/i,
    weight: "medium",
  },
  {
    id: "official-helpline",
    label: "Published official helpline",
    why: "The message quotes a helpline that matches the organisation's officially published number.",
    pattern: /\b(0800 60 10 11|0800 601 011|10111|10177|080 060 1011)\b/,
    weight: "medium",
  },
];

type Assessment = "potential-scam" | "needs-verification" | "no-obvious-flags";

const ASSESSMENT_META: Record<
  Assessment,
  { title: string; tone: string; icon: typeof ShieldAlert; body: string }
> = {
  "potential-scam": {
    title: "Potential scam signals",
    tone: "border-[#ef5350]/30 bg-[#ef5350]/[0.06] text-[#fda4a0]",
    icon: Ban,
    body: "This message shows several patterns commonly used in South African scams. Do not act on it — verify through the official channels below first.",
  },
  "needs-verification": {
    title: "Needs verification",
    tone: "border-[#e3c567]/30 bg-[#e3c567]/[0.06] text-[#efe0a8]",
    icon: ShieldQuestion,
    body: "SASI found something worth checking, but cannot tell you whether this is real or fake. Verify independently using the official channels below before you act.",
  },
  "no-obvious-flags": {
    title: "No obvious red flags",
    tone: "border-[#66bb6a]/30 bg-[#66bb6a]/[0.06] text-[#a5d6a7]",
    icon: BadgeCheck,
    body: "SASI's rule check found no common scam patterns. That is not proof it is genuine — if it matters, still confirm with the organisation using a number you look up yourself.",
  },
};

export default function VerifyView() {
  const navigate = useSasiStore((s) => s.navigate);
  const setPendingAsk = useSasiStore((s) => s.setPendingAsk);

  const [input, setInput] = useState("");
  const [analyzed, setAnalyzed] = useState<string | null>(null);

  const result = useMemo(() => {
    if (!analyzed) return null;
    const scamHits = SCAM_RULES.filter((r) => r.pattern.test(analyzed));
    const goodHits = GOOD_RULES.filter((r) => r.pattern.test(analyzed));
    const high = scamHits.filter((r) => r.weight === "high").length;
    let assessment: Assessment;
    if (high >= 2 || (high >= 1 && scamHits.length >= 3)) assessment = "potential-scam";
    else if (scamHits.length > 0) assessment = "needs-verification";
    else if (goodHits.length > 0) assessment = "no-obvious-flags";
    else assessment = "needs-verification";
    return { scamHits, goodHits, assessment };
  }, [analyzed]);

  const analyze = () => {
    const text = input.trim();
    if (!text) return;
    setAnalyzed(text);
  };

  const askSasiAbout = () => {
    setPendingAsk(
      `Help me check whether this message could be a scam, and what I should verify: "${analyzed?.slice(0, 400)}"`
    );
    navigate("ask-sasi");
  };

  const reset = () => {
    setInput("");
    setAnalyzed(null);
  };

  const meta = result ? ASSESSMENT_META[result.assessment] : null;

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 lg:py-12">
      {/* ---------- header ---------- */}
      <header>
        <span className="inline-flex items-center gap-2 rounded-md border border-white/8 bg-white/[0.03] px-2.5 py-1 text-[10.5px] font-semibold uppercase tracking-[0.14em] text-zinc-400">
          <ScanSearch className="h-3 w-3 text-[#e3c567]" aria-hidden />
          Verify
        </span>
        <h1 className="mt-4 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
          Is this message real?
        </h1>
        <p className="mt-2 max-w-xl text-[13.5px] leading-relaxed text-zinc-400">
          Paste a suspicious SMS, WhatsApp message, email or link. SASI checks it
          against known scam patterns used in South Africa — openly, with the exact
          signals it matched shown to you.
        </p>
      </header>

      {/* ---------- input ---------- */}
      <div className="sasi-card mt-6 p-5">
        <label htmlFor="sasi-verify-input" className="text-[12px] font-semibold uppercase tracking-[0.14em] text-zinc-500">
          Message, claim or link
        </label>
        <textarea
          id="sasi-verify-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          rows={5}
          placeholder="e.g. “Congratulations! You have been selected for a R1500 SASSA food voucher. Pay the R30 activation fee within 24 hours — WhatsApp 060….”"
          className="mt-2 w-full resize-y rounded-lg border border-white/8 bg-white/[0.02] px-3.5 py-3 text-[13.5px] leading-relaxed text-zinc-200 placeholder:text-zinc-700 focus:border-white/25 focus:outline-none"
          maxLength={2000}
        />
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            onClick={analyze}
            disabled={!input.trim()}
            className="inline-flex h-10 items-center gap-2 rounded-lg bg-white px-5 text-[13px] font-semibold text-black transition hover:bg-zinc-200 disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/60"
          >
            <ScanSearch className="h-4 w-4" aria-hidden />
            Check this message
          </button>
          {analyzed && (
            <button
              onClick={reset}
              className="inline-flex h-10 items-center rounded-lg border border-white/10 px-4 text-[12.5px] text-zinc-400 transition hover:border-white/25 hover:text-white"
            >
              Clear
            </button>
          )}
          <span className="ml-auto font-mono text-[10px] text-zinc-700">{input.length}/2000</span>
        </div>
      </div>

      {/* ---------- result ---------- */}
      {result && meta && (
        <section aria-live="polite" aria-label="Verification result" className="mt-6 space-y-4">
          {/* assessment */}
          <div className={cn("rounded-xl border p-5", meta.tone)}>
            <p className="flex items-center gap-2 text-[14.5px] font-semibold">
              <meta.icon className="h-4.5 w-4.5" aria-hidden />
              {meta.title}
            </p>
            <p className="mt-2 text-[13px] leading-relaxed opacity-90">{meta.body}</p>
          </div>

          {/* evidence — the exact signals that fired */}
          {result.scamHits.length > 0 && (
            <div className="sasi-card p-5">
              <p className="flex items-center gap-2 text-[13px] font-semibold text-white">
                <ShieldAlert className="h-4 w-4 text-[#ef5350]" aria-hidden />
                Why SASI flagged this ({result.scamHits.length} signal{result.scamHits.length === 1 ? "" : "s"})
              </p>
              <ul className="mt-3 space-y-2.5">
                {result.scamHits.map((r) => (
                  <li key={r.id} className="rounded-lg border border-[#ef5350]/15 bg-[#ef5350]/[0.04] p-3">
                    <p className="text-[12.5px] font-medium text-[#fda4a0]">{r.label}</p>
                    <p className="mt-1 text-[12px] leading-relaxed text-zinc-400">{r.why}</p>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {result.goodHits.length > 0 && (
            <div className="sasi-card p-5">
              <p className="flex items-center gap-2 text-[13px] font-semibold text-white">
                <BadgeCheck className="h-4 w-4 text-[#66bb6a]" aria-hidden />
                Good signals ({result.goodHits.length})
              </p>
              <ul className="mt-3 space-y-2.5">
                {result.goodHits.map((r) => (
                  <li key={r.id} className="rounded-lg border border-[#66bb6a]/15 bg-[#66bb6a]/[0.04] p-3">
                    <p className="text-[12.5px] font-medium text-[#a5d6a7]">{r.label}</p>
                    <p className="mt-1 text-[12px] leading-relaxed text-zinc-400">{r.why}</p>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* next steps — the honest independent-verification path */}
          <div className="sasi-card p-5">
            <p className="text-[13px] font-semibold text-white">Your next step — verify it yourself</p>
            <ol className="mt-3 space-y-2 text-[12.5px] leading-relaxed text-zinc-400">
              <li className="flex gap-2.5">
                <span className="font-semibold text-zinc-500" aria-hidden>1.</span>
                Never send a PIN, OTP, password or fee in reply to a message — no government body or bank asks this way.
              </li>
              <li className="flex gap-2.5">
                <span className="font-semibold text-zinc-500" aria-hidden>2.</span>
                Don&apos;t tap links in the message. Open the organisation&apos;s website yourself by typing its address.
              </li>
              <li className="flex gap-2.5">
                <span className="font-semibold text-zinc-500" aria-hidden>3.</span>
                Call the organisation on the number from its official website — not the number in the message.
              </li>
              <li className="flex gap-2.5">
                <span className="font-semibold text-zinc-500" aria-hidden>4.</span>
                If it is a scam, report it through the official channels below so others are warned.
              </li>
            </ol>
            <button
              onClick={askSasiAbout}
              className="mt-4 inline-flex h-10 items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-4 text-[12.5px] font-medium text-zinc-200 transition hover:border-white/25 hover:text-white"
            >
              Ask SASI to explain this message
              <ArrowRight className="h-3.5 w-3.5" aria-hidden />
            </button>
          </div>

          {/* official reporting channels (real, published numbers) */}
          <div className="space-y-3">
            <OfficialSource
              title="SASSA fraud & scam reporting"
              organisation="South African Social Security Agency"
              note="Toll-free fraud line: 0800 60 10 11. Report grant-related scams directly to SASSA."
            />
            <OfficialSource
              title="Report fraud & corruption"
              organisation="South African Police Service (SAPS)"
              note="Emergency line 10111. For online fraud, SAPS takes reports at any station — bring the message with you."
            />
            <OfficialSource
              title="Government services & contacts"
              organisation="South African Government (gov.za)"
              href="https://www.gov.za"
              note="The official government portal — use it to find every department's published contact details."
            />
          </div>
        </section>
      )}

      {/* ---------- honesty footer ---------- */}
      <div className="mt-8">
        <TrustNotice variant="warning">
          SASI&apos;s check is rule-based pattern recognition — it is a signal, not
          proof. A clean result does not mean a message is genuine, and a flagged
          message is not automatically fake. Only the organisation itself, contacted
          through its official channels, can confirm what is real.
        </TrustNotice>
      </div>
    </div>
  );
}
