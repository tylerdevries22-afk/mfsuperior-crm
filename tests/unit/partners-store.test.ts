import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { PARTNERS } from "@/data/partners";
import {
  MAX_LOGO_BYTES,
  PartnerWriteError,
  addPartner,
  listPartners,
  setPartnerStatus,
} from "@/lib/partners/store";

/**
 * The store reads and writes real files under the repo, so these tests drive
 * the actual overrides file and restore its committed contents afterwards.
 * That is the point — the merge semantics only matter against a real file.
 */
const DATA_FILE = path.join(process.cwd(), "src", "data", "partners.custom.json");

let committed: string;

beforeAll(async () => {
  committed = await readFile(DATA_FILE, "utf8");
});

afterEach(async () => {
  await writeFile(DATA_FILE, committed, "utf8");
});

async function seedOverrides(value: unknown) {
  await writeFile(DATA_FILE, JSON.stringify(value, null, 2), "utf8");
}

describe("listPartners", () => {
  it("returns the committed seed when no overrides exist", async () => {
    const partners = await listPartners();
    expect(partners).toHaveLength(PARTNERS.length);
    expect(partners.find((p) => p.slug === "rxo")?.status).toBe("target");
  });

  it("applies a status override to a seeded partner", async () => {
    await seedOverrides({ statusOverrides: { rxo: "active" }, custom: [] });
    const partners = await listPartners();
    expect(partners.find((p) => p.slug === "rxo")?.status).toBe("active");
    // Untouched partners keep their committed status.
    expect(partners.find((p) => p.slug === "xpo")?.status).toBe("target");
  });

  it("appends an uploaded partner that is not in the seed", async () => {
    await seedOverrides({
      statusOverrides: {},
      custom: [
        {
          slug: "werner",
          name: "Werner",
          logo: "/partners/werner.png",
          status: "target",
          category: "broker",
        },
      ],
    });
    const partners = await listPartners();
    expect(partners).toHaveLength(PARTNERS.length + 1);
    expect(partners.find((p) => p.slug === "werner")?.logo).toBe(
      "/partners/werner.png",
    );
  });

  it("treats a custom entry on a seeded slug as an edit, not a duplicate", async () => {
    await seedOverrides({
      statusOverrides: {},
      custom: [
        {
          slug: "rxo",
          name: "RXO",
          logo: "/partners/rxo-official.svg",
          status: "target",
          category: "broker",
        },
      ],
    });
    const partners = await listPartners();
    expect(partners.filter((p) => p.slug === "rxo")).toHaveLength(1);
    expect(partners.find((p) => p.slug === "rxo")?.logo).toBe(
      "/partners/rxo-official.svg",
    );
  });

  it("falls back to the seed when the overrides file is corrupt", async () => {
    await writeFile(DATA_FILE, "{ not json", "utf8");
    const partners = await listPartners();
    expect(partners).toHaveLength(PARTNERS.length);
  });

  it("drops override entries with an unusable shape", async () => {
    await seedOverrides({
      statusOverrides: { rxo: "archived", xpo: "active" },
      custom: [{ slug: "broken" }, null, 42],
    });
    const partners = await listPartners();
    expect(partners).toHaveLength(PARTNERS.length);
    expect(partners.find((p) => p.slug === "rxo")?.status).toBe("target");
    expect(partners.find((p) => p.slug === "xpo")?.status).toBe("active");
  });
});

describe("setPartnerStatus", () => {
  it("persists a divergence from the seed", async () => {
    await setPartnerStatus("xpo", "active");
    const written = JSON.parse(await readFile(DATA_FILE, "utf8"));
    expect(written.statusOverrides.xpo).toBe("active");
  });

  it("clears the override when set back to the committed value", async () => {
    await seedOverrides({ statusOverrides: { xpo: "active" }, custom: [] });
    await setPartnerStatus("xpo", "target");
    const written = JSON.parse(await readFile(DATA_FILE, "utf8"));
    expect(written.statusOverrides).not.toHaveProperty("xpo");
  });

  it("rejects a slug that is not in the directory", async () => {
    await expect(setPartnerStatus("nope", "active")).rejects.toBeInstanceOf(
      PartnerWriteError,
    );
  });
});

describe("addPartner validation", () => {
  const svg = () =>
    new File(['<svg xmlns="http://www.w3.org/2000/svg"></svg>'], "l.svg", {
      type: "image/svg+xml",
    });

  it("requires a name", async () => {
    await expect(
      addPartner({ name: "   ", category: "broker", status: "target", file: svg() }),
    ).rejects.toThrow(/Enter a partner name/);
  });

  it("requires a name that yields a slug", async () => {
    await expect(
      addPartner({ name: "!!!", category: "broker", status: "target", file: svg() }),
    ).rejects.toThrow(/slug/);
  });

  it("rejects an empty file", async () => {
    await expect(
      addPartner({
        name: "Werner",
        category: "broker",
        status: "target",
        file: new File([], "l.svg", { type: "image/svg+xml" }),
      }),
    ).rejects.toThrow(/Choose a logo file/);
  });

  it("rejects a file over the size cap", async () => {
    await expect(
      addPartner({
        name: "Werner",
        category: "broker",
        status: "target",
        file: new File([new Uint8Array(MAX_LOGO_BYTES + 1)], "l.png", {
          type: "image/png",
        }),
      }),
    ).rejects.toThrow(/KB or smaller/);
  });

  it("rejects a type that is not an image we serve", async () => {
    await expect(
      addPartner({
        name: "Werner",
        category: "broker",
        status: "target",
        file: new File(["x"], "l.pdf", { type: "application/pdf" }),
      }),
    ).rejects.toThrow(/SVG, PNG, JPEG, or WebP/);
  });

  it("rejects an SVG carrying script", async () => {
    await expect(
      addPartner({
        name: "Werner",
        category: "broker",
        status: "target",
        file: new File(
          ['<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'],
          "l.svg",
          { type: "image/svg+xml" },
        ),
      }),
    ).rejects.toThrow(/scripting/);
  });

  it("rejects an SVG carrying an inline event handler", async () => {
    await expect(
      addPartner({
        name: "Werner",
        category: "broker",
        status: "target",
        file: new File(
          ['<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"></svg>'],
          "l.svg",
          { type: "image/svg+xml" },
        ),
      }),
    ).rejects.toThrow(/scripting/);
  });
});
