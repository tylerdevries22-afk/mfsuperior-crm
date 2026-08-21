import { Switch, Text, View } from "react-native";

import { makeStyles, RADIUS_DENSE, SIZE, SPACE, TYPO, useTheme } from "../../theme";
import { PressableSurface } from "./PressableSurface";

export type SwitchRowProps = {
  label: string;
  description?: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
  disabled?: boolean;
};

const useStyles = makeStyles((theme) => ({
  switchRow: {
    minHeight: SIZE.row.default,
    paddingVertical: SPACE.sm,
    flexDirection: "row",
    alignItems: "center",
    gap: SPACE.md,
  },
  copy: { flex: 1, minWidth: 0 },
  label: { ...TYPO.rowTitle, color: theme.text },
  description: { ...TYPO.caption, color: theme.textSecondary, marginTop: 2 },
  segments: {
    minHeight: SIZE.button.sm,
    flexDirection: "row",
    gap: SPACE.xxs,
    padding: SPACE.xxs,
    borderRadius: RADIUS_DENSE.lg,
    backgroundColor: theme.surfaceElevated,
    borderWidth: 1,
    borderColor: theme.border,
  },
  segment: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: RADIUS_DENSE.md,
    paddingHorizontal: SPACE.sm,
  },
  selected: { backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.borderLight },
  segmentLabel: { ...TYPO.captionStrong, color: theme.textSecondary, textAlign: "center" },
  selectedLabel: { color: theme.text },
}));

/** Accessible preference row with the full label as its touch target. */
export function SwitchRow({ label, description, value, onValueChange, disabled = false }: SwitchRowProps) {
  const styles = useStyles();
  const theme = useTheme();
  return (
    <PressableSurface
      accessibilityLabel={label}
      accessibilityRole="switch"
      accessibilityState={{ checked: value, disabled }}
      disabled={disabled}
      haptic="selection"
      onPress={() => onValueChange(!value)}
      style={styles.switchRow}
    >
      <View style={styles.copy}>
        <Text style={styles.label}>{label}</Text>
        {description ? <Text style={styles.description}>{description}</Text> : null}
      </View>
      <Switch
        accessibilityElementsHidden
        importantForAccessibility="no"
        disabled={disabled}
        onValueChange={onValueChange}
        trackColor={{ false: theme.surfaceBright, true: theme.primary }}
        thumbColor={value ? theme.primaryForeground : theme.textMuted}
        value={value}
        pointerEvents="none"
      />
    </PressableSurface>
  );
}

export type SegmentOption<Value extends string> = { label: string; value: Value };
export type SegmentedControlProps<Value extends string> = {
  options: readonly SegmentOption<Value>[];
  value: Value;
  onChange: (value: Value) => void;
  accessibilityLabel: string;
};

/** Compact mutually-exclusive filter or mode control. */
export function SegmentedControl<Value extends string>({ options, value, onChange, accessibilityLabel }: SegmentedControlProps<Value>) {
  const styles = useStyles();
  return (
    <View accessibilityLabel={accessibilityLabel} accessibilityRole="radiogroup" style={styles.segments}>
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <PressableSurface
            key={option.value}
            accessibilityLabel={option.label}
            accessibilityRole="radio"
            accessibilityState={{ checked: selected }}
            haptic="selection"
            onPress={() => onChange(option.value)}
            style={[styles.segment, selected && styles.selected]}
          >
            <Text style={[styles.segmentLabel, selected && styles.selectedLabel]}>{option.label}</Text>
          </PressableSurface>
        );
      })}
    </View>
  );
}
