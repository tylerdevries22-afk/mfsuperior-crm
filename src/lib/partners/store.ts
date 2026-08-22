/**
 * Runtime layer over the committed partner seed.
 *
 * `src/data/partners.ts` is the baseline every deploy ships with. Operator
 * edits made in Admin → Partners — flipping a partner between active/target,
 * or uploading a logo for a partner that isn't in the seed yet — are written
 * to `src/data/partners.custom.json` and merged on read. Keeping the two
 * apart means a seed change in a future PR never clobbers operator state, and
 * operator state stays reviewable in a diff.
 *
 * Persistence is the filesystem because that's what the request asked for:
 * a new logo lands in `public/partners/` next to the seeded ones. That works
 * under `next dev` and on any server with a writable checkout. Serverless
 * hosts (Vercel) mount the deployment read-only, so writes there fail with
 * EROFS/EACCES — `PartnerWriteError` carries that back to the UI as a plain
 * explanation instead of a 500. Reads always work.
 */

import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  PARTNERS,
  partnerSlugify,
  type Partner,
  type PartnerCategory,
  type PartnerStatus,
} from "@/data/partners";

const DATA_FILE = path.join(process.cwd(), "src", "data", "partners.custom.json");
const LOGO_DIR = path.join(process.cwd(), "public", "partners");

/** Upload guard rails. Logos are small; anything larger is a mistake. */
export const MAX_LOGO_BYTES = 512 * 1024;

const EXTENSION_BY_TYPE: Record<string, string> = {
  "image/svg+xml": "svg",
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};

export const ACCEPTED_LOGO_TYPES = Object.keys(EXTENSION_BY_TYPE);

/**
 * SVG is markup, and `public/` is served from the app's own origin — a file
 * with a `<script>` in it would run there if someone opened the asset URL
 * directly. Rendering through `<img>` neutralises that, but the upload path
 * shouldn't rely on every future consumer doing so.
 */
const SVG_REJECT = /<script|<foreignObject|javascript:|\son\w+\s*=|<!ENTITY/i;

type CustomPartner = Omit<Partner, "status"> & { status: PartnerStatus };

interface PartnerOverrides {
  statusOverrides: Record<string, PartnerStatus>;
  custom: CustomPartner[];
}

const EMPTY_OVERRIDES: PartnerOverrides = { statusOverrides: {}, custom: [] };

/** Thrown for conditions the operator can act on; the UI shows `message`. */
export class PartnerWriteError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PartnerWriteError";
  }
}

function isStatus(value: unknown): value is PartnerStatus {
  return value === "active" || value === "target";
}

/** Tolerant parse — a hand-edited or truncated file degrades to the seed. */
function parseOverrides(raw: string): PartnerOverrides {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return EMPTY_OVERRIDES;
  }
  if (typeof parsed !== "object" || parsed === null) return EMPTY_OVERRIDES;

  const source = parsed as Record<string, unknown>;
  const statusOverrides: Record<string, PartnerStatus> = {};
  if (typeof source.statusOverrides === "object" && source.statusOverrides) {
    for (const [slug, status] of Object.entries(source.statusOverrides)) {
      if (isStatus(status)) statusOverrides[slug] = status;
    }
  }

  const custom: CustomPartner[] = [];
  if (Array.isArray(source.custom)) {
    for (const entry of source.custom) {
      if (typeof entry !== "object" || entry === null) continue;
      const candidate = entry as Record<string, unknown>;
      if (
        typeof candidate.slug === "string" &&
        typeof candidate.name === "string" &&
        typeof candidate.logo === "string" &&
        typeof candidate.category === "string" &&
        isStatus(candidate.status)
      ) {
        custom.push({
          slug: candidate.slug,
          name: candidate.name,
          logo: candidate.logo,
          status: candidate.status,
          category: candidate.category as PartnerCategory,
          accent:
            typeof candidate.accent === "string" ? candidate.accent : undefined,
        });
      }
    }
  }

  return { statusOverrides, custom };
}

async function readOverrides(): Promise<PartnerOverrides> {
  try {
    return parseOverrides(await readFile(DATA_FILE, "utf8"));
  } catch {
    // Missing file is the normal first-run state.
    return EMPTY_OVERRIDES;
  }
}

async function writeOverrides(overrides: PartnerOverrides): Promise<void> {
  await writeFile(
    DATA_FILE,
    `${JSON.stringify(overrides, null, 2)}\n`,
    "utf8",
  );
}

