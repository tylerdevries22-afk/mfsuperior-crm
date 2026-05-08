import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "@/lib/db/schema";

/**
 * Single connection on the local TCP socket; Vercel/Neon's pooler endpoint
 * also speaks the standard wire protocol so this driver works in both
 * environments. (`@neondatabase/serverless` is only needed for edge runtimes,
 * which we don't target — all routes run in Node.)
 *
 * `postgres()` parses the URL eagerly but doesn't open a connection until
 * the first query, so during `next build` page-data collection (where
 * DATABASE_URL may not be injected) we substitute a placeholder URL. Real
 * runtime cold starts always have DATABASE_URL set.
 */
const databaseUrl =
  process.env.DATABASE_URL ?? "postgres://build:placeholder@localhost:5432/build";

const queryClient = postgres(databaseUrl, {
  prepare: false,
  max: 10,
});

export const db = drizzle(queryClient, { schema });

export type Database = typeof db;
