import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

const { createSignedUrls } = vi.hoisted(() => ({
  createSignedUrls: vi.fn(),
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    storage: {
      from: () => ({ createSignedUrls }),
    },
  }),
}));

import { sendExpoPushNotification } from "@/lib/mobile-api/push";
import { readBoundedBody } from "@/lib/http/read-bounded-body";
import {
  signVehicleThumbnailReads,
  vehicleThumbnailPathBelongsTo,
} from "@/lib/mobile-api/upload-signer";

const ROOT = resolve(import.meta.dirname, "../..");

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  createSignedUrls.mockReset();
});

describe("mobile security hardening", () => {
  it("returns only private, expiring thumbnail reads for tenant-owned paths", async () => {
    const path = "tenant-a/vehicles/vehicle-a/photo.jpg";
    vi.stubEnv("SUPABASE_URL", "https://tenant.supabase.co");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "s".repeat(40));
    createSignedUrls.mockResolvedValue({
      data: [{
        error: null,
        path,
        signedURL: `/object/sign/vehicle-thumbnails/${path}?token=secret`,
        signedUrl: `https://tenant.supabase.co/storage/v1/object/sign/vehicle-thumbnails/${path}?token=secret`,
      }],
      error: null,
    });

    const urls = await signVehicleThumbnailReads([path, path]);

    expect(createSignedUrls).toHaveBeenCalledWith([path], 3_600);
    expect(urls.get(path)).toContain("/object/sign/");
    expect(urls.get(path)).not.toContain("/object/public/");
    expect(vehicleThumbnailPathBelongsTo(path, "tenant-a", "vehicle-a")).toBe(true);
    expect(vehicleThumbnailPathBelongsTo(path, "tenant-b", "vehicle-a")).toBe(false);
  });

  it("recognizes permanently invalid Expo tokens without retrying the device", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({
      data: { details: { error: "DeviceNotRegistered" }, status: "error" },
    }), {
      headers: { "content-type": "application/json" },
      status: 200,
    }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(sendExpoPushNotification({
      body: "Unit T-101 is assigned to you.",
      data: { eventId: "event-a" },
      title: "Vehicle transferred",
      to: "ExponentPushToken[device-token]",
    })).resolves.toEqual({ accepted: false, permanentlyRejected: true });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("locks direct tenant-table access and makes fleet images private", () => {
    const migration = readFileSync(
      resolve(
        ROOT,
        "supabase/migrations/20260828074652_harden_tenant_storage_and_push_tokens.sql",
      ),
      "utf8",
    );

    expect(migration).toContain("enable row level security");
    expect(migration).toContain("revoke all privileges on table");
    expect(migration).toMatch(/update storage\.buckets[\s\S]*set public = false/);
    expect(migration).toContain("mobile_push_tokens_token_unique");
    expect(migration).toContain("grant select on public.vehicle_transfer_events to authenticated");
  });

  it("requires MFA for financial writes and ownership checks for token removal", () => {
    for (const route of [
      "src/app/api/mobile/v1/payouts/route.ts",
      "src/app/api/mobile/v1/payouts/[id]/payment/route.ts",
    ]) {
      expect(readFileSync(resolve(ROOT, route), "utf8")).toContain("requireMfa: true");
    }

    const tokenRoute = readFileSync(
      resolve(ROOT, "src/app/api/mobile/v1/notification-tokens/route.ts"),
      "utf8",
    );
    expect(tokenRoute).toContain("export async function DELETE");
    expect(tokenRoute).toContain("eq(mobilePushTokens.organizationId, principal.organizationId)");
    expect(tokenRoute).toContain("eq(mobilePushTokens.userId, principal.userId)");

    const webAuth = readFileSync(resolve(ROOT, "src/lib/auth.ts"), "utf8");
    expect(webAuth).toContain("return webAdminAccessAllowed({ email: user.email })");
    expect(webAuth).toContain('eq(organizationMemberships.role, "admin")');
    expect(webAuth).toContain('eq(organizationMemberships.status, "active")');
    expect(webAuth).toContain('eq(organizations.status, "active")');
    expect(webAuth).toContain("eq(organizations.slug, organizationSlug)");

    const healthRoute = readFileSync(
      resolve(ROOT, "src/app/api/health/route.ts"),
      "utf8",
    );
    expect(healthRoute).toContain('status: healthy ? 200 : 503');
    expect(healthRoute).toContain('"Cache-Control": "private, no-store"');
  });

  it("bounds streamed request bodies even when content length is absent", async () => {
    const accepted = await readBoundedBody(
      new Request("https://crm.example/webhook", { method: "POST", body: "1234" }),
      4,
    );
    const rejected = await readBoundedBody(
      new Request("https://crm.example/webhook", { method: "POST", body: "12345" }),
      4,
    );

    expect(accepted).toEqual({ success: true, text: "1234" });
    expect(rejected).toEqual({ success: false, reason: "too_large" });

    const contactRoute = readFileSync(
      resolve(ROOT, "src/app/api/contact/route.ts"),
      "utf8",
    );
    expect(contactRoute).toContain("return NextResponse.json({ success: true })");
    expect(contactRoute).not.toContain("return NextResponse.json({\n    success: true,\n    leadId");
  });
});
