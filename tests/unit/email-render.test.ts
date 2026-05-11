import { describe, it, expect } from "vitest";
import {
  buildVariableMap,
  renderTemplate,
  extractVariables,
  KNOWN_VARIABLES,
} from "@/lib/email/render";
import { snippetForVertical } from "@/lib/email/personalization";

const SETTINGS = {
  senderName: "Tyler DeVries",
  senderEmail: "tylerdevries22@gmail.com",
  businessName: "MF Superior Products",
  senderTitle: "Owner",
  senderPhone: "(303) 555-0119",
  businessMc: "MC-123456",
  businessUsdot: "USDOT 7654321",
};

describe("renderTemplate", () => {
  it("substitutes known variables and leaves unknown ones in place", () => {
    const vars = buildVariableMap(
      { firstName: "Sam", companyName: "Elite Brands", vertical: "Beverage Distributor" },
      SETTINGS,
    );
    const r = renderTemplate("Hi {{first_name}} at {{company_name}} — {{not_a_var}}", vars);
    expect(r.output).toBe("Hi Sam at Elite Brands — {{not_a_var}}");
    expect(r.used.sort()).toEqual(["company_name", "first_name"]);
    expect(r.unknown).toEqual(["not_a_var"]);
  });

  it("first_name falls back to 'there' when missing (greeting safety)", () => {
    const vars = buildVariableMap(
      { firstName: null, companyName: "Acme" },
      SETTINGS,
    );
    expect(renderTemplate("Hi {{first_name}},", vars).output).toBe("Hi there,");
  });

  it("personalization is auto-derived from the lead's vertical", () => {
    const vars = buildVariableMap(
      { firstName: "Sam", vertical: "Wholesale Bakery" },
      SETTINGS,
    );
    const r = renderTemplate("..the kind of shipper we're built for: {{personalization}}.", vars);
    expect(r.output).toContain("daily pre-open delivery cadence");
  });

  it("personalization falls back to a generic line for unmapped verticals", () => {
    expect(snippetForVertical("Spaceships")).toMatch(/Denver-metro density/);
    expect(snippetForVertical(null)).toMatch(/Denver-metro density/);
  });

  it("extractVariables returns dedupe order", () => {
    const v = extractVariables(
      "{{a}} and {{b}} and {{a}} again, then {{ c }}",
    );
    expect(v).toEqual(["a", "b", "c"]);
  });

  it("renders the kit's Day 0 subject line correctly with a tier-A lead", () => {
    const vars = buildVariableMap(
      { firstName: "Sam", companyName: "Elite Brands of Colorado" },
      SETTINGS,
    );
    const subject = renderTemplate(
      "Box-truck capacity for {{company_name}} — Denver-based, liftgate-equipped",
      vars,
    );
    expect(subject.output).toBe(
      "Box-truck capacity for Elite Brands of Colorado — Denver-based, liftgate-equipped",
    );
    expect(subject.unknown).toEqual([]);
  });
});

describe("KNOWN_VARIABLES exports", () => {
  it("includes the required minimum set the editor relies on", () => {
    for (const v of [
      "first_name",
      "company_name",
      "personalization",
      "sender_name",
      "sender_phone",
      "mc_number",
      "usdot_number",
    ]) {
      expect(KNOWN_VARIABLES).toContain(v);
    }
  });
});
