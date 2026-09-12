import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

/* GET /api/sasi/me — the signed-in resident's REAL account identity
   straight from the database. Returns { user: null } for anonymous
   sessions; the client then falls back to the neutral "You" label.
   No fabrication: fields come from the User row created at signup. */
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    const email = session?.user?.email;
    if (!email) return NextResponse.json({ user: null });

    const user = await db.user.findUnique({
      where: { email },
      select: { name: true, email: true, createdAt: true },
    });

    return NextResponse.json({ user: user ?? null });
  } catch {
    return NextResponse.json({ user: null });
  }
}
