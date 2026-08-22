import type { PropsWithChildren } from "react";
import { render } from "@testing-library/react-native";
import { Image } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { ThemeProvider } from "../../../theme";
import { PartnerLogo } from "../PartnerLogo";

function Wrapper({ children }: PropsWithChildren) {
  return (
    <SafeAreaProvider
      initialMetrics={{
        frame: { x: 0, y: 0, width: 390, height: 844 },
        insets: { top: 47, left: 0, right: 0, bottom: 34 },
      }}
    >
      <ThemeProvider>{children}</ThemeProvider>
    </SafeAreaProvider>
  );
}

describe("PartnerLogo", () => {
  it("renders the partner's logo image under its name", () => {
    const view = render(<PartnerLogo slug="ch-robinson" />, { wrapper: Wrapper });
    const node = view.getByLabelText("C.H. Robinson");
    expect(node).toBeTruthy();
    expect(view.UNSAFE_getAllByType(Image).length).toBe(1);
  });

  it("resolves an alias to the canonical partner", () => {
    const view = render(<PartnerLogo slug="target" />, { wrapper: Wrapper });
    expect(view.getByLabelText("Target Carrier")).toBeTruthy();
  });

  it("falls back to a monogram for an unknown slug, with no image", () => {
    const view = render(<PartnerLogo slug="not-a-partner" />, { wrapper: Wrapper });
    expect(view.getByText("NO")).toBeTruthy();
    expect(view.UNSAFE_queryAllByType(Image).length).toBe(0);
  });

  it("honours an explicit label over the partner name", () => {
    const view = render(<PartnerLogo label="Navisphere" slug="ch-robinson" />, {
      wrapper: Wrapper,
    });
    expect(view.getByLabelText("Navisphere")).toBeTruthy();
  });

  it("sizes the plate to the 15:4 lockup ratio", () => {
    const view = render(<PartnerLogo size={20} slug="rxo" />, { wrapper: Wrapper });
    const style = view.getByLabelText("RXO").props.style;
    const flat = (Array.isArray(style) ? style : [style]).reduce(
      (merged: Record<string, unknown>, entry: unknown) =>
        entry && typeof entry === "object" ? { ...merged, ...entry } : merged,
      {},
    );
    expect(flat.height).toBe(20);
    expect(flat.width).toBe(75);
  });
});
