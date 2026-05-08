import Link from "next/link";
import { ArrowLeft } from "lucide-react";
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

export default function NewLeadPage() {
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
                autoFocus
              />
            </div>

            {/* First + Last name */}
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-1.5">
                <Label htmlFor="firstName">First name</Label>
                <Input id="firstName" name="firstName" placeholder="Jane" />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="lastName">Last name</Label>
                <Input id="lastName" name="lastName" placeholder="Smith" />
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
              />
            </div>

            {/* Vertical */}
            <div className="grid gap-1.5">
              <Label htmlFor="vertical">Vertical / Industry</Label>
              <Input
                id="vertical"
                name="vertical"
                placeholder="Medical Supply, HVAC, Flooring…"
              />
            </div>

            {/* City + State */}
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-1.5">
                <Label htmlFor="city">City</Label>
                <Input id="city" name="city" placeholder="Denver" />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="state">State</Label>
                <select
                  id="state"
                  name="state"
                  className="h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground"
                  defaultValue=""
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
              />
            </div>

            {/* Tier */}
            <div className="grid gap-1.5">
              <Label htmlFor="tier">Tier</Label>
              <select
                id="tier"
                name="tier"
                className="h-9 w-40 rounded-md border border-input bg-background px-3 text-sm text-foreground"
                defaultValue=""
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
