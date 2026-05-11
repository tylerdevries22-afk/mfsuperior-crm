import Link from "next/link";
import { desc, isNull, sql } from "drizzle-orm";
import { BellOff, CheckCheck } from "lucide-react";
import { db } from "@/lib/db/client";
import { notifications } from "@/lib/db/schema";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { markAllReadAction } from "./actions";

export const metadata = { title: "Notifications" };

const TYPE_LABELS: Record<string, string> = {
  lead_submitted: "New lead",
  email_sent: "Email sent",
  email_opened: "Email opened",
  email_replied: "Reply received",
  sequence_completed: "Sequence completed",
};

const TYPE_VARIANT: Record<
  string,
  "brand" | "success" | "warning" | "muted" | "neutral"
> = {
  lead_submitted: "brand",
  email_sent: "muted",
  email_opened: "success",
  email_replied: "warning",
  sequence_completed: "success",
};

export default async function NotificationsPage() {
  const [rows, [{ unreadCount }]] = await Promise.all([
    db
      .select()
      .from(notifications)
      .orderBy(
        // Unread first, then newest
        sql`${notifications.readAt} IS NOT NULL`,
        desc(notifications.createdAt),
      )
      .limit(100),
    db
      .select({ unreadCount: sql<number>`count(*)::int` })
      .from(notifications)
      .where(isNull(notifications.readAt)),
  ]);

  return (
    <div className="px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <header className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Notifications
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {unreadCount > 0 ? (
              <>
                <span className="font-mono tabular-nums text-foreground">
                  {unreadCount}
                </span>{" "}
                unread
              </>
            ) : (
              "All caught up."
            )}
          </p>
        </div>

        {unreadCount > 0 && (
          <form action={markAllReadAction}>
            <Button type="submit" variant="secondary" size="sm">
              <CheckCheck className="size-4" />
              Mark all read
            </Button>
          </form>
        )}
      </header>

      {rows.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 px-6 py-16 text-center">
            <BellOff className="size-8 text-muted-foreground" />
            <p className="font-medium text-foreground">No notifications yet.</p>
            <p className="text-sm text-muted-foreground">
              Notifications appear here when leads submit quote requests, emails
              are opened, replies come in, and sequences complete.
            </p>
          </CardContent>
        </Card>
      ) : (
        <ul className="space-y-2">
          {rows.map((n) => {
            const isUnread = !n.readAt;
            return (
              <li key={n.id}>
                <Card
                  className={
                    isUnread
                      ? "border-primary/30 bg-primary/5"
                      : "opacity-70"
                  }
                >
                  <CardContent className="flex items-start gap-4 px-5 py-4">
                    {/* Dot indicator */}
                    <div className="mt-1 shrink-0">
                      {isUnread ? (
                        <span className="size-2 rounded-full bg-primary block" />
                      ) : (
                        <span className="size-2 rounded-full bg-transparent block" />
                      )}
                    </div>

                    {/* Content */}
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge
                          variant={TYPE_VARIANT[n.type] ?? "muted"}
                          className="text-[10px]"
                        >
                          {TYPE_LABELS[n.type] ?? n.type}
                        </Badge>
                        <span className="font-mono text-xs tabular-nums text-muted-foreground">
                          {new Date(n.createdAt).toLocaleString()}
                        </span>
                      </div>
                      <p className="mt-1 text-sm font-medium text-foreground">
                        {n.title}
                      </p>
                      {n.body && (
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {n.body}
                        </p>
                      )}
                    </div>

                    {/* CRM link if lead attached */}
                    {n.leadId && (
                      <Link
                        href={`/leads/${n.leadId}`}
                        className="shrink-0 text-xs text-muted-foreground transition-colors hover:text-foreground"
                      >
                        View lead
                      </Link>
                    )}
                  </CardContent>
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
