import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { env } from "@/lib/env";
import * as schema from "@/lib/db/schema";

/**
 * Single connection on the local TCP socket; Vercel/Neon's pooler endpoint
 * also speaks the standard wire protocol so this driver works in both
 * environments. (`@neondatabase/serverless` is only needed for edge runtimes,
 * which we don't target — all routes run in Node.)
 */
const queryClient = postgres(env().DATABASE_URL, {
  prepare: false,
  max: 10,
});

export const db = drizzle(queryClient, { schema });

export type Database = typeof db;
