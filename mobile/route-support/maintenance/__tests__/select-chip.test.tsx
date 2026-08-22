import type { PropsWithChildren } from "react";
import { fireEvent, render } from "@testing-library/react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { ThemeProvider } from "@/theme";

import { SelectChip } from "../_components/SelectChip";

jest.mock("@expo/vector-icons/Feather", () => {
  const mockReact = jest.requireActual<typeof import("react")>("react");
  const mockReactNative = jest.requireActual<typeof import("react-native")>("react-native");
  return ({ name }: { name: string }) => mockReact.createElement(mockReactNative.Text, null, name);
});

const METRICS = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

function Wrapper({ children }: PropsWithChildren) {
  return (
    <SafeAreaProvider initialMetrics={METRICS}>
      <ThemeProvider mode="light">{children}</ThemeProvider>
    </SafeAreaProvider>
  );
}

describe("SelectChip", () => {
  /**
   * Worth stating plainly: this test would NOT have caught the bug that
   * prompted it. The chip was previously built on `ListRow`, whose title lives
   * in a `flex: 1` container; inside a wrapping chip row it had no width to
   * claim, so every pill rendered as a bare chevron. But the `Text` node was
   * still in the tree — only layout squeezed it out, and this renderer does not
   * compute layout, so `getByText` found it either way (verified, not assumed).
   *
   * The real guard is structural: `SelectChip` sizes to its own content and
   * cannot collapse from what a parent row does. These assertions cover the
   * weaker property that the label reaches the tree at all, plus the press and
   * accessibility contract. A collapsed-label regression of this kind is only
   * catchable on a device or in a screenshot.
   */
  it("renders its label as visible text, selected or not", () => {
    const unselected = render(
      <SelectChip label="Preventive" onPress={() => undefined} selected={false} />,
      { wrapper: Wrapper },
    );
    expect(unselected.getByText("Preventive")).toBeTruthy();

    const selected = render(
      <SelectChip label="Critical" onPress={() => undefined} selected />,
      { wrapper: Wrapper },
    );
    expect(selected.getByText("Critical")).toBeTruthy();
  });

  it("reports its selection to assistive technology", () => {
    const { getByLabelText } = render(
      <SelectChip label="Unit T-101" onPress={() => undefined} selected />,
      { wrapper: Wrapper },
    );
    const chip = getByLabelText("Unit T-101");
    expect(chip.props.accessibilityState).toMatchObject({ selected: true });
    expect(chip.props.accessibilityRole).toBe("radio");
  });

  it("calls back when pressed", () => {
    const onPress = jest.fn();
    const { getByLabelText } = render(
      <SelectChip label="Repair" onPress={onPress} selected={false} />,
      { wrapper: Wrapper },
    );
    fireEvent.press(getByLabelText("Repair"));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it("does not fire while disabled", () => {
    const onPress = jest.fn();
    const { getByLabelText } = render(
      <SelectChip disabled label="Repair" onPress={onPress} selected={false} />,
      { wrapper: Wrapper },
    );
    fireEvent.press(getByLabelText("Repair"));
    expect(onPress).not.toHaveBeenCalled();
  });

  it("prefers an explicit accessibility label over the visible text", () => {
    const { getByLabelText, getByText } = render(
      <SelectChip
        accessibilityLabel="Severity: high"
        label="High"
        onPress={() => undefined}
        selected={false}
      />,
      { wrapper: Wrapper },
    );
    expect(getByLabelText("Severity: high")).toBeTruthy();
    expect(getByText("High")).toBeTruthy();
  });
});
