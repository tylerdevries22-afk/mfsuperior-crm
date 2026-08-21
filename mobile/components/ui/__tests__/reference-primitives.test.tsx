import type { PropsWithChildren } from "react";
import { Text } from "react-native";
import { fireEvent, render } from "@testing-library/react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { ThemeProvider } from "../../../theme";
import { AnimatedButton } from "../AnimatedButton";
import { AnimatedCard } from "../AnimatedCard";
import { AnimatedPressable } from "../AnimatedPressable";
import { Button } from "../Button";
import { Card } from "../Card";
import { Drawer } from "../Drawer";
import { GlassCard } from "../GlassCard";
import { HorizontalCarousel } from "../HorizontalCarousel";
import { PressableSurface } from "../PressableSurface";
import { Sheet } from "../Sheet";
import { Timeline } from "../Timeline";
import { WorkspaceCard } from "../WorkspaceCard";

jest.mock("@expo/vector-icons", () => {
  const mockReact = jest.requireActual<typeof import("react")>("react");
  const mockReactNative = jest.requireActual<typeof import("react-native")>("react-native");
  return {
    Feather: ({ name }: { name: string }) => mockReact.createElement(mockReactNative.Text, null, name),
  };
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

describe("pinned-reference primitives", () => {
  it("exports separate implementations rather than component aliases", () => {
    expect(AnimatedButton).not.toBe(Button);
    expect(AnimatedCard).not.toBe(Card);
    expect(GlassCard).not.toBe(Card);
    expect(WorkspaceCard).not.toBe(Card);
    expect(AnimatedPressable).not.toBe(PressableSurface);
  });

  it("preserves press behavior and accessible targets", () => {
    const onPress = jest.fn();
    const view = render(
      <>
        <AnimatedPressable accessibilityLabel="Open load" onPress={onPress}>
          <Text>Open</Text>
        </AnimatedPressable>
        <AnimatedButton onPress={onPress} title="Accept tender" />
        <AnimatedCard accessibilityLabel="Load card" onPress={onPress}>
          <Text>Load</Text>
        </AnimatedCard>
      </>,
      { wrapper: Wrapper },
    );

    fireEvent.press(view.getByLabelText("Open load"));
    fireEvent.press(view.getByLabelText("Accept tender"));
    fireEvent.press(view.getByLabelText("Load card"));
    expect(onPress).toHaveBeenCalledTimes(3);
    expect(view.getByLabelText("Open load")).toHaveStyle({ minHeight: 44, minWidth: 44 });
  });

  it("renders glass, workspace, timeline, and carousel compositions", () => {
    const onAction = jest.fn();
    const view = render(
      <>
        <GlassCard testID="glass"><Text>Glass content</Text></GlassCard>
        <WorkspaceCard action="View all" onAction={onAction} title="Capacity" testID="workspace">
          <Text>Two trailers</Text>
        </WorkspaceCard>
        <Timeline
          entries={[{ id: "event-1", onPress: onAction, title: "Picked up", timestamp: "09:15", tone: "success" }]}
        />
        <HorizontalCarousel
          accessibilityLabel="Recommended loads"
          data={["Denver", "Aurora"]}
          itemWidth={180}
          keyExtractor={(item) => item}
          renderItem={({ item }) => <Text>{item}</Text>}
        />
      </>,
      { wrapper: Wrapper },
    );

    fireEvent.press(view.getByLabelText("View all"));
    fireEvent.press(view.getByLabelText("Picked up"));
    expect(onAction).toHaveBeenCalledTimes(2);
    expect(view.getByTestId("glass")).toBeTruthy();
    expect(view.getByTestId("workspace")).toBeTruthy();
    expect(view.getByLabelText("Recommended loads")).toBeTruthy();
  });

  it("renders separate sheet and drawer surfaces", () => {
    const onClose = jest.fn();
    const view = render(
      <>
        <Sheet onClose={onClose} title="Filters" visible={false}><Text>Sheet body</Text></Sheet>
        <Drawer onClose={onClose} title="Load filters" visible={false}><Text>Drawer body</Text></Drawer>
      </>,
      { wrapper: Wrapper },
    );
    expect(view.queryByText("Sheet body")).toBeNull();
    expect(view.queryByText("Drawer body")).toBeNull();
  });
});
