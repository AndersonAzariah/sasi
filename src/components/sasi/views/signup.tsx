"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { CheckCircle2, Eye, EyeOff, Info, Loader2 } from "lucide-react";
import { useSasiStore } from "@/lib/sasi/store";
import {
  DemoBadge,
  GhostButton,
  PrimaryButton,
  SasiLogo,
} from "@/components/sasi/primitives";
import { Input } from "@/components/ui/input";

export default function SignupView() {
  const navigate = useSasiStore((s) => s.navigate);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    const pending = timers.current;
    return () => pending.forEach(clearTimeout);
  }, []);

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (loading || success) return;
    setLoading(true);
    timers.current.push(
      setTimeout(() => {
        setLoading(false);
        setSuccess(true);
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
        {/* ---------- Sign-up card ---------- */}
        <div className="sasi-card sasi-pulse sasi-pulse-multi p-6">
          <SasiLogo size={30} />

          <h1 className="mt-5 text-[17px] font-semibold tracking-tight text-white">
            Create your SASI account
          </h1>
          <p className="mt-1 text-[12.5px] leading-relaxed text-zinc-500">
            Report problems, follow investigations and approve every action before it happens.
          </p>

          <form onSubmit={handleCreate} className="mt-5 space-y-4" noValidate>
            <div>
              <label htmlFor="signup-name" className="mb-1.5 block text-[12px] font-medium text-zinc-400">
                Full name
              </label>
              <Input
                id="signup-name"
                type="text"
                autoComplete="name"
                placeholder="Your name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="text-[13px]"
                aria-required="true"
              />
            </div>
            <div>
              <label htmlFor="signup-email" className="mb-1.5 block text-[12px] font-medium text-zinc-400">
                Email
              </label>
              <Input
                id="signup-email"
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
              <label htmlFor="signup-password" className="mb-1.5 block text-[12px] font-medium text-zinc-400">
                Password
              </label>
              <div className="relative">
                <Input
                  id="signup-password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  placeholder="Create a password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pr-10 text-[13px]"
                  aria-required="true"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  aria-pressed={showPassword}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1.5 text-zinc-500 transition-colors hover:bg-white/5 hover:text-zinc-200"
                >
                  {showPassword ? (
                    <EyeOff className="h-3.5 w-3.5" aria-hidden />
                  ) : (
                    <Eye className="h-3.5 w-3.5" aria-hidden />
                  )}
                </button>
              </div>
            </div>

            <PrimaryButton
              type="submit"
              disabled={loading || success}
              className="w-full"
              aria-label="Create account"
            >
              {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />}
              {success ? "Account created" : loading ? "Creating account…" : "Create account"}
            </PrimaryButton>

            {success && (
              <p
                role="status"
                className="flex items-center gap-2 rounded-lg border border-[#66bb6a]/20 bg-[#66bb6a]/5 p-3 text-[12px] text-[#8ee09a]"
              >
                <CheckCircle2 className="h-3.5 w-3.5 shrink-0" aria-hidden />
                Account created (demo). Taking you to your dashboard…
              </p>
            )}
          </form>

          {/* ---------- Links ---------- */}
          <div className="mt-5 flex items-center justify-between text-[12px]">
            <span className="text-zinc-600">Already have an account?</span>
            <GhostButton
              onClick={() => navigate("login")}
              className="h-8 px-3 text-[12px]"
              aria-label="Sign in instead"
            >
              Sign in
            </GhostButton>
          </div>

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
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-[12px] leading-relaxed text-zinc-400">
              Accounts are local to this demo.
            </p>
            <DemoBadge label="NOT SENT ANYWHERE" />
          </div>
        </div>
      </motion.div>
    </div>
  );
}
