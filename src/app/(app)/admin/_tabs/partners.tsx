import { Building2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PartnerLogo } from "@/components/partners";
import {
  PARTNER_CATEGORIES,
  PARTNER_CATEGORY_LABELS,
  sortPartners,
} from "@/data/partners";
import {
  ACCEPTED_LOGO_TYPES,
  MAX_LOGO_BYTES,
  listPartners,
} from "@/lib/partners/store";
import {
  togglePartnerStatusAction,
  uploadPartnerLogoAction,
} from "./partners-actions";
import type { AdminSearch } from "./types";

/**
 * Partner directory management.
 *
 * The grid is the whole book — active partners first, then targets — with the
 * status toggle inline on each tile so moving a prospect to active is one
 * click, not a form. The upload field writes a logo into `public/partners/`
 * and appends the partner to `src/data/partners.custom.json`; the store
 * explains why that layering exists and what happens on a read-only host.
 */
export async function PartnersTab({ sp }: { sp: AdminSearch }) {
  const partners = sortPartners(await listPartners());
  const activeCount = partners.filter((p) => p.status === "active").length;

  return (
    <div className="space-y-6">
      {sp.partnerResult && (
        <p
          role="status"
          className="rounded-md border border-border bg-secondary/40 px-3 py-2 text-sm text-foreground"
        >
          {sp.partnerResult}
        </p>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="size-4 text-primary" aria-hidden />
            Partners
            <span className="font-mono text-xs font-normal tabular-nums text-muted-foreground">
              {activeCount} active · {partners.length - activeCount} target
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {partners.map((partner) => {
              const next = partner.status === "active" ? "target" : "active";
              return (
                <li
                  key={partner.slug}
                  className="flex flex-col gap-3 rounded-md border border-border p-3"
                >
                  <PartnerLogo
                    slug={partner.slug}
                    size="xl"
                    partners={partners}
                    className="self-start"
                  />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">
                      {partner.name}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {PARTNER_CATEGORY_LABELS[partner.category] ??
                        partner.category}
                      <span className="font-mono"> · {partner.slug}</span>
                    </p>
                  </div>
                  {/* Toggle, not a select: there are exactly two states, and
                      the button label names the state it moves to. */}
                  <form action={togglePartnerStatusAction} className="mt-auto">
                    <input type="hidden" name="slug" value={partner.slug} />
                    <input type="hidden" name="status" value={next} />
                    <Button
                      type="submit"
                      size="sm"
                      variant={partner.status === "active" ? "secondary" : "outline"}
                      className="w-full justify-between"
                    >
                      <span
                        className={
                          partner.status === "active"
                            ? "text-success"
                            : "text-muted-foreground"
                        }
                      >
                        {partner.status === "active" ? "● Active" : "○ Target"}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        Move to {next}
                      </span>
                    </Button>
                  </form>
                </li>
              );
            })}
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="size-4 text-primary" aria-hidden />
            Add a partner logo
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form
            action={uploadPartnerLogoAction}
            encType="multipart/form-data"
            className="flex flex-wrap items-end gap-3"
          >
            <div className="grid min-w-[200px] flex-1 gap-1">
              <Label htmlFor="partner-name" className="text-xs">
                Partner name
              </Label>
              <Input
                id="partner-name"
                name="name"
                placeholder="Werner Enterprises"
                maxLength={80}
                required
              />
            </div>
            <div className="grid gap-1">
              <Label htmlFor="partner-category" className="text-xs">
                Category
              </Label>
              <select
                id="partner-category"
                name="category"
                defaultValue="broker"
                className="h-9 rounded-md border border-input bg-background px-3 text-sm"
              >
                {PARTNER_CATEGORIES.map((category) => (
                  <option key={category} value={category}>
                    {PARTNER_CATEGORY_LABELS[category]}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid gap-1">
              <Label htmlFor="partner-status" className="text-xs">
                Status
              </Label>
              <select
                id="partner-status"
                name="status"
                defaultValue="target"
                className="h-9 rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="target">Target</option>
                <option value="active">Active</option>
              </select>
            </div>
            <div className="grid min-w-[220px] gap-1">
              <Label htmlFor="partner-logo" className="text-xs">
                Logo file
              </Label>
              <input
                id="partner-logo"
                name="logo"
                type="file"
                accept={ACCEPTED_LOGO_TYPES.join(",")}
                required
                className="h-9 rounded-md border border-input bg-background px-3 py-1.5 text-sm file:mr-3 file:rounded-sm file:border-0 file:bg-secondary file:px-2 file:py-0.5 file:text-xs file:text-secondary-foreground"
              />
            </div>
            <Button type="submit" size="sm" variant="secondary">
              <Upload className="size-4" /> Save logo
            </Button>
          </form>
          <p className="mt-3 text-xs text-muted-foreground">
            SVG, PNG, JPEG, or WebP up to{" "}
            {Math.floor(MAX_LOGO_BYTES / 1024)} KB. Saved to{" "}
            <span className="font-mono">public/partners/</span> and appended to{" "}
            <span className="font-mono">src/data/partners.custom.json</span>.
            Uploading for a slug that already exists replaces that logo.
            Serverless hosts mount the deployment read-only, so on Vercel this
            reports the failure instead of saving — commit the logo to the repo
            there.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
