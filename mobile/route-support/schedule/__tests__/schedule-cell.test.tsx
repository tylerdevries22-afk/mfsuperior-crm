import { fireEvent, render } from "@testing-library/react-native";

import { createDemoOperationsState } from "../../../domain/fixtures";
import { THEME } from "../../../theme";
import { DriverRow } from "../ScheduleBoardCells";

describe("schedule cell navigation", () => {
  it("keeps a load inside an occupied cell clickable", () => {
    const state = createDemoOperationsState();
    const driver = state.drivers[0];
    const load = state.shipments[0];
    const onLoadPress = jest.fn();
    const onCellPress = jest.fn();
    const view = render(<DriverRow
      contentForCell={() => ({ blocks: [], loads: [load], shifts: [] })}
      dateKeys={["2026-09-05"]}
      driver={driver}
      onBlockPress={jest.fn()}
      onCellPress={onCellPress}
      onLoadPress={onLoadPress}
      onShiftPress={jest.fn()}
      theme={THEME}
    />);
    // RN Web disables all pointer events below a disabled Pressable.
    expect(view.getByRole("button", { name: `${load.loadNumber} load` })).toBeEnabled();
    fireEvent.press(view.getByRole("button", { name: `${load.loadNumber} load` }));
    expect(onLoadPress).toHaveBeenCalledWith(load.id);
    expect(onCellPress).not.toHaveBeenCalled();
  });
});
