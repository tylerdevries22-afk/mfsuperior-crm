import ExcelJS from "exceljs";

export type ParsedLead = {
  rank: number | null;
  tier: "A" | "B" | "C" | null;
  score: number | null;
  companyName: string;
  vertical: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  phone: string | null;
  website: string | null;
  email: string | null;
  scoreBreakdown: {
    boxFit: number | null;
    liftgate: number | null;
    volume: number | null;
    window: number | null;
    dmAccess: number | null;
    geoFit: number | null;
  };
  whyThisLead: string | null;
};

export type ParseReport = {
  leads: ParsedLead[];
  skippedRows: Array<{ rowNumber: number; reason: string }>;
  warnings: string[];
};

/* ───── Column resolution ────────────────────────────────────── */

const HEADER_ALIASES: Record<keyof ParsedLead | "boxFit" | "liftgate" | "volume" | "window" | "dmAccess" | "geoFit", string[]> = {
  rank: ["rank", "#"],
  tier: ["tier"],
  score: ["score"],
  companyName: ["company", "company name", "name"],
  vertical: ["category", "vertical", "industry"],
  address: ["address", "location"],
  city: ["city"],
  state: ["state"],
  phone: ["phone", "phone number", "tel"],
  website: ["website", "url", "site"],
  email: ["email", "email address"],
  whyThisLead: ["why this lead", "notes", "rationale"],
  boxFit: ["boxfit", "box fit"],
  liftgate: ["liftgate", "lift gate"],
  volume: ["volume"],
  window: ["window", "operating window"],
  dmAccess: ["dm access", "dmaccess", "decision-maker access"],
  geoFit: ["geofit", "geo fit", "geography"],
  scoreBreakdown: [],
};

