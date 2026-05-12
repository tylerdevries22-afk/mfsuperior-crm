import Link from "next/link";
import { ArrowLeft, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createLeadAction } from "./actions";

export const metadata = { title: "New Lead" };

const US_STATES = [
  "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA",
  "KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ",
  "NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT",
  "VA","WA","WV","WI","WY",
];

/** Server-action redirect-on-error params:
 *   err — human-readable message rendered as an inline banner.
 *   f_<field> — preserved form values so the operator doesn't retype. */
type NewLeadSearch = {
  err?: string;
  f_company?: string;
  f_firstName?: string;
  f_lastName?: string;
  f_email?: string;
  f_phone?: string;
  f_vertical?: string;
  f_city?: string;
  f_state?: string;
  f_website?: string;
  f_tier?: string;
  f_notes?: string;
};

export default async function NewLeadPage({
  searchParams,
}: {
  searchParams: Promise<NewLeadSearch>;
}) {
  const sp = await searchParams;
  const err = sp.err;
  return (
    <div className="px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <Link
        href="/leads"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> All leads
      </Link>

      <header className="mt-4 mb-8">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          New lead
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Create a lead manually. Import from the leads list for bulk entry.
        </p>
      </header>

      {err && (
        <div
          role="alert"
          className="mb-4 flex max-w-2xl items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2.5 text-sm text-destructive"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          <span>{err}</span>
        </div>
      )}

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>Lead details</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={createLeadAction} className="space-y-5">
            {/* Company */}
            <div className="grid gap-1.5">
              <Label htmlFor="company">Company</Label>
              <Input
                id="company"
                name="company"
                placeholder="Acme Distributors"
                defaultValue={sp.f_company ?? ""}
                autoFocus
              />
            </div>

            {/* First + Last name */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <Label htmlFor="firstName">First name</Label>
                <Input
                  id="firstName"
                  name="firstName"
                  placeholder="Jane"
                  defaultValue={sp.f_firstName ?? ""}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="lastName">Last name</Label>
                <Input
                  id="lastName"
                  name="lastName"
                  placeholder="Smith"
                  defaultValue={sp.f_lastName ?? ""}
                />
              </div>
            </div>

            {/* Email */}
            <div className="grid gap-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="jane@acme.com"
                defaultValue={sp.f_email ?? ""}
              />
              <p className="text-xs text-muted-foreground">
                Leave blank if unknown — call first to get the right contact.
              </p>
            </div>

            {/* Phone */}
            <div className="grid gap-1.5">
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                name="phone"
                type="tel"
                placeholder="(303) 555-0100"
                defaultValue={sp.f_phone ?? ""}
              />
            </div>

            {/* Vertical */}
            <div className="grid gap-1.5">
              <Label htmlFor="vertical">Vertical / Industry</Label>
              <Input
                id="vertical"
                name="vertical"
                placeholder="Medical Supply, HVAC, Flooring…"
                defaultValue={sp.f_vertical ?? ""}
              />
            </div>

            {/* City + State */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <Label htmlFor="city">City</Label>
                <Input
                  id="city"
                  name="city"
                  placeholder="Denver"
                  defaultValue={sp.f_city ?? ""}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="state">State</Label>
                <select
                  id="state"
                  name="state"
                  className="h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground"
                  defaultValue={sp.f_state ?? ""}
                >
                  <option value="">— Select —</option>
                  {US_STATES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Website */}
            <div className="grid gap-1.5">
              <Label htmlFor="website">Website</Label>
              <Input
                id="website"
                name="website"
                type="url"
                placeholder="https://acme.com"
                defaultValue={sp.f_website ?? ""}
              />
            </div>

            {/* Tier */}
            <div className="grid gap-1.5">
              <Label htmlFor="tier">Tier</Label>
              <select
                id="tier"
                name="tier"
                className="h-9 w-40 rounded-md border border-input bg-background px-3 text-sm text-foreground"
                defaultValue={sp.f_tier ?? ""}
              >
                <option value="">— No tier —</option>
                <option value="A">A — High priority</option>
                <option value="B">B — Medium priority</option>
                <option value="C">C — Low priority</option>
              </select>
            </div>

            {/* Notes */}
            <div className="grid gap-1.5">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                name="notes"
                rows={4}
                placeholder="Phone outcome, decision-maker name, freight type…"
                defaultValue={sp.f_notes ?? ""}
              />
            </div>

            <div className="flex items-center gap-3 pt-2">
              <Button type="submit">Create lead</Button>
              <Link href="/leads">
                <Button type="button" variant="ghost">
                  Cancel
                </Button>
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
