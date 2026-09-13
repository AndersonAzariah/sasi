import { NextResponse } from "next/server";

import { getAuthSession } from "@/lib/auth";
import { db } from "@/lib/db";

/* GET /api/sasi/me — the signed-in resident's REAL account identity
   straight from the database. Returns { user: null } for anonymous
   sessions; the client then falls back to the neutral "You" label.
   No fabrication: fields come from the User row created at signup.

   The lookup key is the session's user id (the JWT `sub`, verified by
   NextAuth) — never a client-supplied email or id. */
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const session = await getAuthSession();
    const userId = session?.user?.id;
    if (!userId) return NextResponse.json({ user: null });

    const user = await db.user.findUnique({
      where: { id: userId },
      select: { name: true, email: true, createdAt: true },
    });

    return NextResponse.json({ user: user ?? null });
  } catch {
    return NextResponse.json({ user: null });
  }
}
