"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { CheckCircle2, Info, Loader2 } from "lucide-react";
import { useSasiStore } from "@/lib/sasi/store";
import { DEMO_USER } from "@/lib/sasi/data";
import {
  DemoBadge,
  GhostButton,
  PrimaryButton,
  SasiLogo,
} from "@/components/sasi/primitives";
import { Input } from "@/components/ui/input";

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
    <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6">
      <motion.div
        className="mx-auto w-full max-w-sm"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: "easeOut" }}
      >
        {/* ---------- Sign-in card ---------- */}
        <div className="sasi-card sasi-pulse sasi-pulse-multi p-6">
          <SasiLogo size={30} />

          <h1 className="mt-5 text-[17px] font-semibold tracking-tight text-white">
            Sign in to SASI
          </h1>
          <p className="mt-1 text-[12.5px] text-zinc-500">
            Your cases, evidence and approvals — in one place.
          </p>

          <form onSubmit={handleContinue} className="mt-5 space-y-4" noValidate>
            <div>
              <label htmlFor="login-email" className="mb-1.5 block text-[12px] font-medium text-zinc-400">
                Email
              </label>
              <Input
                id="login-email"
                type="email"
                autoComplete="email"
                placeholder="you@example.co.za"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="text-[13px]"
                aria-required="true"
              />
            </div>
            <div>
              <label htmlFor="login-password" className="mb-1.5 block text-[12px] font-medium text-zinc-400">
                Password
              </label>
              <Input
                id="login-password"
                type="password"
                autoComplete="current-password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="text-[13px]"
                aria-required="true"
              />
            </div>

            <PrimaryButton
              type="submit"
              disabled={loading || success}
              className="w-full"
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
          <div className="my-5 flex items-center gap-3" aria-hidden>
            <span className="h-px flex-1 bg-white/8" />
            <span className="text-[11px] uppercase tracking-[0.14em] text-zinc-600">or</span>
            <span className="h-px flex-1 bg-white/8" />
          </div>

          <GhostButton
            disabled
            className="w-full cursor-not-allowed opacity-60"
            aria-label="Continue with SA ID — coming soon"
            aria-disabled="true"
          >
            Continue with SA ID
            <DemoBadge label="COMING SOON" />
          </GhostButton>

          {/* ---------- Links ---------- */}
          <div className="mt-5 flex items-center justify-between text-[12px]">
            <button
              onClick={() => navigate("signup")}
              className="font-medium text-zinc-300 underline-offset-2 transition-colors hover:text-white hover:underline"
            >
              Create account
            </button>
            <button
              onClick={() => setForgot(true)}
              className="text-zinc-500 underline-offset-2 transition-colors hover:text-zinc-300 hover:underline"
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
          <p className="mt-5 border-t border-white/5 pt-4 text-[11.5px] leading-relaxed text-zinc-600">
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
        </div>

        {/* ---------- Demo hint ---------- */}
        <div className="sasi-card mt-4 flex items-start gap-2.5 p-4">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#e3c567]" aria-hidden />
          <p className="text-[12px] leading-relaxed text-zinc-400">
            Demo environment — any credentials work.
          </p>
        </div>
      </motion.div>
    </div>
  );
}