function describeWriteFailure(error: unknown): PartnerWriteError {
  const code =
    typeof error === "object" && error !== null && "code" in error
      ? String((error as { code?: unknown }).code)
      : "";
  if (code === "EROFS" || code === "EACCES" || code === "EPERM") {
    return new PartnerWriteError(
      "The deployment filesystem is read-only, so the change could not be saved. " +
        "Run this from a writable checkout, or commit the partner to src/data/partners.ts.",
    );
  }
  return new PartnerWriteError("The partner directory could not be updated.");
}

/* ── Reads ────────────────────────────────────────────────────── */

/**
 * The seed with operator status flips applied, plus any uploaded partners.
 * This is what every surface should render.
 */
export async function listPartners(): Promise<Partner[]> {
  const { statusOverrides, custom } = await readOverrides();
  const seeded = PARTNERS.map((partner) =>
    statusOverrides[partner.slug] && statusOverrides[partner.slug] !== partner.status
      ? { ...partner, status: statusOverrides[partner.slug] }
      : partner,
  );

  // A custom entry sharing a seed slug is an edit of that seed row, not a
  // second partner — the uploaded logo wins.
  const seededSlugs = new Set(seeded.map((partner) => partner.slug));
  const merged = seeded.map((partner) => {
    const override = custom.find((entry) => entry.slug === partner.slug);
    return override ? { ...partner, ...override } : partner;
  });

  for (const entry of custom) {
    if (seededSlugs.has(entry.slug)) continue;
    merged.push({
      ...entry,
      status: statusOverrides[entry.slug] ?? entry.status,
    });
  }

  return merged;
}

/* ── Writes ───────────────────────────────────────────────────── */

/** Flip one partner between `active` and `target`. */
export async function setPartnerStatus(
  slug: string,
  status: PartnerStatus,
): Promise<void> {
  const partners = await listPartners();
  if (!partners.some((partner) => partner.slug === slug)) {
    throw new PartnerWriteError("That partner is not in the directory.");
  }

  const overrides = await readOverrides();
  const seed = PARTNERS.find((partner) => partner.slug === slug);
  if (seed && seed.status === status) {
    // Back to the committed value — drop the override rather than store a
    // redundant one, so the file only ever holds real divergence.
    delete overrides.statusOverrides[slug];
  } else {
    overrides.statusOverrides[slug] = status;
  }

  try {
    await writeOverrides(overrides);
  } catch (error) {
    throw describeWriteFailure(error);
  }
}

export interface AddPartnerInput {
  name: string;
  category: PartnerCategory;
  status: PartnerStatus;
  file: File;
}

/**
 * Save an uploaded logo to `public/partners/` and append the partner to the
 * overrides file. Re-uploading for an existing slug replaces its logo.
 */
export async function addPartner({
  name,
  category,
  status,
  file,
}: AddPartnerInput): Promise<Partner> {
  const trimmed = name.trim();
  if (!trimmed) throw new PartnerWriteError("Enter a partner name.");

  const slug = partnerSlugify(trimmed);
  if (!slug) {
    throw new PartnerWriteError(
      "That name has no letters or digits to build a slug from.",
    );
  }

  if (file.size === 0) throw new PartnerWriteError("Choose a logo file.");
  if (file.size > MAX_LOGO_BYTES) {
    throw new PartnerWriteError(
      `Logo files must be ${Math.floor(MAX_LOGO_BYTES / 1024)} KB or smaller.`,
    );
  }

  const extension = EXTENSION_BY_TYPE[file.type];
  if (!extension) {
    throw new PartnerWriteError(
      "Upload an SVG, PNG, JPEG, or WebP logo.",
    );
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  if (extension === "svg" && SVG_REJECT.test(bytes.toString("utf8"))) {
    throw new PartnerWriteError(
      "That SVG contains scripting or embedded content and was not saved.",
    );
  }

  const logo = `/partners/${slug}.${extension}`;
  const overrides = await readOverrides();
  const entry: CustomPartner = { slug, name: trimmed, logo, status, category };
  const existing = overrides.custom.findIndex((item) => item.slug === slug);
  if (existing >= 0) {
    overrides.custom[existing] = { ...overrides.custom[existing], ...entry };
  } else {
    overrides.custom.push(entry);
  }
  // A seeded partner keeps its committed status unless the operator has
  // already overridden it; only new partners take the submitted status.
  if (!PARTNERS.some((partner) => partner.slug === slug)) {
    delete overrides.statusOverrides[slug];
  }

  try {
    await writeFile(path.join(LOGO_DIR, `${slug}.${extension}`), bytes);
    await writeOverrides(overrides);
  } catch (error) {
    throw describeWriteFailure(error);
  }

  return entry;
}