function normalizeHeader(value: unknown): string {
  if (value == null) return "";
  const s = typeof value === "object" && "text" in (value as object) ? (value as { text?: string }).text ?? "" : String(value);
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

function resolveColumns(headerRow: ExcelJS.Row): Map<string, number> {
  const map = new Map<string, number>();
  headerRow.eachCell((cell, col) => {
    const norm = normalizeHeader(cell.value);
    for (const [key, aliases] of Object.entries(HEADER_ALIASES)) {
      if (aliases.includes(norm)) {
        if (!map.has(key)) map.set(key, col);
      }
    }
  });
  return map;
}

/* ───── Cell value normalization ─────────────────────────────── */

function cellString(cell: ExcelJS.Cell): string | null {
  const v = cell.value;
  if (v == null) return null;
  if (typeof v === "string") return v.trim() || null;
  if (typeof v === "number") return String(v);
  if (typeof v === "boolean") return v ? "true" : "false";
  if (v instanceof Date) return v.toISOString();
  if (typeof v === "object") {
    if ("text" in v && typeof (v as { text?: string }).text === "string") {
      return ((v as { text?: string }).text ?? "").trim() || null;
    }
    if ("result" in v) {
      const r = (v as { result?: unknown }).result;
      return r == null ? null : String(r).trim() || null;
    }
    if ("richText" in v) {
      const rt = (v as { richText?: Array<{ text?: string }> }).richText ?? [];
      const joined = rt.map((p) => p.text ?? "").join("").trim();
      return joined || null;
    }
    if ("hyperlink" in v) {
      const h = (v as { hyperlink?: string; text?: string });
      return (h.text ?? h.hyperlink ?? "").trim() || null;
    }
  }
  return null;
}

function cellNumber(cell: ExcelJS.Cell): number | null {
  const v = cell.value;
  if (typeof v === "number" && Number.isFinite(v)) return v;
  const s = cellString(cell);
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function parseTier(s: string | null): "A" | "B" | "C" | null {
  if (!s) return null;
  const u = s.trim().toUpperCase();
  return u === "A" || u === "B" || u === "C" ? u : null;
}

const ADDRESS_REGEX = /^(.*?),\s*([A-Za-z .'-]+),\s*([A-Z]{2})\s*\d{0,5}/;

function parseAddress(raw: string | null): {
  full: string | null;
  city: string | null;
  state: string | null;
} {
  if (!raw) return { full: null, city: null, state: null };
  const trimmed = raw.trim();
  const m = trimmed.match(ADDRESS_REGEX);
  if (m) return { full: trimmed, city: m[2].trim(), state: m[3].trim() };
  // Fallback: "Aurora, CO (HQ Denver metro)" — extract city, state without street.
  const fallback = trimmed.match(/^([A-Za-z .'-]+),\s*([A-Z]{2})/);
  if (fallback)
    return { full: trimmed, city: fallback[1].trim(), state: fallback[2].trim() };
  return { full: trimmed, city: null, state: null };
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/* ───── Public parser ────────────────────────────────────────── */

export async function parseLeadWorkbook(buffer: ArrayBuffer): Promise<ParseReport> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);

  // Prefer a sheet whose name contains "lead"; else the first sheet with rows.
  const sheet =
    wb.worksheets.find((s) => /lead/i.test(s.name)) ??
    wb.worksheets.find((s) => s.rowCount > 1) ??
    wb.worksheets[0];

  if (!sheet) {
    return { leads: [], skippedRows: [], warnings: ["Workbook has no sheets."] };
  }

  const warnings: string[] = [];
  const headerRow = sheet.getRow(1);
  const cols = resolveColumns(headerRow);

  if (!cols.has("companyName")) {
    return {
      leads: [],
      skippedRows: [],
      warnings: [
        `Sheet "${sheet.name}" has no recognizable Company column. Headers must include one of: ${HEADER_ALIASES.companyName.join(", ")}.`,
      ],
    };
  }

  const get = (row: ExcelJS.Row, key: string) => {
    const c = cols.get(key);
    return c ? row.getCell(c) : null;
  };

  const leads: ParsedLead[] = [];
  const skippedRows: Array<{ rowNumber: number; reason: string }> = [];

  for (let r = 2; r <= sheet.rowCount; r++) {
    const row = sheet.getRow(r);
    if (!row || row.actualCellCount === 0) continue;

    const companyCell = get(row, "companyName");
    const company = companyCell ? cellString(companyCell) : null;
    if (!company) {
      skippedRows.push({ rowNumber: r, reason: "Missing company name" });
      continue;
    }

    const addressRaw = cellString(get(row, "address") ?? ({} as ExcelJS.Cell));
    const parsedAddr = parseAddress(addressRaw);

    const emailRaw = cellString(get(row, "email") ?? ({} as ExcelJS.Cell));
    const email = emailRaw && EMAIL_REGEX.test(emailRaw) ? emailRaw.toLowerCase() : null;
    if (emailRaw && !email) {
      warnings.push(`Row ${r}: ignored invalid email "${emailRaw}".`);
    }

    leads.push({
      rank: cellNumber(get(row, "rank") ?? ({} as ExcelJS.Cell)),
      tier: parseTier(cellString(get(row, "tier") ?? ({} as ExcelJS.Cell))),
      score: cellNumber(get(row, "score") ?? ({} as ExcelJS.Cell)),
      companyName: company,
      vertical: cellString(get(row, "vertical") ?? ({} as ExcelJS.Cell)),
      address: parsedAddr.full,
      city: parsedAddr.city,
      state: parsedAddr.state,
      phone: cellString(get(row, "phone") ?? ({} as ExcelJS.Cell)),
      website: cellString(get(row, "website") ?? ({} as ExcelJS.Cell)),
      email,
      scoreBreakdown: {
        boxFit: cellNumber(get(row, "boxFit") ?? ({} as ExcelJS.Cell)),
        liftgate: cellNumber(get(row, "liftgate") ?? ({} as ExcelJS.Cell)),
        volume: cellNumber(get(row, "volume") ?? ({} as ExcelJS.Cell)),
        window: cellNumber(get(row, "window") ?? ({} as ExcelJS.Cell)),
        dmAccess: cellNumber(get(row, "dmAccess") ?? ({} as ExcelJS.Cell)),
        geoFit: cellNumber(get(row, "geoFit") ?? ({} as ExcelJS.Cell)),
      },
      whyThisLead: cellString(get(row, "whyThisLead") ?? ({} as ExcelJS.Cell)),
    });
  }

  return { leads, skippedRows, warnings };
}

/* ───── Composition: ParsedLead → DB insert shape ────────────── */

export type LeadInsert = {
  email: string | null;
  phone: string | null;
  companyName: string;
  website: string | null;
  vertical: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  source: string;
  tier: "A" | "B" | "C" | null;
  score: number | null;
  tags: string[];
  notes: string | null;
};

export function toLeadInsert(p: ParsedLead, source: string): LeadInsert {
  const tags: string[] = [];
  if (p.tier) tags.push(`tier-${p.tier}`);
  if (p.vertical) tags.push(p.vertical);

  const notesParts: string[] = [];
  if (p.whyThisLead) notesParts.push(p.whyThisLead.trim());
  const sb = p.scoreBreakdown;
  const breakdown = [
    ["BoxFit", sb.boxFit],
    ["Liftgate", sb.liftgate],
    ["Volume", sb.volume],
    ["Window", sb.window],
    ["DM Access", sb.dmAccess],
    ["Geo Fit", sb.geoFit],
  ]
    .filter(([, v]) => v != null)
    .map(([k, v]) => `${k}: ${v}`)
    .join(" · ");
  if (breakdown) notesParts.push(`Score breakdown — ${breakdown}.`);

  return {
    email: p.email,
    phone: p.phone,
    companyName: p.companyName,
    website: p.website,
    vertical: p.vertical,
    address: p.address,
    city: p.city,
    state: p.state,
    source,
    tier: p.tier,
    score: p.score,
    tags,
    notes: notesParts.length ? notesParts.join("\n\n") : null,
  };
}
