/**
 * Generate prisma/schema.postgres.prisma from prisma/schema.prisma.
 *
 * SASI keeps ONE source of truth for the data model (prisma/schema.prisma,
 * written against SQLite so the sandbox dev server works offline). The
 * production database is Supabase PostgreSQL — this script derives the
 * identical model set with a postgres datasource. Run before any command
 * that targets Supabase:
 *
 *   bun scripts/gen-pg-schema.mjs
 *   bunx prisma db push --schema prisma/schema.postgres.prisma
 *   bunx prisma migrate diff --from-empty --to-schema-datamodel \
 *        prisma/schema.postgres.prisma --script > supabase/migrations/0001_init.sql
 *
 * The GitHub Action "supabase-db" does all of this automatically.
 */
import { readFileSync, writeFileSync } from "node:fs";

const SRC = "prisma/schema.prisma";
const DEST = "prisma/schema.postgres.prisma";

const src = readFileSync(SRC, "utf8");

const out = src.replace(
  /datasource db \{[\s\S]*?\n\}/,
  'datasource db {\n  provider = "postgresql"\n  url      = env("DATABASE_URL")\n}'
);

if (out === src || !out.includes('provider = "postgresql"')) {
  console.error("[gen-pg-schema] FAILED: datasource block was not replaced.");
  process.exit(1);
}

writeFileSync(DEST, out);
console.log(`[gen-pg-schema] wrote ${DEST} (postgresql datasource, identical models)`);
