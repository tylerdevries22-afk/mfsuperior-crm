import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import {
  organizationMemberships,
  organizations,
} from "@/lib/db/schema";
import { fetchWithRetry } from "@/lib/mobile-api/external-fetch";

type HealthChecks = {
  readonly database: boolean;
  readonly mobileBackend: boolean;
  readonly webAdmin: boolean;
};

/** Minimal dependency health for deployment checks and uptime monitoring. */
export async function GET() {
  const [database, mobileBackend] = await Promise.all([
    databaseHealth(),
    mobileBackendHealth(),
  ]);
  const checks: HealthChecks = {
    database: database.available,
    mobileBackend,
    webAdmin: database.webAdmin,
  };
  const healthy = Object.values(checks).every(Boolean);
  return NextResponse.json(
    { checks, status: healthy ? "healthy" : "degraded" },
    {
      status: healthy ? 200 : 503,
      headers: { "Cache-Control": "private, no-store" },
    },
  );
}

async function databaseHealth(): Promise<{
  readonly available: boolean;
  readonly webAdmin: boolean;
}> {
  const organizationSlug = process.env.WEB_ADMIN_ORGANIZATION_SLUG?.trim()
    || "mf-superior";
  try {
    const [admin] = await db
      .select({ id: organizationMemberships.id })
      .from(organizationMemberships)
      .innerJoin(
        organizations,
        eq(organizations.id, organizationMemberships.organizationId),
      )
      .where(and(
        eq(organizationMemberships.role, "admin"),
        eq(organizationMemberships.status, "active"),
        eq(organizations.status, "active"),
        eq(organizations.slug, organizationSlug),
      ))
      .limit(1);
    return { available: true, webAdmin: Boolean(admin) };
  } catch (error) {
    console.error(JSON.stringify({
      severity: "error",
      event: "health_database_failed",
      errorName: error instanceof Error ? error.name : "unknown",
    }));
    return { available: false, webAdmin: false };
  }
}

async function mobileBackendHealth(): Promise<boolean> {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY
    ?? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (
    !url
    || !publishableKey
    || !process.env.SUPABASE_SERVICE_ROLE_KEY
    || !process.env.SUPABASE_STORAGE_BUCKET
  ) {
    return false;
  }
  try {
    const response = await fetchWithRetry(
      new URL("/auth/v1/health", url),
      { headers: { apikey: publishableKey } },
      { maxAttempts: 2, timeoutMs: 2_000 },
    );
    return response.ok;
  } catch {
    return false;
  }
}
