import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { settings } from "@/lib/db/schema";
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

export default async function SettingsPage() {
  const current = await loadSettings();
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
