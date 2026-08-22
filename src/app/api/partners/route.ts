import { auth } from "@/lib/auth";
import { listPartners } from "@/lib/partners/store";

/**
 * Partner directory for client components.
 *
 * Server components read `listPartners()` directly; the carrier workspace
 * pages are client components, so they need an endpoint. The response shape
 * matches the carrier API envelope so `fetchCarrierData` consumes it as-is.
 *
 * Auth is a plain signed-in check rather than the dispatcher allowlist — the
 * directory is app-wide (dashboard widget, broker pickers), and it contains
 * nothing beyond public brand names and logo paths.
 */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json(
      {
        data: null,
        error: {
          code: "AUTHENTICATION_REQUIRED",
          message: "Sign in to load the partner directory.",
        },
        meta: null,
      },
      { status: 401, headers: { "Cache-Control": "private, no-store" } },
    );
  }

  try {
    return Response.json(
      { data: await listPartners(), error: null, meta: null },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch {
    return Response.json(
      {
        data: null,
        error: {
          code: "INTERNAL_ERROR",
          message: "The partner directory is temporarily unavailable.",
        },
        meta: null,
      },
      { status: 500, headers: { "Cache-Control": "private, no-store" } },
    );
  }
}
