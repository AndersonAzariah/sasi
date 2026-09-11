import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/lib/db";
import { rateLimit } from "@/lib/sasi/api-auth";

/* ============================================================
   POST /api/sasi/auth/signup — the only account-creation path.
   Runtime validation (zod), bcrypt cost 12, normalized email.
   On success the client still calls signIn("credentials", …) to
   establish the real session — this route NEVER fabricates one.
   ============================================================ */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SignupSchema = z.object({
  name: z.string().trim().min(1, "Your name is required.").max(80),
  email: z.string().trim().toLowerCase().email("That email doesn't look right.").max(254),
  password: z
    .string()
    .min(8, "Use at least 8 characters for your password.")
    .max(128, "Passwords this long are not supported."),
});

function clientKey(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  return (fwd ? fwd.split(",")[0].trim() : null) ?? "local";
}

export async function POST(req: Request) {
  const limit = rateLimit(`signup:${clientKey(req)}`, 5, 60 * 60 * 1000);
  if (!limit.ok) {
    return NextResponse.json(
      { error: "Too many signup attempts from this device. Try again in an hour." },
      { status: 429 }
    );
  }

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const parsed = SignupSchema.safeParse(raw);
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "Check the form and try again.";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const { name, email, password } = parsed.data;

  try {
    const existing = await db.user.findUnique({ where: { email } });
    if (existing) {
      /* Do not reveal more than necessary; this is the standard,
         honest message every signup form shows. */
      return NextResponse.json(
        { error: "An account with this email already exists. Sign in instead." },
        { status: 409 }
      );
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await db.user.create({
      data: { name, email, passwordHash },
      select: { id: true, name: true, email: true }, // never the hash
    });

    /* Audit: a real account event, recorded by the server. */
    await db.auditEvent.create({
      data: {
        userId: user.id,
        eventType: "ACCOUNT_CREATED",
        actor: "SYSTEM",
        description: "Account created.",
      },
    });

    return NextResponse.json({ ok: true, user }, { status: 201 });
  } catch (err) {
    console.error("[/api/sasi/auth/signup] failed:", err);
    return NextResponse.json(
      { error: "SASI could not create the account right now. Please try again." },
      { status: 500 }
    );
  }
}
