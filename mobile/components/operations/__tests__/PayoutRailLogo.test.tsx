import type { PropsWithChildren } from "react";
import { render } from "@testing-library/react-native";
import { Image } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { ThemeProvider } from "../../../theme";
import { PayoutRailLogo, PayoutRailMosaic } from "../PayoutRailLogo";

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

describe("PayoutRailLogo", () => {
  it.each([
    ["apple_cash", "Apple Cash logo"],
    ["cash_app", "Cash App logo"],
    ["venmo", "Venmo logo"],
    ["zelle", "Zelle logo"],
  ] as const)("renders the %s branded mark", (rail, label) => {
    const view = render(<PayoutRailLogo rail={rail} />, { wrapper: Wrapper });
    expect(view.getByLabelText(label)).toBeTruthy();
    expect(view.UNSAFE_getAllByType(Image)).toHaveLength(1);
  });

  it("renders all four marks as an overlapping payout mosaic", () => {
    const view = render(<PayoutRailMosaic />, { wrapper: Wrapper });
    expect(view.getByLabelText("Payout methods: Venmo, Cash App, Zelle, and Apple Cash")).toBeTruthy();
    expect(view.UNSAFE_getAllByType(Image)).toHaveLength(4);
  });
});
