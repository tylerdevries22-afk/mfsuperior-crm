import Link from "next/link";
import { eq } from "drizzle-orm";
import { CheckCircle2, AlertTriangle } from "lucide-react";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { accounts, settings } from "@/lib/db/schema";
import { saveSettingsAction } from "./actions";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Settings" };

async function loadSettings() {
  const rows = await db.select().from(settings).where(eq(settings.id, 1));
  return rows[0] ?? null;
}

async function loadIntegrationStatus() {
  const session = await auth();
  if (!session?.user?.id) {
    return {
      connected: false,
      scopes: [] as string[],
      hasGmail: false,
      hasDrive: false,
      hasCalendar: false,
      hasRefresh: false,
    };
  }
  const [acct] = await db
    .select({
      scope: accounts.scope,
      refresh: accounts.refresh_token,
    })
    .from(accounts)
    .where(eq(accounts.userId, session.user.id))
    .limit(1);
  const scopes = acct?.scope ? acct.scope.split(/\s+/) : [];
  return {
    connected: !!acct,
    scopes,
    hasGmail: scopes.some((s) => s.includes("gmail.")),
    hasDrive: scopes.some((s) => s.includes("drive.")),
    hasCalendar: scopes.some((s) => s.includes("calendar.")),
    hasRefresh: !!acct?.refresh,
  };
}

