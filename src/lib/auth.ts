import bcrypt from "bcryptjs";
import { getServerSession, type NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";

import { db } from "@/lib/db";
import { rateLimitService } from "@/lib/sasi/api-auth";

/* ============================================================
   SASI — authentication (NextAuth v4, credentials + JWT sessions)

   - Passwords are stored ONLY as bcrypt hashes (cost 12).
   - Sessions are stateless JWTs in an httpOnly cookie; the user's
     database id rides in the token (sub) and is surfaced on
     session.user.id for every server-side authorization check.
   - No OAuth/email providers are configured — signup is the only
     account-creation path (POST /api/sasi/auth/signup).
   - The SPA renders its own sign-in surface (/ ?view=login), so
     NextAuth's built-in pages are never shown.

   PRODUCTION RESILIENCE (Task 29): NextAuth v4 requires a trusted
   origin in production. When NEXTAUTH_URL is not set explicitly, the
   canonical Vercel URL (VERCEL_PROJECT_PRODUCTION_URL / VERCEL_URL)
   is used so a fresh deployment works before any custom env var is
   configured. Setting NEXTAUTH_URL explicitly always wins.
   ============================================================ */

/** Trusted origin resolution — explicit env first, Vercel's automatic
    deployment variables next, localhost as the dev fallback. */
function resolveAuthUrl(): string {
  const explicit = process.env.NEXTAUTH_URL?.trim();
  if (explicit) return explicit.replace(/\/$/, "");
  const vercelProduction = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  if (vercelProduction) return `https://${vercelProduction.replace(/\/$/, "")}`;
  const vercelUrl = process.env.VERCEL_URL?.trim();
  if (vercelUrl) return `https://${vercelUrl.replace(/\/$/, "")}`;
  return "http://localhost:3000";
}

/* NextAuth v4 reads NEXTAUTH_URL from the environment at request time —
   seed it with the derived value when it is not configured so a fresh
   Vercel deployment trusts its own production URL without extra setup. */
if (!process.env.NEXTAUTH_URL?.trim()) {
  process.env.NEXTAUTH_URL = resolveAuthUrl();
}

/* Module augmentation: every session carries the real database id. */
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
    };
  }
  interface User {
    id: string;
    name?: string | null;
    email?: string | null;
  }
}

export const authOptions: NextAuthOptions = {
  session: {
    strategy: "jwt",
    /* 30 days — a resident's phone should stay signed in like an app. */
    maxAge: 30 * 24 * 60 * 60,
  },
  pages: {
    /* the SPA owns sign-in UI; NextAuth never renders a page */
    signIn: "/",
    error: "/",
  },
  providers: [
    CredentialsProvider({
      name: "Email and password",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const email = credentials?.email?.trim().toLowerCase() ?? "";
        const password = credentials?.password ?? "";
        if (!email || !password || email.length > 254 || password.length > 128) {
          return null;
        }

        /* Brute-force throttle: max 10 attempts per email per 5 minutes
           (in-memory, per server process — honest scope). Throttled
           attempts fail with the same generic outcome as a wrong
           password, so the throttle is invisible to legitimate users
           and unhelpful to attackers. */
        const attempt = await rateLimitService.limit(
          `login:${email}`,
          10,
          5 * 60_000
        );
        if (!attempt.allowed) return null;

        const user = await db.user.findUnique({ where: { email } });

        /* Constant-work comparison: when the account does not exist we
           still burn one bcrypt compare against a fixed hash, so
           response timing does not reveal whether an email is registered. */
        const DUMMY_HASH = "$2a$12$C6UzMDM.H6dfI/f/IKcEeO7ZDZQj1Vp1p2b3E4fF5gG6hH7iI8jJk";
        const hash = user?.passwordHash ?? DUMMY_HASH;
        const valid = await bcrypt.compare(password, hash).catch(() => false);

        if (!user || !valid) return null;

        /* Only safe, non-secret fields ever leave this function. */
        return { id: user.id, name: user.name, email: user.email };
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user?.id) token.sub = user.id;
      return token;
    },
    session({ session, token }) {
      if (token.sub) session.user.id = token.sub;
      return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
};

/** Server-side session accessor for API routes. */
export function getAuthSession() {
  return getServerSession(authOptions);
}
