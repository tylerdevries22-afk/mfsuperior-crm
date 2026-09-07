import Feather from "@expo/vector-icons/Feather";
import { View } from "react-native";

import { DriverAvatar } from "@/components/operations";
import { ListRow, Sheet, statusLabel } from "@/components/ui";
import type { Driver, Shipment } from "@/domain/types";
import { findAvailabilityConflicts } from "@/route-support/availability/utils";
import { driverFullName, scheduledEnd, scheduledStart } from "@/route-support/schedule/utils";
import { ICON, useTheme } from "@/theme";

import { styles } from "../styles";

/** Driver picker for one load, flagging blocked drivers and overlapping work. */
export function AssignDriverSheet({
  blockedDriverIds,
  busy,
  candidates,
  onAssign,
  onClose,
  shipment,
  shipments,
}: {
  readonly blockedDriverIds: ReadonlySet<string>;
  readonly busy: boolean;
  readonly candidates: readonly Driver[];
  readonly onAssign: (driverId: string) => void;
  readonly onClose: () => void;
  readonly shipment: Shipment;
  readonly shipments: readonly Shipment[];
}) {
  const theme = useTheme();
  return (
    <Sheet
      onClose={onClose}
      title={`Assign ${shipment.loadNumber}`}
      visible
    >
      <View style={styles.sheetBody}>
        {candidates.map((driver, index) => {
          const blocked = blockedDriverIds.has(driver.id);
          const conflicts = findAvailabilityConflicts(
            shipments,
            driver.id,
            scheduledStart(shipment) ?? "",
            scheduledEnd(shipment) ?? "",
          );
          return (
            <ListRow
              disabled={busy}
              isLast={index === candidates.length - 1}
              key={driver.id}
              leading={<DriverAvatar driver={driver} ring={false} size={36} />}
              onPress={() => onAssign(driver.id)}
              rich={blocked || conflicts.length > 0}
              subtitle={blocked
                ? "Marked unavailable for this window"
                : conflicts.length > 0
                  ? `Already on ${conflicts.map((load) => load.loadNumber).join(", ")}`
                  : statusLabel(driver.status)}
              title={driverFullName(driver)}
              trailing={
                blocked || conflicts.length > 0
                  ? <Feather color={theme.warning} name="alert-triangle" size={ICON.md} />
                  : <Feather color={theme.textMuted} name="chevron-right" size={ICON.md} />
              }
            />
          );
        })}
      </View>
    </Sheet>
  );
}
