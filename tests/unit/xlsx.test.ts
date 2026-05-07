import { describe, it, expect, beforeAll } from "vitest";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { parseLeadWorkbook, toLeadInsert, type ParseReport } from "@/lib/xlsx";

const FIXTURE = path.resolve(__dirname, "../../../01_Lead_List.xlsx");

let report: ParseReport;

beforeAll(async () => {
  const file = await readFile(FIXTURE);
  // Convert Buffer to ArrayBuffer slice (Buffer is a view over a larger pool)
  const buffer = file.buffer.slice(
    file.byteOffset,
    file.byteOffset + file.byteLength,
  ) as ArrayBuffer;
  report = await parseLeadWorkbook(buffer);
});

describe("parseLeadWorkbook against 01_Lead_List.xlsx", () => {
  it("parses 50 leads from the Top 50 Leads sheet", () => {
    expect(report.leads.length).toBe(50);
  });

  it("produces no skipped rows for the canonical sheet", () => {
    expect(report.skippedRows).toEqual([]);
  });

  it("does not warn about anything for the canonical sheet", () => {
    expect(report.warnings).toEqual([]);
  });

  it("rank #1 is Elite Brands of Colorado, tier A, score in the high 50s", () => {
    const r1 = report.leads.find((l) => l.rank === 1);
    expect(r1).toBeDefined();
    expect(r1!.companyName).toMatch(/Elite Brands of Colorado/i);
    expect(r1!.tier).toBe("A");
    expect(r1!.score).toBeGreaterThanOrEqual(50);
    expect(r1!.score).toBeLessThan(70);
  });

  it("extracts city + state from the address when a US street address is present", () => {
    const r1 = report.leads.find((l) => l.rank === 1);
    expect(r1!.city).toBe("Denver");
    expect(r1!.state).toBe("CO");
  });

  it("preserves 'Why This Lead' rationale text", () => {
    const r1 = report.leads.find((l) => l.rank === 1);
    expect(r1!.whyThisLead?.length ?? 0).toBeGreaterThan(20);
  });

  it("captures all six score components for tier-A leads", () => {
    const tierA = report.leads.filter((l) => l.tier === "A");
    expect(tierA.length).toBeGreaterThan(0);
    for (const lead of tierA) {
      const sb = lead.scoreBreakdown;
      // At minimum, BoxFit and Geo Fit should always be set for tier-A leads
      expect(sb.boxFit).not.toBeNull();
      expect(sb.geoFit).not.toBeNull();
    }
  });

  it("leaves email null because the source spreadsheet has no email column", () => {
    expect(report.leads.every((l) => l.email === null)).toBe(true);
  });

  it("vertical (Category) is populated for every lead", () => {
    expect(report.leads.every((l) => !!l.vertical)).toBe(true);
  });
});

describe("toLeadInsert", () => {
  it("derives tier-X and vertical tags + composes a notes blob with score breakdown", () => {
    const r1 = report.leads.find((l) => l.rank === 1)!;
    const insert = toLeadInsert(r1, "denver_kit_2026");
    expect(insert.companyName).toMatch(/Elite Brands of Colorado/i);
    expect(insert.tags).toContain("tier-A");
    expect(insert.tags.some((t) => /distributor|3pl/i.test(t))).toBe(true);
    expect(insert.source).toBe("denver_kit_2026");
    expect(insert.notes).toMatch(/Score breakdown/);
    expect(insert.email).toBeNull();
  });
});
