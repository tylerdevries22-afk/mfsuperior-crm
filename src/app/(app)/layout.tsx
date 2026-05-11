import { redirect } from "next/navigation";
import { isNull, sql } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
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

  const [{ unreadCount }] = await db
    .select({ unreadCount: sql<number>`count(*)::int` })
    .from(notifications)
    .where(isNull(notifications.readAt));

  return (
    <div className="flex h-screen w-full flex-col md:flex-row">
      <Sidebar unreadNotifications={unreadCount} />
      <main className="flex-1 overflow-y-auto bg-background">{children}</main>
      {/* Cmd+K global palette — listens for ⌘K / Ctrl+K from any
          authed page. No visible chrome by default; mounts the modal
          on demand. */}
      <CommandPalette />
    </div>
  );
}
