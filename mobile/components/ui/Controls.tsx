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
  /**
   * iOS draws the track as a plain tinted fill with no outline; the outline
   * competed with the selected segment for the eye.
   */
  segments: {
    minHeight: SIZE.button.sm,
    flexDirection: "row",
    gap: SPACE.xxs,
    padding: 2,
    borderRadius: RADIUS_DENSE.lg,
    backgroundColor: theme.fill.tertiary,
  },
  segment: {
    flex: 1,
    minWidth: 0,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: RADIUS_DENSE.md,
    paddingHorizontal: SPACE.xs,
  },
  /** The selected segment lifts off the track with a shadow rather than a border. */
  selected: {
    backgroundColor: theme.surface,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.12,
    shadowRadius: 3,
    elevation: 2,
  },
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
            <Text numberOfLines={1} style={[styles.segmentLabel, selected && styles.selectedLabel]}>
              {option.label}
            </Text>
          </PressableSurface>
        );
      })}
    </View>
  );
}
