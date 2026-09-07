import { fireEvent, render } from "@testing-library/react-native";
import type { ReactNode } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { createDemoOperationsState } from "@/domain/fixtures";
import type { ShipmentStatus } from "@/domain/types";
import { loadLifecycleAction } from "@/lib/load-actions";
import { ThemeProvider } from "@/theme";
import { MilestoneFooter } from "../MilestoneFooter";

function Wrapper({ children }: { children: ReactNode }) {
  return <SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 47, left: 0, right: 0, bottom: 34 } }}><ThemeProvider mode="light">{children}</ThemeProvider></SafeAreaProvider>;
}
const onAdvance = jest.fn();
const onAdvanceStop = jest.fn(async () => undefined);
const base = { busyAction: null, hasDriver: true, onAdvance, onAdvanceStop };
beforeEach(() => jest.clearAllMocks());

it.each<[ShipmentStatus, string]>([
  ["accepted", "Dispatch load"],
  ["dispatched", "Arrive at pickup"],
  ["at_pickup", "Pickup complete · loaded"],
  ["loaded", "Depart pickup"],
  ["in_transit", "Arrive at delivery"],
  ["at_delivery", "Capture proof of delivery"],
])("keeps the %s action in the safe-area footer", (status, label) => {
  const view = render(<MilestoneFooter {...base} action={loadLifecycleAction(status, "admin")} />, { wrapper: Wrapper });
  expect(view.getByTestId("load-milestone-footer")).toHaveStyle({ paddingBottom: 34, flexShrink: 0 });
  fireEvent.press(view.getByRole("button", { name: label }));
  expect(onAdvance).toHaveBeenCalledTimes(1);
});

it("shows intermediate arrival and completion actions before delivery", () => {
  const stop = createDemoOperationsState().shipments[0].stops.find((item) => item.type === "intermediate");
  if (!stop) throw new Error("Intermediate stop fixture required");
  const action = loadLifecycleAction("in_transit", "driver");
  const view = render(<MilestoneFooter {...base} action={action} intermediateStop={{ ...stop, status: "pending" }} />, { wrapper: Wrapper });
  expect(view.queryByText("Arrive at delivery")).toBeNull();
  fireEvent.press(view.getByRole("button", { name: "Arrive at intermediate stop" }));
  expect(onAdvanceStop).toHaveBeenCalledWith(expect.objectContaining({ id: stop.id, status: "pending" }));
  view.rerender(<MilestoneFooter {...base} action={action} intermediateStop={{ ...stop, status: "arrived" }} />);
  expect(view.getByRole("button", { name: "Complete intermediate stop" })).toBeTruthy();
});

it("keeps dispatch visible but disabled until a driver is assigned", () => {
  const view = render(<MilestoneFooter {...base} action={loadLifecycleAction("accepted", "admin")} hasDriver={false} />, { wrapper: Wrapper });
  expect(view.getByRole("button", { name: "Dispatch load" })).toBeDisabled();
  expect(view.getByText("Assign a driver to dispatch this load.")).toBeTruthy();
});

it("prevents duplicate transitions while a request is running", () => {
  const view = render(<MilestoneFooter {...base} action={loadLifecycleAction("dispatched", "driver")} busyAction="at_pickup" />, { wrapper: Wrapper });
  fireEvent.press(view.getByRole("button", { name: "Arrive at pickup" }));
  expect(onAdvance).not.toHaveBeenCalled();
});

it.each<[ShipmentStatus, "admin" | "customer"]>([["delivered", "admin"], ["exception", "admin"], ["in_transit", "customer"]])("does not create an action for %s / %s", (status, role) => {
  const view = render(<MilestoneFooter {...base} action={loadLifecycleAction(status, role)} />, { wrapper: Wrapper });
  expect(view.queryByTestId("load-milestone-footer")).toBeNull();
});
