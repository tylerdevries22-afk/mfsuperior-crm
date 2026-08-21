import type { PropsWithChildren } from "react";
import { Text } from "react-native";
import { fireEvent, render } from "@testing-library/react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { ThemeProvider } from "../../../theme";
import { Badge, StatusBadge } from "../Badge";
import { Button } from "../Button";
import { Card } from "../Card";
import { SegmentedControl, SwitchRow } from "../Controls";
import { FadeInView } from "../FadeInView";
import { Header } from "../Header";
import { IconButton } from "../IconButton";
import { List, ListRow } from "../List";
import { AppModal, BottomSheet } from "../Overlay";
import { Screen } from "../Screen";
import { SectionHeader } from "../SectionHeader";
import { SkeletonCard } from "../Skeleton";
import { EmptyState, ErrorState, LoadingState } from "../StateViews";
import { deltaPercent, StatTile } from "../StatTile";
import { SearchField, TextArea, TextField } from "../TextField";
import { AppText, Eyebrow, Heading, SectionTitle, Title } from "../Typography";

jest.mock("@expo/vector-icons", () => {
  const mockReact = jest.requireActual<typeof import("react")>("react");
  const mockReactNative = jest.requireActual<typeof import("react-native")>("react-native");
  return {
    Ionicons: ({ name }: { name: string }) => mockReact.createElement(mockReactNative.Text, null, name),
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

describe("mobile UI primitives", () => {
  it("renders and activates the core navigation surfaces", () => {
    const onBack = jest.fn();
    const onAction = jest.fn();
    const view = render(
      <>
        <Header onBack={onBack} rightAction={<Badge label="Simulated" tone="warning" />} showBack title="Shipment" />
        <Screen scroll={false}>
          <Card title="Active load"><StatusBadge status="in_transit" /></Card>
          <List><ListRow isLast onPress={onAction} title="Stop 1" subtitle="Aurora crossdock" /></List>
          <Button onPress={onAction} title="Arrived at stop" />
          <StatTile label="On-time" value="96%" />
        </Screen>
      </>,
      { wrapper: Wrapper },
    );

    fireEvent.press(view.getByLabelText("Back"));
    fireEvent.press(view.getByLabelText("Arrived at stop"));
    expect(onBack).toHaveBeenCalledTimes(1);
    expect(onAction).toHaveBeenCalledTimes(1);
    expect(view.getByText("In Transit")).toBeTruthy();
  });

  it("renders labeled form, preference, and state controls", () => {
    const onChange = jest.fn();
    const view = render(
      <Screen>
        <TextField label="Trailer number" placeholder="Enter trailer" />
        <SearchField label="Search shipments" />
        <TextArea label="Exception notes" />
        <SwitchRow label="Share location" onValueChange={onChange} value={false} />
        <SegmentedControl
          accessibilityLabel="Shipment filter"
          onChange={onChange}
          options={[{ label: "Active", value: "active" }, { label: "All", value: "all" }]}
          value="active"
        />
        <SectionHeader action="View all" onAction={onChange} title="Today" />
        <IconButton icon="settings" label="Settings" onPress={onChange} />
        <FadeInView><AppText>Route ready</AppText></FadeInView>
        <Eyebrow>Operations</Eyebrow>
        <Title>Dispatch</Title>
        <SectionTitle>Loads</SectionTitle>
        <Heading>Next stop</Heading>
        <SkeletonCard />
        <EmptyState description="No tenders are waiting." title="No tenders" />
        <ErrorState message="Shipment data is unavailable." title="Could not load" />
        <LoadingState label="Loading route" />
        <BottomSheet onClose={onChange} visible={false}><Text>Sheet</Text></BottomSheet>
        <AppModal onClose={onChange} visible={false}><Text>Dialog</Text></AppModal>
        <Text>End</Text>
      </Screen>,
      { wrapper: Wrapper },
    );

    expect(view.getByLabelText("Trailer number")).toBeTruthy();
    fireEvent.press(view.getByLabelText("Share location"));
    expect(onChange).toHaveBeenCalledWith(true);
    expect(view.getByText("No tenders are waiting.")).toBeTruthy();
  });

  it("calculates KPI deltas without inventing a missing baseline", () => {
    expect(deltaPercent(120, 100)).toBe(20);
    expect(deltaPercent(80, 100)).toBe(-20);
    expect(deltaPercent(100, 0)).toBeNull();
    expect(deltaPercent(100)).toBeNull();
  });
});
