"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { CheckCircle2, Eye, EyeOff, Info, Loader2 } from "lucide-react";
import { useSasiStore } from "@/lib/sasi/store";
import { DemoBadge, GhostButton, PrimaryButton } from "@/components/sasi/primitives";
import { Input } from "@/components/ui/input";
import { signIn as nextAuthSignIn } from "next-auth/react";
import {
  AuthBrandPanel,
  AuthGlowField,
  AuthTopBar,
  AUTH_FIELD_INPUT,
  NATIONAL_DOT_GRADIENT,
} from "@/components/sasi/auth-brand";

export default function LoginView() {
  const navigate = useSasiStore((s) => s.navigate);
  const signIn = useSasiStore((s) => s.signIn);
  const setAccountName = useSasiStore((s) => s.setAccountName);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [forgot, setForgot] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    const pending = timers.current;
    return () => pending.forEach(clearTimeout);
  }, []);

  const handleContinue = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading || success) return;
    setError(null);
    setLoading(true);

    /* REAL auth: NextAuth credentials provider → bcrypt compare → JWT
       cookie session. The demo store flag only mirrors the UI state. */
    try {
      const res = await nextAuthSignIn("credentials", {
        redirect: false,
        email: email.trim(),
        password,
      });
      if (res?.error) {
        setLoading(false);
        setError(
          "That email and password don't match an account. Check them and try again."
        );
        return;
      }
    } catch {
      setLoading(false);
      setError(
        "SASI could not reach the sign-in service just now. Try again shortly."
      );
      return;
    }

    setLoading(false);
    setSuccess(true);
    signIn(); // keeps Services inside the app shell after this

    /* surface the REAL account display name (best-effort; the neutral
       "You" placeholder stays if the session name is unavailable) */
    try {
      const session = await fetch("/api/auth/session", { cache: "no-store" });
      const data: { user?: { name?: string | null } } = await session.json().catch(() => ({}));
      if (data.user?.name) setAccountName(data.user.name);
    } catch {
      /* keep placeholder */
    }

    timers.current.push(setTimeout(() => navigate("dashboard"), 900));
  };

  return (
    <div className="relative flex min-h-screen w-full overflow-x-clip bg-[#050505]">
      <AuthTopBar />

      {/* ================= LEFT — brand panel (desktop only) ================= */}
      <AuthBrandPanel accent="red" />

      {/* ================= RIGHT — form ================= */}
      <main className="relative flex w-full flex-1 flex-col items-center justify-center px-4 py-24 sm:px-6 lg:w-auto">
        <motion.div
          className="w-full max-w-[420px]"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: "easeOut" }}
        >
          {/* ------- liquid glass form card ------- */}
          <div className="sasi-auth-card p-6 sm:p-8">
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
                <AuthGlowField>
                  <Input
                    id="login-email"
                    type="email"
                    autoComplete="email"
                    placeholder="you@example.co.za"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className={AUTH_FIELD_INPUT}
                    aria-required="true"
                  />
                </AuthGlowField>
              </div>

              <div>
                <label
                  htmlFor="login-password"
                  className="mb-1.5 block text-[12px] font-medium text-zinc-400"
                >
                  Password
                </label>
                <AuthGlowField>
                  <div className="relative">
                    <Input
                      id="login-password"
                      type={showPassword ? "text" : "password"}
                      autoComplete="current-password"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className={`${AUTH_FIELD_INPUT} pr-12`}
                      aria-required="true"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      aria-label={showPassword ? "Hide password" : "Show password"}
                      aria-pressed={showPassword}
                      className="absolute right-1 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-xl text-zinc-500 transition-colors hover:bg-white/5 hover:text-zinc-200"
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4" aria-hidden />
                      ) : (
                        <Eye className="h-4 w-4" aria-hidden />
                      )}
                    </button>
                  </div>
                </AuthGlowField>
              </div>

              {error && (
                <p
                  role="alert"
                  className="rounded-xl border border-[#ef5350]/25 bg-[#ef5350]/[0.06] p-3 text-[12px] leading-relaxed text-[#fda4a0]"
                >
                  {error}
                </p>
              )}

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
                  className="flex items-center gap-2 rounded-xl border border-[#66bb6a]/20 bg-[#66bb6a]/5 p-3 text-[12px] text-[#8ee09a]"
                >
                  <CheckCircle2 className="h-3.5 w-3.5 shrink-0" aria-hidden />
                  Signed in. Taking you to your dashboard…
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
          </div>

          {/* ---------- Links under the card ---------- */}
          <div className="mt-4 flex items-center justify-between px-1 text-[12.5px]">
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
              className="mt-3 flex items-center gap-2 rounded-xl border border-white/8 bg-white/[0.02] p-3 text-[12px] text-zinc-400"
            >
              <Info className="h-3.5 w-3.5 shrink-0 text-zinc-500" aria-hidden />
              Password reset isn&apos;t available yet in this environment.
            </p>
          )}

          {/* ---------- Terms note + honesty ---------- */}
          <p className="mt-6 px-1 text-[11.5px] leading-relaxed text-zinc-600">
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
          <p className="mt-3 flex items-center gap-2 px-1 text-[11.5px] text-zinc-600">
            <span
              aria-hidden
              className="h-1 w-1 shrink-0 rounded-full"
              style={{ background: NATIONAL_DOT_GRADIENT }}
            />
            Real accounts — passwords are verified server-side, never stored in
            plain text.
          </p>
        </motion.div>
      </main>
    </div>
  );
}
