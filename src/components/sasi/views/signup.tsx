"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { CheckCircle2, Eye, EyeOff, Loader2, ShieldCheck } from "lucide-react";
import { useSasiStore } from "@/lib/sasi/store";
import { PrimaryButton } from "@/components/sasi/primitives";
import { Input } from "@/components/ui/input";
import { signIn as nextAuthSignIn } from "next-auth/react";
import {
  AuthBrandPanel,
  AuthGlowField,
  AuthMobileBanner,
  AuthTopBar,
  AUTH_FIELD_INPUT,
  NATIONAL_DOT_GRADIENT,
} from "@/components/sasi/auth-brand";

/* ---------- Local, honest password strength (display only —
   the server enforces the real policy with zod + bcrypt) ---------- */
const STRENGTH_LABELS = ["Too short", "Weak", "Fair", "Strong", "Excellent"];

function strengthOf(pw: string): number {
  let s = 0;
  if (pw.length >= 8) s++;
  if (pw.length >= 12) s++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) s++;
  if (/\d/.test(pw) || /[^A-Za-z0-9]/.test(pw)) s++;
  return s;
}

const STRENGTH_COLORS = ["#ef5350", "#e3c567", "#66bb6a", "#43a047"];

export default function SignupView() {
  const navigate = useSasiStore((s) => s.navigate);
  const signIn = useSasiStore((s) => s.signIn);
  const setAccountName = useSasiStore((s) => s.setAccountName);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    const pending = timers.current;
    return () => pending.forEach(clearTimeout);
  }, []);

  const score = strengthOf(password);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading || success) return;
    setError(null);
    setLoading(true);

    /* REAL account creation: POST /api/sasi/auth/signup (zod validation,
       bcrypt cost 12, rate-limited) — then a real credentials sign-in. */
    try {
      const res = await fetch("/api/sasi/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), email: email.trim(), password }),
      });
      const data: { error?: string; user?: { name?: string } } = await res
        .json()
        .catch(() => ({}));
      if (!res.ok) {
        setLoading(false);
        setError(
          data.error ??
            "SASI could not create the account right now. Check the details and try again."
        );
        return;
      }
      if (data.user?.name) setAccountName(data.user.name);

      const si = await nextAuthSignIn("credentials", {
        redirect: false,
        email: email.trim(),
        password,
      });
      if (si?.error) {
        /* account exists but sign-in failed — send them to sign in honestly */
        setLoading(false);
        setError("Account created, but automatic sign-in failed. Please sign in.");
        return;
      }
    } catch {
      setLoading(false);
      setError(
        "SASI could not reach the signup service just now. Try again shortly."
      );
      return;
    }

    setLoading(false);
    setSuccess(true);
    signIn(); // keeps Services inside the app shell after this
    timers.current.push(setTimeout(() => navigate("dashboard"), 900));
  };

  return (
    <div className="relative flex min-h-screen w-full overflow-x-clip bg-[#050505]">
      <AuthTopBar />

      {/* ================= LEFT — brand panel (desktop only) ================= */}
      <AuthBrandPanel accent="gold" />

      {/* ================= RIGHT — form ================= */}
      <main className="relative flex w-full flex-1 flex-col items-center justify-center px-4 py-24 sm:px-6 lg:w-auto">
        <motion.div
          className="w-full max-w-[420px]"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: "easeOut" }}
        >
          {/* ------- SASIAUTH banner (mobile only) ------- */}
          <AuthMobileBanner accent="gold" />

          {/* ------- liquid glass form card ------- */}
          <div className="sasi-auth-card p-6 sm:p-8">
            <h1 className="sasi-serif text-[26px] font-medium tracking-tight text-white">
              Create your account
            </h1>
            <p className="mt-1.5 text-[13px] leading-relaxed text-zinc-500">
              Report problems, follow investigations and approve every action
              before it happens.
            </p>

            <form onSubmit={handleCreate} className="mt-7 space-y-4" noValidate>
              <div>
                <label
                  htmlFor="signup-name"
                  className="mb-1.5 block text-[12px] font-medium text-zinc-400"
                >
                  Full name
                </label>
                <AuthGlowField>
                  <Input
                    id="signup-name"
                    type="text"
                    autoComplete="name"
                    placeholder="Your name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className={AUTH_FIELD_INPUT}
                    aria-required="true"
                  />
                </AuthGlowField>
              </div>

              <div>
                <label
                  htmlFor="signup-email"
                  className="mb-1.5 block text-[12px] font-medium text-zinc-400"
                >
                  Email
                </label>
                <AuthGlowField>
                  <Input
                    id="signup-email"
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
                  htmlFor="signup-password"
                  className="mb-1.5 block text-[12px] font-medium text-zinc-400"
                >
                  Password
                </label>
                <AuthGlowField>
                  <div className="relative">
                    <Input
                      id="signup-password"
                      type={showPassword ? "text" : "password"}
                      autoComplete="new-password"
                      placeholder="Create a password"
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

                {/* strength indicator — text and colour only, no meter bars */}
                {password.length > 0 && (
                  <div
                    className="mt-2.5"
                    role="status"
                    aria-label={`Password strength: ${STRENGTH_LABELS[score]}`}
                  >
                    <div className="flex items-center gap-1.5">
                      <span
                        className="h-1.5 w-1.5 shrink-0 rounded-full transition-colors duration-300"
                        style={{
                          background: STRENGTH_COLORS[Math.min(score - 1, 3)],
                        }}
                        aria-hidden
                      />
                      <span className="text-[10.5px] font-medium uppercase tracking-[0.14em] text-zinc-500">
                        Strength: {STRENGTH_LABELS[score]}
                      </span>
                    </div>
                  </div>
                )}
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
                aria-label="Create account"
              >
                {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />}
                {success ? "Account created" : loading ? "Creating account…" : "Create account"}
              </PrimaryButton>

              {success && (
                <p
                  role="status"
                  className="flex items-center gap-2 rounded-xl border border-[#66bb6a]/20 bg-[#66bb6a]/5 p-3 text-[12px] text-[#8ee09a]"
                >
                  <CheckCircle2 className="h-3.5 w-3.5 shrink-0" aria-hidden />
                  Account created and signed in. Taking you to your dashboard…
                </p>
              )}
            </form>
          </div>

          {/* ---------- Toggle to sign in ---------- */}
          <div className="mt-4 flex min-h-[44px] items-center justify-between px-1 text-[12.5px]">
            <span className="text-zinc-600">Already have an account?</span>
            <button
              onClick={() => navigate("login")}
              className="inline-flex h-11 items-center font-medium text-zinc-300 underline-offset-2 transition-colors hover:text-white hover:underline"
              aria-label="Sign in instead"
            >
              Sign in
            </button>
          </div>

          {/* ---------- Terms note ---------- */}
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

          {/* ---------- Honesty line ---------- */}
          <p className="mt-3 flex items-center gap-2 px-1 text-[11.5px] text-zinc-600">
            <ShieldCheck
              className="h-3.5 w-3.5 shrink-0 text-[#e3c567]"
              aria-hidden
            />
            Passwords are hashed with bcrypt — SASI never sees or stores the
            plain text.
          </p>
          <p className="mt-1.5 flex items-center gap-2 px-1 text-[11.5px] text-zinc-600">
            <span
              aria-hidden
              className="h-1 w-1 shrink-0 rounded-full"
              style={{ background: NATIONAL_DOT_GRADIENT }}
            />
            Your reports stay on this device until you choose to act.
          </p>
        </motion.div>
      </main>
    </div>
  );
}
