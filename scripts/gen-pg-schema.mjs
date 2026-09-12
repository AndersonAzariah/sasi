/**
 * Regenerate supabase/migrations/0001_init.sql from prisma/schema.prisma.
 *
 * Since Task 28 the single source of truth (prisma/schema.prisma) is
 * PostgreSQL-native — local development, CI and production all use the
 * same Supabase PostgreSQL architecture. This script keeps the committed
 * SQL snapshot in supabase/migrations/ in lock-step with the schema, so
 * it can be pasted into the Supabase SQL Editor at any time:
 *
 *   bun scripts/gen-pg-schema.mjs
 *
 * (Historical name kept: this used to derive a postgres schema from a
 * SQLite source of truth. That fork is gone — one schema everywhere.)
 */
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";

const SRC = "prisma/schema.prisma";
const DEST = "supabase/migrations/0001_init.sql";

const src = readFileSync(SRC, "utf8");
if (!src.includes('provider = "postgresql"')) {
  console.error("[gen-pg-schema] FAILED: prisma/schema.prisma is not PostgreSQL-native.");
  process.exit(1);
}

const sql = execFileSync(
  "bunx",
  [
    "prisma",
    "migrate",
    "diff",
    "--from-empty",
    "--to-schema-datamodel",
    SRC,
    "--script",
  ],
  { encoding: "utf8", maxBuffer: 16 * 1024 * 1024 },
);

writeFileSync(DEST, sql);
console.log(`[gen-pg-schema] wrote ${DEST} (${sql.split("\n").length} lines) from the PostgreSQL-native schema.`);
