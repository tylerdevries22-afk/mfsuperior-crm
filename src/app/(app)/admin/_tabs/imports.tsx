import Link from "next/link";
import { ArrowDownToLine, Plus, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { InfoTooltip } from "@/components/ui/info-tooltip";
import { generateLeadsAction, importDenverBatch1Action } from "../actions";
import type { AdminSearch } from "./types";

/**
 * Lead-import tools — bring new candidates into the CRM. Two paths:
 *
 *   • Denver Batch 1 — pre-curated 76-candidate Front Range pool,
 *     auto-enrolls into the default active sequence.
 *   • Generate leads — live discovery (OSM Overpass + curated
 *     fallback) + website scrape + MX validation. Inserts ONLY
 *     companies whose websites yield a deliverable email.
 */
export function ImportsTab({ sp }: { sp: AdminSearch }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2">
          Lead research
          <InfoTooltip label="What does Lead research do?">
            <p className="font-medium text-foreground">Lead research</p>
            <p className="mt-1 text-muted-foreground">
              Discovers Denver-Metro freight-friendly companies, scores
              them Tier A/B/C, finds the right contact email, and upserts
              directly into the <span className="font-mono">leads</span>{" "}
              table — new rows show up on{" "}
              <span className="font-mono">/leads</span> immediately.
            </p>
            <p className="mt-2 font-medium text-foreground">Free mode</p>
            <p className="mt-1 text-muted-foreground">
              OpenStreetMap discovery + cheerio scrape of /about /contact +
              node:dns MX-record check. No API keys, no credit card.
              Quality is solid for restaurants and small biz; broker/3PL
              coverage is thinner than paid mode.
            </p>
            <p className="mt-2 font-medium text-foreground">Paid mode</p>
            <p className="mt-1 text-muted-foreground">
              Google Places API + Hunter.io domain-search + email-verifier.
              Requires <span className="font-mono">GOOGLE_MAPS_API_KEY</span>{" "}
              and <span className="font-mono">HUNTER_API_KEY</span> env vars
              (Hunter free tier 25/25/mo, Starter $49/mo unlocks 500/1000).
              Best for B2B coverage and verified emails.
            </p>
            <p className="mt-2 text-muted-foreground">
              <strong>Vercel timeout caveat:</strong> the button runs
              synchronously inside a serverless function (Hobby = 10s,
              Pro = 60s). Cap is 20 leads from the UI — for larger batches
              run <span className="font-mono">npm run leads:research</span>{" "}
              from your machine.
            </p>
          </InfoTooltip>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Pick a mode, set a small batch size, and the script will run
          server-side and upsert into the live database. Refresh{" "}
          <span className="font-mono">/leads</span> after to see the new
          rows.
        </p>

        {/* Denver Batch 1 — pre-curated 76-candidate Front Range pool */}
        <form
          action={importDenverBatch1Action}
          className="flex flex-col gap-3 rounded-md border border-success/40 bg-success/5 p-4"
        >
          <div>
            <p className="font-medium text-foreground">
              Denver Batch 1 — import + auto-enroll 50 Front Range leads
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Pre-curated pool of ~76 Front Range businesses across
              restaurants, big-box / grocery, freight brokers + 3PLs, and
              construction supply. MX-validates each domain at click time,
              generates vertical-aware role-account emails (
              <span className="font-mono">orders@</span>,{" "}
              <span className="font-mono">procurement@</span>,{" "}
              <span className="font-mono">dispatch@</span>), and inserts
              up to 50 verified leads into <code>/leads</code> tagged{" "}
              <span className="font-mono">denver-batch-1</span>. Each lead
              is auto-enrolled into the default active sequence with a
              0-30min send jitter so all 50 don&apos;t fire in the same
              tick.
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              Idempotent: dupes by email are detected and skipped.
              Audit-logged. CSV download below.
            </p>

            {sp.batch1 === "1" && sp.b1_error ? (
              <p className="mt-3 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 font-mono text-[11px] text-destructive">
                {decodeURIComponent(sp.b1_error)}
              </p>
            ) : sp.batch1 === "1" ? (
              <div className="mt-3 space-y-1 rounded-md border border-success/40 bg-success/10 px-3 py-2 text-xs text-foreground">
                <p>
                  Validated{" "}
                  <span className="font-mono tabular-nums">
                    {Number(sp.b1_validated ?? 0)}
                  </span>{" "}
                  · inserted{" "}
                  <span className="font-mono tabular-nums">
                    {Number(sp.b1_inserted ?? 0)}
                  </span>{" "}
                  · dupes{" "}
                  <span className="font-mono tabular-nums">
                    {Number(sp.b1_dup ?? 0)}
                  </span>{" "}
                  · invalid{" "}
                  <span className="font-mono tabular-nums">
                    {Number(sp.b1_invalid ?? 0)}
                  </span>
                </p>
                <p>
                  Enrolled{" "}
                  <span className="font-mono tabular-nums">
                    {Number(sp.b1_enrolled ?? 0)}
                  </span>{" "}
                  · already enrolled{" "}
                  <span className="font-mono tabular-nums">
                    {Number(sp.b1_already ?? 0)}
                  </span>
                  {sp.b1_sequence
                    ? ` into "${decodeURIComponent(sp.b1_sequence)}"`
                    : ""}{" "}
                  · {Number(sp.b1_dur ?? 0)}ms
                </p>
              </div>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button type="submit" size="sm">
              <Zap /> Import + auto-enroll batch 1
            </Button>
            <a
              href="/api/export/denver-batch-1"
              className="inline-flex items-center gap-1 rounded-md border border-input bg-background px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-secondary/40"
              download
            >
              <ArrowDownToLine className="size-3" /> Download CSV
            </a>
            <Link
              href="/leads?tags=denver-batch-1"
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              View batch in /leads →
            </Link>
          </div>
        </form>

        {/* Unified lead generator — replaces the legacy free/paid/quick-add buttons */}
        <form
          action={generateLeadsAction}
          className="flex flex-col gap-4 rounded-md border border-primary/40 bg-primary/5 p-4"
        >
          <div>
            <p className="font-medium text-foreground">
              Generate leads — OSM discovery + website scrape + MX validation
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Single coherent pipeline. Discovers businesses via OSM
              Overpass (with curated-list fallback), scrapes each
              candidate site for real <span className="font-mono">mailto:</span>{" "}
              + visible emails, MX-validates the address, and inserts ONLY
              companies whose websites yield a deliverable address —{" "}
              <strong className="text-foreground">no guessing, ever.</strong>{" "}
              Companies without a public email are <em>skipped</em>, not
              inserted. Already-in-CRM domains are skipped automatically.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <label className="flex flex-col gap-1 text-xs">
              <span className="font-medium text-foreground">
                Industries (comma-separated)
              </span>
              <input
                name="industries"
                defaultValue="restaurants,bigbox,brokers,smallbiz,construction,cannabis"
                className="h-9 rounded-md border border-input bg-background px-2 font-mono text-xs text-foreground"
                placeholder="restaurants,bigbox,brokers,smallbiz,construction,cannabis"
              />
              <span className="text-[11px] text-muted-foreground">
                Allowed: restaurants, bigbox, brokers, smallbiz,
                construction, cannabis
              </span>
            </label>

            <label className="flex flex-col gap-1 text-xs">
              <span className="font-medium text-foreground">
                Counties (comma-separated)
              </span>
              <input
                name="counties"
                defaultValue="Arapahoe,Denver,Jefferson"
                className="h-9 rounded-md border border-input bg-background px-2 font-mono text-xs text-foreground"
                placeholder="Adams,Arapahoe,Boulder,Broomfield,Denver,Douglas,Jefferson"
              />
              <span className="text-[11px] text-muted-foreground">
                Allowed: Adams, Arapahoe, Boulder, Broomfield, Denver,
                Douglas, Jefferson
              </span>
            </label>

            <label className="flex flex-col gap-1 text-xs">
              <span className="font-medium text-foreground">
                Discovery source
              </span>
              <select
                name="source"
                defaultValue="osm+curated"
                className="h-9 rounded-md border border-input bg-background px-2 text-sm text-foreground"
              >
                <option value="osm+curated">
                  OSM with curated fallback (recommended)
                </option>
                <option value="osm">OSM only (skip if Overpass fails)</option>
                <option value="curated">Curated list only (fast)</option>
              </select>
              <span className="text-[11px] text-muted-foreground">
                OSM is unreliable from Vercel; fallback ensures progress.
              </span>
            </label>

            <label className="flex flex-col gap-1 text-xs">
              <span className="font-medium text-foreground">
                Limit (max candidates to verify)
              </span>
              <input
                type="number"
                name="limit"
                defaultValue={8}
                min={1}
                max={20}
                className="h-9 rounded-md border border-input bg-background px-2 text-sm text-foreground"
              />
              <span className="text-[11px] text-muted-foreground">
                1-20. Each verified candidate runs ~1.5s of scrape + MX.
              </span>
            </label>
          </div>

          <Button type="submit" size="sm" className="self-start">
            <Plus /> Generate leads
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
