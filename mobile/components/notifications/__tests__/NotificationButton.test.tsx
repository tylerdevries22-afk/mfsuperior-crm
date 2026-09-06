import { fireEvent, render } from "@testing-library/react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { createDemoOperationsState } from "@/domain/fixtures";
import { ThemeProvider } from "@/theme";
import { NotificationButton } from "../NotificationButton";

const mockPush = jest.fn();
const mockMarkRead = jest.fn();
const mockState = createDemoOperationsState();
const mockAccount = mockState.accounts.find((account) => account.role === "driver");

jest.mock("expo-router", () => ({ useRouter: () => ({ push: mockPush }) }));
jest.mock("@/store", () => ({
  useOptionalOperations: () => ({
    actions: { markMessageRead: mockMarkRead },
    currentAccount: mockAccount,
    messages: [{ id: "message-audit", body: "Dispatch update for your next stop", sentAt: "2099-01-01T12:00:00Z", recipientAccountIds: [mockAccount?.id], readByAccountIds: [] }],
    shipments: mockState.shipments,
    state: mockState,
  }),
}));
jest.mock("@expo/vector-icons/Feather", () => "Icon");

function screen() {
  return render(<SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 844, height: 390 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } }}><ThemeProvider mode="light"><NotificationButton /></ThemeProvider></SafeAreaProvider>);
}

beforeEach(() => jest.clearAllMocks());

it("opens, dismisses and reopens notifications with an accessible close target", () => {
  const view = screen();
  fireEvent.press(view.getByRole("button", { name: /unread notifications/ }));
  expect(view.getByText("Notifications")).toBeTruthy();
  expect(view.getByRole("button", { name: "Close notifications" })).toHaveStyle({ minWidth: 44, minHeight: 44 });
  fireEvent.press(view.getByRole("button", { name: "Close notifications" }));
  expect(view.queryByText("Notifications")).toBeNull();
  fireEvent.press(view.getByRole("button", { name: /unread notifications/ }));
  expect(view.getByText("Dispatch update for your next stop")).toBeTruthy();
});

it("marks an unread message read and opens messages when selected", () => {
  const view = screen();
  fireEvent.press(view.getByRole("button", { name: /unread notifications/ }));
  fireEvent.press(view.getByText("Dispatch update for your next stop"));
  expect(mockMarkRead).toHaveBeenCalledWith("message-audit");
  expect(mockPush).toHaveBeenCalledWith("/messages");
  expect(view.queryByText("Notifications")).toBeNull();
});

it("keeps the activity destination available", () => {
  const view = screen();
  fireEvent.press(view.getByRole("button", { name: /unread notifications/ }));
  fireEvent.press(view.getByText("View all activity"));
  expect(mockPush).toHaveBeenCalledWith("/messages");
});
