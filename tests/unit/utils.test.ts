import { describe, it, expect } from "vitest";
import { cn } from "@/lib/utils";

describe("cn", () => {
  it("merges and dedupes Tailwind class names", () => {
    expect(cn("p-2", "p-4")).toBe("p-4");
  });
  it("ignores falsy values", () => {
    expect(cn("a", false && "b", undefined, null, "c")).toBe("a c");
  });
  it("handles arrays and objects (clsx semantics)", () => {
    expect(cn(["a", { b: true, c: false }, "d"])).toBe("a b d");
  });
});
