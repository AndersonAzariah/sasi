/**
 * Idempotent golden-path account bootstrap.
 *
 * This sandbox wipes db/custom.db between sessions and `.zscripts/dev.sh`
 * runs `bun run db:push` on every dev-server start. This script (chained
 * via the `postdb:push` npm hook) re-creates the QA account ONLY when it
 * is missing — using the exact same server-side logic as the real signup
 * API (bcrypt cost 12, audit event). It never touches existing rows.
 *
 * Zero-fake-data note: this creates one REAL account (a QA fixture),
 * not demo content — the app's data surfaces stay user-generated-only.
 */
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const EMAIL = "golden.path@sasi.test";
const NAME = "Golden Path Tester";
const PASSWORD = "SasiGolden!2026";

const db = new PrismaClient();

try {
  const existing = await db.user.findUnique({ where: { email: EMAIL } });
  if (existing) {
    console.log(`[ensure-golden-path] ${EMAIL} already exists — nothing to do.`);
  } else {
    const passwordHash = await bcrypt.hash(PASSWORD, 12);
    const user = await db.user.create({
      data: { name: NAME, email: EMAIL, passwordHash },
      select: { id: true, email: true },
    });
    await db.auditEvent.create({
      data: {
        userId: user.id,
        eventType: "ACCOUNT_CREATED",
        actor: "SYSTEM",
        description: "Account created (golden-path QA bootstrap).",
      },
    });
    console.log(`[ensure-golden-path] created ${EMAIL} (${user.id}).`);
  }
} catch (err) {
  console.error("[ensure-golden-path] failed:", err?.message ?? err);
  process.exitCode = 1;
} finally {
  await db.$disconnect();
}
