import Link from "next/link";
import { ArrowLeft, FileSpreadsheet, AlertTriangle, CheckCircle2 } from "lucide-react";
import { importLeadsAction } from "./actions";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Import leads" };

type Search = {
  parsed?: string;
  inserted?: string;
  duplicates?: string;
  skipped?: string;
  dryRun?: string;
  warnings?: string;
};

export default async function ImportLeadsPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const sp = await searchParams;
  const hasReport = !!sp.parsed;
  const parsed = Number(sp.parsed ?? 0);
  const inserted = Number(sp.inserted ?? 0);
  const duplicates = Number(sp.duplicates ?? 0);
  const skipped = Number(sp.skipped ?? 0);
  const dryRun = sp.dryRun === "1";
  const warnings = sp.warnings ? decodeURIComponent(sp.warnings).split("|") : [];

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
          Import leads
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Upload an .xlsx with a header row containing Company, Tier, Score,
          and the other lead fields. Existing rows are matched by email; if
          email is empty they&apos;re matched by company name.
        </p>
      </header>

      {hasReport && (
        <Card className="mb-6 border-l-4 border-l-primary">
          <CardContent className="flex flex-wrap items-start gap-x-8 gap-y-3 px-5 py-4 text-sm">
            <div className="flex items-center gap-2">
              {inserted > 0 || (dryRun && parsed > 0) ? (
                <CheckCircle2 className="size-5 text-success" />
              ) : (
                <AlertTriangle className="size-5 text-warning" />
              )}
              <span className="font-medium text-foreground">
                {dryRun ? "Dry run preview" : "Import complete"}
              </span>
            </div>
            <ReportStat label="Parsed" value={parsed} />
            {!dryRun && <ReportStat label="Inserted" value={inserted} accent />}
            <ReportStat label="Duplicates" value={duplicates} muted />
            <ReportStat label="Skipped rows" value={skipped} muted />
            {warnings.length > 0 && (
              <div className="basis-full text-xs text-muted-foreground">
                <p className="mb-1 font-medium text-foreground">Warnings</p>
                <ul className="list-inside list-disc space-y-0.5">
                  {warnings.map((w) => (
                    <li key={w}>{w}</li>
                  ))}
                </ul>
              </div>
            )}
            {!dryRun && inserted > 0 && (
              <Link
                href="/leads"
                className="ml-auto text-sm font-medium text-primary transition-colors hover:underline"
              >
                View {inserted} new leads →
              </Link>
            )}
          </CardContent>
        </Card>
      )}

      <form
        action={importLeadsAction}
        className="grid max-w-2xl grid-cols-1 gap-6"
      >
        <Card>
          <CardHeader>
            <CardTitle>Upload</CardTitle>
            <CardDescription>
              Maximum file size 8 MB. Currently supported: .xlsx (Excel).
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-2">
              <Label htmlFor="file">Spreadsheet</Label>
              <Input
                id="file"
                name="file"
                type="file"
                accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                required
                className="cursor-pointer file:mr-3 file:rounded file:border-0 file:bg-secondary file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-secondary-foreground hover:file:bg-slate-200"
              />
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <FileSpreadsheet className="size-3.5" />
                Try the kit&apos;s <span className="font-mono text-foreground">01_Lead_List.xlsx</span>.
              </p>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="source">Source label</Label>
              <Input
                id="source"
                name="source"
                placeholder="denver_kit_2026"
                defaultValue="denver_kit_2026"
              />
              <p className="text-xs text-muted-foreground">
                Stored on each new lead so you can filter by import batch later.
              </p>
            </div>

            <label className="flex cursor-pointer items-start gap-3 rounded-md border border-border bg-secondary/30 px-3 py-3 text-sm transition-colors hover:bg-secondary/60">
              <input
                type="checkbox"
                name="dryRun"
                value="true"
                className="mt-0.5 size-4 cursor-pointer rounded border-border accent-[--primary]"
              />
              <span>
                <span className="block font-medium text-foreground">
                  Dry run
                </span>
                <span className="text-xs text-muted-foreground">
                  Parse and report counts without writing to the database. Run
                  this first if you&apos;re not sure the headers match.
                </span>
              </span>
            </label>
          </CardContent>
        </Card>

        <div className="flex items-center justify-end gap-3">
          <Button type="submit">Import leads</Button>
        </div>
      </form>
    </div>
  );
}

function ReportStat({
  label,
  value,
  accent = false,
  muted = false,
}: {
  label: string;
  value: number;
  accent?: boolean;
  muted?: boolean;
}) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p
        className={
          accent
            ? "font-mono text-2xl font-semibold tabular-nums text-primary"
            : muted
              ? "font-mono text-2xl font-semibold tabular-nums text-muted-foreground"
              : "font-mono text-2xl font-semibold tabular-nums text-foreground"
        }
      >
        {value}
      </p>
    </div>
  );
}
