import { describe, it, expect } from "vitest";
import { diffSheetVsDb, type DbLead, type SheetRow } from "@/lib/drive/diff";

const sheet = (companyName: string, email: string | null = null): SheetRow => ({
  companyName,
  email,
  raw: { companyName, email },
});

const dbRow = (
  id: string,
  companyName: string,
  email: string | null = null,
  source = "drive_sync",
): DbLead => ({ id, companyName, email, source });

describe("diffSheetVsDb", () => {
  it("inserts every sheet row when the DB is empty", () => {
    const result = diffSheetVsDb({
      sheet: [sheet("Acme"), sheet("Brixton")],
      db: [],
    });
    expect(result.inserts).toHaveLength(2);
    expect(result.confirmed).toEqual([]);
    expect(result.orphans).toEqual([]);
  });

  it("matches by lower-cased email when both sides have an email", () => {
    const result = diffSheetVsDb({
      sheet: [sheet("Acme Inc.", "Sam@Acme.COM")],
      db: [dbRow("lead-1", "Old Acme Name", "sam@acme.com")],
    });
    expect(result.inserts).toEqual([]);
    expect(result.confirmed).toEqual([
      { leadId: "lead-1", row: expect.objectContaining({ companyName: "Acme Inc." }) },
    ]);
    expect(result.orphans).toEqual([]);
  });

  it("matches by company name when neither side has an email", () => {
    const result = diffSheetVsDb({
      sheet: [sheet("  Elite Brands of Colorado ")],
      db: [dbRow("lead-1", "Elite Brands of Colorado", null)],
    });
    expect(result.confirmed).toHaveLength(1);
    expect(result.inserts).toEqual([]);
  });

  it("does not match by company name when the DB row has an email but sheet doesn't", () => {
    // Email-bearing DB rows can't be matched by company alone; otherwise
    // a sheet row missing the email would silently overwrite an enriched lead.
    const result = diffSheetVsDb({
      sheet: [sheet("Acme")],
      db: [dbRow("lead-1", "Acme", "sam@acme.com")],
    });
    expect(result.confirmed).toEqual([]);
    expect(result.inserts).toHaveLength(1);
  });

  it("flags DB rows missing from the sheet as orphans", () => {
    const result = diffSheetVsDb({
      sheet: [sheet("Acme", "sam@acme.com")],
      db: [
        dbRow("lead-1", "Acme", "sam@acme.com"),
        dbRow("lead-2", "GoneCo", "ceo@goneco.com"),
      ],
    });
    expect(result.orphans.map((o) => o.id)).toEqual(["lead-2"]);
  });

  it("respects orphanSource — manually-created leads aren't flagged orphan", () => {
    const result = diffSheetVsDb({
      sheet: [],
      db: [
        dbRow("lead-1", "Synced Co", null, "drive_sync"),
        dbRow("lead-2", "Manual Co", null, "manual"),
      ],
      orphanSource: "drive_sync",
    });
    expect(result.orphans.map((o) => o.id)).toEqual(["lead-1"]);
  });

  it("trims and lower-cases when matching by company name", () => {
    const result = diffSheetVsDb({
      sheet: [sheet("  ELITE BRANDS  of COLORADO  ")],
      db: [dbRow("lead-1", "elite brands of colorado", null)],
    });
    expect(result.confirmed).toHaveLength(1);
    expect(result.inserts).toEqual([]);
  });

  it("counts a sheet row as new when no DB lead matches by either rule", () => {
    const result = diffSheetVsDb({
      sheet: [sheet("Brand New", "fresh@brand.com")],
      db: [dbRow("lead-1", "Other Co", "other@co.com")],
    });
    expect(result.inserts).toHaveLength(1);
    expect(result.confirmed).toEqual([]);
    expect(result.orphans.map((o) => o.id)).toEqual(["lead-1"]);
  });
});
