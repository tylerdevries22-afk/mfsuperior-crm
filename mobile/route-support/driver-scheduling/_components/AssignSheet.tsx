import { ScrollView, Text } from "react-native";

import { ListRow, Sheet, StatusBadge } from "@/components/ui";
import type { Driver, Shipment } from "@/domain/types";
import { driverFullName, formatTime, scheduledStart } from "@/route-support/schedule/utils";
import { useTheme } from "@/theme";

import { styles } from "../styles";

/** Places one of the unassigned loads onto the driver whose cell was tapped. */
export function AssignSheet({
  busy,
  driver,
  loads,
  onAssign,
  onClose,
}: {
  readonly busy: boolean;
  readonly driver: Driver | null;
  readonly loads: readonly Shipment[];
  readonly onAssign: (shipmentId: string) => void;
  readonly onClose: () => void;
}) {
  const theme = useTheme();
  return (
    <Sheet
      onClose={onClose}
      title={driver ? `Assign to ${driverFullName(driver)}` : "Assign a load"}
      visible
    >
      <ScrollView contentContainerStyle={styles.sheetBody} showsVerticalScrollIndicator={false}>
        {loads.length === 0 ? (
          <Text style={[styles.emptyNote, { color: theme.textSecondary }]}>
            There are no unassigned loads to place.
          </Text>
        ) : (
          loads.map((load, index) => (
            <UnassignedRow
              busy={busy}
              isLast={index === loads.length - 1}
              key={load.id}
              load={load}
              onPress={() => onAssign(load.id)}
            />
          ))
        )}
      </ScrollView>
    </Sheet>
  );
}

function UnassignedRow({
  busy,
  isLast,
  load,
  onPress,
}: {
  readonly busy: boolean;
  readonly isLast: boolean;
  readonly load: Shipment;
  readonly onPress: () => void;
}) {
  const startsAt = scheduledStart(load);
  return (
    <ListRow
      disabled={busy}
      isLast={isLast}
      onPress={onPress}
      subtitle={`${startsAt ? formatTime(startsAt) : "Unscheduled"} · ${load.distanceMiles.toLocaleString()} mi`}
      title={load.loadNumber}
      trailing={<StatusBadge size="sm" status={load.status} />}
    />
  );
}