export default async function SettingsPage() {
  const [current, status] = await Promise.all([
    loadSettings(),
    loadIntegrationStatus(),
  ]);
  return (
    <div className="px-8 py-8">
      <header className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Settings
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Business identity, sender profile, Drive folder, and sending limits.
        </p>
      </header>

      <Card className="mb-6 max-w-3xl">
        <CardHeader>
          <CardTitle>Google integrations</CardTitle>
          <CardDescription>
            Sign in with Google grants the same OAuth client Gmail, Drive,
            and Calendar permissions. Reconnect if any scope is missing.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <ul className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <IntegrationPill label="Gmail" ok={status.hasGmail} />
            <IntegrationPill label="Drive" ok={status.hasDrive} />
            <IntegrationPill label="Calendar" ok={status.hasCalendar} />
          </ul>

          {!status.connected && (
            <div className="flex items-start gap-2 rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-xs">
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" />
              <p className="text-foreground">
                You haven&rsquo;t connected Google for this user yet. Sign
                out and back in via the{" "}
                <span className="font-mono">Continue with Google</span>{" "}
                button to grant Gmail / Drive / Calendar access.
              </p>
            </div>
          )}
          {status.connected && !status.hasRefresh && (
            <div className="flex items-start gap-2 rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-xs">
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" />
              <p className="text-foreground">
                Google is connected but no refresh token is stored. Revoke
                this app at{" "}
                <a
                  href="https://myaccount.google.com/permissions"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-primary hover:underline"
                >
                  myaccount.google.com/permissions
                </a>{" "}
                and sign in again.
              </p>
            </div>
          )}
          {status.connected &&
            status.hasRefresh &&
            (!status.hasCalendar ||
              !status.hasDrive ||
              !status.hasGmail) && (
              <div className="flex items-start gap-2 rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-xs">
                <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" />
                <p className="text-foreground">
                  Some scopes are missing. Sign out and reconnect to grant
                  the new ones (Calendar was added recently).
                </p>
              </div>
            )}
          {status.connected &&
            status.hasRefresh &&
            status.hasCalendar &&
            status.hasDrive &&
            status.hasGmail && (
              <p className="text-xs text-muted-foreground">
                All three APIs are wired. Auto-sync of leads to Drive runs
                hourly via{" "}
                <Link
                  href="/admin"
                  className="font-mono text-primary hover:underline"
                >
                  /api/cron/sync-drive
                </Link>{" "}
                — push the canonical{" "}
                <span className="font-mono">MFS_Leads_Synced.xlsx</span> to
                the configured folder below.
              </p>
            )}
        </CardContent>
      </Card>

      <form
        action={saveSettingsAction}
        className="grid max-w-3xl grid-cols-1 gap-6"
      >
        <Card>
          <CardHeader>
            <CardTitle>Business identity</CardTitle>
            <CardDescription>
              Shown in the CAN-SPAM footer of every outbound email. Postal
              address is required by US law.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2 grid gap-1.5">
              <Label htmlFor="businessName">Business name</Label>
              <Input
                id="businessName"
                name="businessName"
                required
                defaultValue={current?.businessName ?? "MF Superior Solutions"}
              />
            </div>
            <div className="sm:col-span-2 grid gap-1.5">
              <Label htmlFor="businessAddress">Postal address</Label>
              <Textarea
                id="businessAddress"
                name="businessAddress"
                required
                rows={3}
                defaultValue={
                  current?.businessAddress ??
                  "15321 E Louisiana Ave\nAurora, CO 80017\nUnited States"
                }
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="businessMc">MC number</Label>
              <Input
                id="businessMc"
                name="businessMc"
                placeholder="MC-XXXXXXX"
                defaultValue={current?.businessMc ?? ""}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="businessUsdot">USDOT number</Label>
              <Input
                id="businessUsdot"
                name="businessUsdot"
                placeholder="USDOT XXXXXXX"
                defaultValue={current?.businessUsdot ?? ""}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Sender profile</CardTitle>
            <CardDescription>
              Drafts and sends originate from this Gmail address via the Gmail
              API.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label htmlFor="senderName">Sender name</Label>
              <Input
                id="senderName"
                name="senderName"
                required
                defaultValue={current?.senderName ?? "Tyler DeVries"}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="senderEmail">Sender email</Label>
              <Input
                id="senderEmail"
                name="senderEmail"
                type="email"
                required
                defaultValue={
                  current?.senderEmail ?? "info@mfsuperiorproducts.com"
                }
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="senderTitle">Sender title</Label>
              <Input
                id="senderTitle"
                name="senderTitle"
                placeholder="Owner"
                defaultValue={current?.senderTitle ?? "Owner"}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="senderPhone">Sender phone</Label>
              <Input
                id="senderPhone"
                name="senderPhone"
                placeholder="(256) 468-0751"
                defaultValue={current?.senderPhone ?? ""}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Sending limits</CardTitle>
            <CardDescription>
              Daily cap protects sender reputation. Recommend 20/day after a
              7-day warmup at 5/day.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label htmlFor="dailySendCap">Daily cap</Label>
              <Input
                id="dailySendCap"
                name="dailySendCap"
                type="number"
                min={1}
                max={500}
                required
                defaultValue={current?.dailySendCap ?? 20}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="driveFolderId">Drive folder ID</Label>
              <Input
                id="driveFolderId"
                name="driveFolderId"
                placeholder="1aBcD…"
                defaultValue={current?.driveFolderId ?? ""}
              />
              <p className="text-xs text-muted-foreground">
                Folder where the canonical lead sheet is read and written.
                Get the ID from a Drive folder URL:{" "}
                <span className="font-mono">drive.google.com/drive/folders/&lt;ID&gt;</span>
                . Share the folder with{" "}
                <span className="font-mono">info@mfsuperiorproducts.com</span>{" "}
                if the OAuth user is different.
              </p>
            </div>
          </CardContent>
        </Card>

        <div className="flex items-center justify-end gap-3">
          <p className="mr-auto text-xs text-muted-foreground">
            Changes save immediately to the singleton settings row.
          </p>
          <Button type="submit">Save settings</Button>
        </div>
      </form>
    </div>
  );
}

function IntegrationPill({ label, ok }: { label: string; ok: boolean }) {
  return (
    <li
      className={
        ok
          ? "flex items-center gap-2 rounded-md border border-success/30 bg-success/10 px-3 py-2 text-sm"
          : "flex items-center gap-2 rounded-md border border-border bg-secondary/30 px-3 py-2 text-sm"
      }
    >
      {ok ? (
        <CheckCircle2 className="size-4 text-success" />
      ) : (
        <AlertTriangle className="size-4 text-muted-foreground" />
      )}
      <span className="font-medium text-foreground">{label}</span>
      <span className="ml-auto font-mono text-xs text-muted-foreground">
        {ok ? "connected" : "not granted"}
      </span>
    </li>
  );
}

