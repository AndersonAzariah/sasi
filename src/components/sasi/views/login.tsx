"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, CheckCircle2, Info, Loader2 } from "lucide-react";
import { useSasiStore } from "@/lib/sasi/store";
import { DEMO_USER } from "@/lib/sasi/data";
import {
  DemoBadge,
  GhostButton,
  PrimaryButton,
  SasiLogo,
} from "@/components/sasi/primitives";
import { Input } from "@/components/ui/input";

/* Shared field shell — circulating national glow ring appears on focus */
function GlowField({ children }: { children: React.ReactNode }) {
  return (
    <div className="sasi-search-glow rounded-lg border border-white/10 bg-white/[0.02] transition-colors focus-within:border-white/20">
      {children}
    </div>
  );
}

const FIELD_INPUT =
  "h-11 rounded-lg border-0 bg-transparent text-[13px] shadow-none focus-visible:shadow-none focus-visible:ring-0";

const NATIONAL_DOT_GRADIENT =
  "linear-gradient(90deg, #ef5350, #64b5f6, #66bb6a, #e3c567)";

export default function LoginView() {
  const navigate = useSasiStore((s) => s.navigate);
  const signIn = useSasiStore((s) => s.signIn);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [forgot, setForgot] = useState(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    const pending = timers.current;
    return () => pending.forEach(clearTimeout);
  }, []);

  const handleContinue = (e: React.FormEvent) => {
    e.preventDefault();
    if (loading || success) return;
    setLoading(true);
    timers.current.push(
      setTimeout(() => {
        setLoading(false);
        setSuccess(true);
        signIn(); // keeps Services inside the app shell after this
        timers.current.push(
          setTimeout(() => navigate("dashboard"), 900)
        );
      }, 900)
    );
  };

  return (
    <div className="relative flex min-h-screen w-full overflow-x-clip bg-[#050505]">
      {/* ================= LEFT — brand panel (desktop only) ================= */}
      <aside
        aria-hidden={false}
        className="relative hidden w-[44%] max-w-[620px] shrink-0 flex-col justify-between overflow-hidden border-r border-white/6 bg-[#070708] p-10 lg:flex xl:p-14"
      >
        {/* giant outlined background word with circulating national light */}
        <div aria-hidden className="sasi-hero-word">
          SASI
        </div>

        {/* breathing national ambience */}
        <div
          aria-hidden
          className="sasi-ambient -left-24 -top-24 h-96 w-96"
          style={{
            background: "radial-gradient(closest-side, rgba(229,57,53,0.11), transparent)",
          }}
        />
        <div
          aria-hidden
          className="sasi-ambient -bottom-32 right-[-10%] h-[420px] w-[420px]"
          style={{
            background: "radial-gradient(closest-side, rgba(66,165,245,0.10), transparent)",
          }}
        />

        {/* top — editorial eyebrow */}
        <div className="relative">
          <div className="sasi-eyebrow text-zinc-400">
            <span
              aria-hidden
              className="sasi-breathe h-1.5 w-1.5 rounded-full"
              style={{ background: NATIONAL_DOT_GRADIENT }}
            />
            Service intelligence
          </div>
        </div>

        {/* middle — serif statement */}
        <div className="relative max-w-md">
          <h2 className="sasi-serif text-[38px] font-medium leading-[1.1] tracking-tight text-white xl:text-[44px]">
            Service intelligence for South&nbsp;Africa.
          </h2>
          <p className="mt-5 max-w-sm text-[13.5px] leading-relaxed text-zinc-500">
            Independent civic technology. Not a government website.
          </p>
        </div>

        {/* bottom — national accent dot */}
        <div className="relative flex items-center gap-3">
          <span
            aria-hidden
            className="h-1.5 w-1.5 shrink-0 rounded-full"
            style={{ background: NATIONAL_DOT_GRADIENT }}
          />
          <p className="text-[10.5px] font-medium uppercase tracking-[0.24em] text-zinc-600">
            South African Service Intelligence
          </p>
        </div>
      </aside>

      {/* ================= RIGHT — form ================= */}
      <main className="relative flex w-full flex-1 flex-col items-center justify-center px-4 py-12 sm:px-6 lg:w-auto">
        <motion.div
          className="w-full max-w-[400px]"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: "easeOut" }}
        >
          {/* compact brand header — mobile only */}
          <div className="mb-9 lg:hidden">
            <SasiLogo size={28} />
            <div className="sasi-line mt-7" aria-hidden />
          </div>

          <h1 className="sasi-serif text-[26px] font-medium tracking-tight text-white">
            Sign in
          </h1>
          <p className="mt-1.5 text-[13px] text-zinc-500">
            Your cases, evidence and approvals — in one place.
          </p>

          <form onSubmit={handleContinue} className="mt-7 space-y-4" noValidate>
            <div>
              <label
                htmlFor="login-email"
                className="mb-1.5 block text-[12px] font-medium text-zinc-400"
              >
                Email
              </label>
              <GlowField>
                <Input
                  id="login-email"
                  type="email"
                  autoComplete="email"
                  placeholder="you@example.co.za"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={FIELD_INPUT}
                  aria-required="true"
                />
              </GlowField>
            </div>

            <div>
              <label
                htmlFor="login-password"
                className="mb-1.5 block text-[12px] font-medium text-zinc-400"
              >
                Password
              </label>
              <GlowField>
                <Input
                  id="login-password"
                  type="password"
                  autoComplete="current-password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={FIELD_INPUT}
                  aria-required="true"
                />
              </GlowField>
            </div>

            <PrimaryButton
              type="submit"
              disabled={loading || success}
              className="sasi-btn-white-glass mt-1 h-11 w-full text-[13.5px]"
              aria-label="Continue — sign in"
            >
              {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />}
              {success ? "Signed in" : loading ? "Signing in…" : "Continue"}
            </PrimaryButton>

            {success && (
              <p
                role="status"
                className="flex items-center gap-2 rounded-lg border border-[#66bb6a]/20 bg-[#66bb6a]/5 p-3 text-[12px] text-[#8ee09a]"
              >
                <CheckCircle2 className="h-3.5 w-3.5 shrink-0" aria-hidden />
                Signed in as {DEMO_USER.name} (demo). Taking you to your dashboard…
              </p>
            )}
          </form>

          {/* ---------- Divider ---------- */}
          <div className="my-6 flex items-center gap-3" aria-hidden>
            <span className="h-px flex-1 bg-white/8" />
            <span className="text-[10.5px] uppercase tracking-[0.18em] text-zinc-600">or</span>
            <span className="h-px flex-1 bg-white/8" />
          </div>

          <GhostButton
            disabled
            className="sasi-btn-glass h-11 w-full cursor-not-allowed opacity-60"
            aria-label="Continue with SA ID — coming soon"
            aria-disabled="true"
          >
            Continue with SA ID
            <DemoBadge label="COMING SOON" />
          </GhostButton>

          {/* ---------- Links ---------- */}
          <div className="mt-4 flex items-center justify-between text-[12.5px]">
            <button
              onClick={() => navigate("signup")}
              className="inline-flex h-11 items-center font-medium text-zinc-300 underline-offset-2 transition-colors hover:text-white hover:underline"
            >
              Create account
            </button>
            <button
              onClick={() => setForgot(true)}
              className="inline-flex h-11 items-center text-zinc-500 underline-offset-2 transition-colors hover:text-zinc-300 hover:underline"
            >
              Forgot password
            </button>
          </div>
          {forgot && (
            <p
              role="status"
              className="mt-3 flex items-center gap-2 rounded-lg border border-white/8 bg-white/[0.02] p-3 text-[12px] text-zinc-400"
            >
              <Info className="h-3.5 w-3.5 shrink-0 text-zinc-500" aria-hidden />
              Password reset is coming soon (demo).
            </p>
          )}

          {/* ---------- Terms note ---------- */}
          <p className="mt-6 text-[11.5px] leading-relaxed text-zinc-600">
            By continuing you agree to the{" "}
            <button
              onClick={() => navigate("terms")}
              className="underline underline-offset-2 transition-colors hover:text-zinc-300"
            >
              Terms
            </button>{" "}
            and{" "}
            <button
              onClick={() => navigate("privacy")}
              className="underline underline-offset-2 transition-colors hover:text-zinc-300"
            >
              Privacy statement
            </button>
            .
          </p>

          {/* ---------- Back to home + demo hint ---------- */}
          <div className="mt-4 flex flex-col gap-1">
            <button
              onClick={() => navigate("landing")}
              className="inline-flex h-11 w-fit items-center gap-1.5 text-[12px] text-zinc-600 transition-colors hover:text-zinc-300"
            >
              <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
              Back to home
            </button>
            <p className="flex items-center gap-2 text-[11.5px] text-zinc-600">
              <Info className="h-3.5 w-3.5 shrink-0 text-[#e3c567]" aria-hidden />
              Demo environment — any credentials work.
            </p>
          </div>
        </motion.div>
      </main>
    </div>
  );
}
