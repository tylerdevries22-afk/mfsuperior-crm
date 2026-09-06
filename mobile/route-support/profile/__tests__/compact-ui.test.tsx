import { fireEvent, render, waitFor } from "@testing-library/react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { createDemoOperationsState } from "@/domain/fixtures";
import { ThemeProvider, useTheme } from "@/theme";
import { AccountPanel } from "../AccountPanel";
import { CoverageInbox } from "@/route-support/schedule/CoverageInbox";
import { FleetRow } from "@/route-support/fleet/FleetRow";
import { buildFleetEntries } from "@/route-support/fleet/utils";

const mockState = createDemoOperationsState();
const mockSwitch = jest.fn(async () => true);
const mockPush = jest.fn();
jest.mock("expo-router", () => ({ useRouter: () => ({ push: mockPush }) }));
jest.mock("@expo/vector-icons/Feather", () => "Icon");
jest.mock("@expo/vector-icons", () => ({ Feather: "Icon" }));
jest.mock("@/store", () => ({ useOperations: () => ({ state: mockState, currentAccount: mockState.accounts.find((a) => a.role === "admin"), effectiveRole: "admin", isDemo: true, actions: { switchDemoRole: mockSwitch } }), useOptionalOperations: () => null }));
function Wrapper({ children }: { children: React.ReactNode }) {
  return <SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 320, height: 568 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } }}><ThemeProvider mode="light">{children}</ThemeProvider></SafeAreaProvider>;
}

it("opens the account dropdown and switches roles from the name and badge", async () => {
  const view = render(<AccountPanel />, { wrapper: Wrapper });
  expect(view.queryByText("Preview as")).toBeNull();
  expect(view.queryByLabelText("Switch to driver")).toBeNull();
  fireEvent.press(view.getByLabelText("Marcus Ford, admin, account menu"));
  expect(view.getByLabelText("Switch to admin")).toHaveProp("accessibilityState", expect.objectContaining({ checked: true }));
  fireEvent.press(view.getByLabelText("Switch to driver"));
  await waitFor(() => expect(mockSwitch).toHaveBeenCalledWith("driver"));
  await waitFor(() => expect(view.queryByLabelText("Switch to driver")).toBeNull());
});

it("keeps fleet row navigation and unit details", () => {
  const entry = buildFleetEntries(mockState.vehicles, mockState.drivers, mockState.maintenanceOrders, mockState.complianceDocuments)[0];
  if (!entry) throw new Error("Missing fixture fleet entry");
  const onPress = jest.fn();
  const view = render(<FleetRow entry={entry} onPress={onPress} />, { wrapper: Wrapper });
  fireEvent.press(view.getByLabelText(`Open Unit ${entry.vehicle.unitNumber}`));
  expect(onPress).toHaveBeenCalledTimes(1);
  expect(view.getByText(`Unit ${entry.vehicle.unitNumber}`)).toBeTruthy();
});

it("shows coverage portraits with presence labels and a pending status", () => {
  function Inbox() {
    return <CoverageInbox currentDriver={null} drivers={mockState.drivers} isAdmin onRespond={jest.fn()} requests={mockState.shiftCoverageRequests} shifts={mockState.driverShifts} theme={useTheme()} />;
  }
  const view = render(<Inbox />, { wrapper: Wrapper });
  expect(view.getByText("Pending")).toBeTruthy();
  expect(view.getByLabelText(/Samuel Ortiz,/)).toBeTruthy();
  expect(view.getByLabelText(/Brenna Lewis,/)).toBeTruthy();
});
