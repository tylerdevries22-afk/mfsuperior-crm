import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { env } from "@/lib/env";
import * as schema from "@/lib/db/schema";

/**
 * Single connection on the local TCP socket; Vercel/Neon's pooler endpoint
 * also speaks the standard wire protocol so this driver works in both
 * environments. (`@neondatabase/serverless` is only needed for edge runtimes,
 * which we don't target — all routes run in Node.)
 *
 * `postgres-js` is lazy — passing a URL here only parses it; the TCP
 * connection isn't opened until the first query. That lets `next build`
 * succeed before DATABASE_URL is set: we fall back to a placeholder URL so
 * adapter/schema introspection works, and any actual query at runtime will
 * fail loudly with a clear "DATABASE_URL is not set" message.
 */
const BUILD_FALLBACK_URL =
  "postgres://placeholder:placeholder@localhost:5432/placeholder";

const url = env().DATABASE_URL ?? BUILD_FALLBACK_URL;

const queryClient = postgres(url, {
  prepare: false,
  max: 10,
});

export const db = drizzle(queryClient, { schema });

export type Database = typeof db;
