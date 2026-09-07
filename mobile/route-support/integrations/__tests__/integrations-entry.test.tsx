import { fireEvent, render } from "@testing-library/react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { createDemoOperationsState } from "@/domain/fixtures";
import { FREIGHT_PARTNERS } from "@/features/partner-integrations";
import { ThemeProvider } from "@/theme";
import { AdminConsoleSection } from "@/route-support/profile/AdminConsoleSection";

const mockState = createDemoOperationsState();
const mockPush = jest.fn();
let mockRole = "admin";

jest.mock("expo-router", () => ({ useRouter: () => ({ push: mockPush }) }));
jest.mock("@expo/vector-icons/Feather", () => "Icon");
jest.mock("@expo/vector-icons", () => ({ Feather: "Icon" }));
jest.mock("@/components/operations", () => ({ PayoutRailMosaic: () => null }));
jest.mock("@/store", () => ({
  useOperations: () => ({
    state: mockState,
    vehicles: mockState.vehicles,
    shipments: mockState.shipments,
    maintenanceOrders: mockState.maintenanceOrders,
    complianceDocuments: mockState.complianceDocuments,
    currentAccount: mockState.accounts.find((account) => account.role === "admin"),
    effectiveRole: mockRole,
    isDemo: true,
    actions: {},
  }),
  useOptionalOperations: () => null,
}));

function Wrapper({ children }: { children: React.ReactNode }) {
  return <SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 320, height: 568 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } }}><ThemeProvider mode="light">{children}</ThemeProvider></SafeAreaProvider>;
}

beforeEach(() => { mockRole = "admin"; mockPush.mockClear(); });

it("lists Integrations directly under Licensing & registration", () => {
  const view = render(<AdminConsoleSection />, { wrapper: Wrapper });
  const titles = view.getAllByText(/^(Licensing & registration|Integrations)$/).map((node) => node.props.children);
  expect(titles).toEqual(["Licensing & registration", "Integrations"]);
});

it("routes the Integrations row to its own screen", () => {
  const view = render(<AdminConsoleSection />, { wrapper: Wrapper });
  fireEvent.press(view.getByText("Integrations"));
  expect(mockPush).toHaveBeenCalledWith("/integrations");
});

it("hides the operations console entirely from non-admins", () => {
  mockRole = "driver";
  const view = render(<AdminConsoleSection />, { wrapper: Wrapper });
  expect(view.queryByText("Integrations")).toBeNull();
});

it("keeps every partner reachable from the integrations catalogue", () => {
  expect(FREIGHT_PARTNERS.length).toBeGreaterThan(0);
  for (const partner of FREIGHT_PARTNERS) {
    expect(partner.portalUrl.startsWith("https://")).toBe(true);
    expect(partner.statusLabel.length).toBeGreaterThan(0);
  }
});
