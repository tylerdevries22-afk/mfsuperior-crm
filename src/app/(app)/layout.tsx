import { redirect } from "next/navigation";
import { isNull, sql } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { ensureSchemaUpToDate } from "@/lib/db/ensure-schema";
import { notifications } from "@/lib/db/schema";
import { Sidebar } from "@/components/nav/sidebar";
import { CommandPalette } from "@/components/command-palette";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  // Self-healing schema sync — runs the bounded list of
  // IF-NOT-EXISTS ALTER TABLE statements that the deployed code
  // expects. Module-level memoized, so a warm Lambda only pays for
  // this on the first request; cold starts re-run idempotently.
  // Without this, schema-add PRs (like #46) require shell access
  // for `db:push` before any (app) page can render.
  await ensureSchemaUpToDate();

  const [{ unreadCount }] = await db
    .select({ unreadCount: sql<number>`count(*)::int` })
    .from(notifications)
    .where(isNull(notifications.readAt));

  return (
    // Always flex-row: on mobile the Sidebar renders a 56px icon
    // rail, on desktop a 240px full sidebar — either way the nav
    // sits flush-left and the main content fills the remainder.
    <div className="flex h-screen w-full">
      <Sidebar unreadNotifications={unreadCount} />
      <main className="flex-1 overflow-y-auto bg-background">{children}</main>
      <CommandPalette />
    </div>
  );
}
