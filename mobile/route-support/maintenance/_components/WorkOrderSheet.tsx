import Feather from "@expo/vector-icons/Feather";
import { Text, View } from "react-native";

import { AnimatedButton, Sheet, TextArea, TextField } from "@/components/ui";
import type { MaintenanceKind, MaintenanceSeverity, Vehicle } from "@/domain/types";
import { SelectChip } from "@/route-support/maintenance/_components/SelectChip";
import { MAINTENANCE_SEVERITY_LABELS } from "@/route-support/maintenance/utils";
import { ICON, useTheme } from "@/theme";

import { styles } from "../styles";

/** What the composer collects before a work order is opened. */
export interface WorkOrderDraft {
  readonly description: string;
  readonly kind: MaintenanceKind;
  readonly severity: MaintenanceSeverity;
  readonly summary: string;
  readonly vehicleId: string;
}

const KIND_OPTIONS: readonly { readonly label: string; readonly value: MaintenanceKind }[] = [
  { label: "Repair", value: "repair" },
  { label: "Preventive", value: "preventive" },
  { label: "Inspection", value: "inspection" },
];

const SEVERITY_OPTIONS: readonly MaintenanceSeverity[] = ["low", "medium", "high", "critical"];

/** Opens a work order against one unit. */
export function WorkOrderSheet({
  busy,
  canSubmit,
  draft,
  onChange,
  onClose,
  onSubmit,
  vehicles,
}: {
  readonly busy: boolean;
  readonly canSubmit: boolean;
  readonly draft: WorkOrderDraft;
  readonly onChange: (patch: Partial<WorkOrderDraft>) => void;
  readonly onClose: () => void;
  readonly onSubmit: () => void;
  readonly vehicles: readonly Vehicle[];
}) {
  const theme = useTheme();
  return (
    <Sheet
      footer={
        <AnimatedButton
          accessibilityLabel="Open this work order"
          disabled={!canSubmit}
          fullWidth
          loading={busy}
          onPress={onSubmit}
          title="Open work order"
        />
      }
      onClose={onClose}
      title="New work order"
      visible
    >
      <View style={styles.composer}>
        <Text style={[styles.label, { color: theme.textMuted }]}>UNIT</Text>
        <View style={styles.chipRow}>
          {vehicles.map((vehicle) => (
            <SelectChip
              key={vehicle.id}
              label={`Unit ${vehicle.unitNumber}`}
              onPress={() => onChange({ vehicleId: vehicle.id })}
              selected={draft.vehicleId === vehicle.id}
            />
          ))}
        </View>

        <Text style={[styles.label, { color: theme.textMuted }]}>KIND</Text>
        <View style={styles.chipRow}>
          {KIND_OPTIONS.map((option) => (
            <SelectChip
              key={option.value}
              label={option.label}
              onPress={() => onChange({ kind: option.value })}
              selected={draft.kind === option.value}
            />
          ))}
        </View>

        <Text style={[styles.label, { color: theme.textMuted }]}>SEVERITY</Text>
        <View style={styles.chipRow}>
          {SEVERITY_OPTIONS.map((option) => (
            <SelectChip
              key={option}
              label={MAINTENANCE_SEVERITY_LABELS[option]}
              onPress={() => onChange({ severity: option })}
              selected={draft.severity === option}
            />
          ))}
        </View>
        {draft.severity === "critical" ? (
          <View
            style={[
              styles.criticalNote,
              { backgroundColor: theme.dangerMuted, borderColor: theme.tint.danger.medium },
            ]}
          >
            <Feather color={theme.danger} name="alert-octagon" size={ICON.sm} />
            <Text style={[styles.criticalText, { color: theme.text }]}>
              A critical order takes the unit out of service and releases its driver.
            </Text>
          </View>
        ) : null}

        <TextField
          label="Summary"
          onChangeText={(summary) => onChange({ summary })}
          placeholder="Aftertreatment fault — derate warning"
          value={draft.summary}
        />
        <TextArea
          label="Details"
          onChangeText={(description) => onChange({ description })}
          placeholder="What the driver reported, and where the unit is now."
          value={draft.description}
        />
      </View>
    </Sheet>
  );
}
