import Feather from "@expo/vector-icons/Feather";
import { StyleSheet, Text, View } from "react-native";

import { AnimatedPressable } from "@/components/ui";
import { FONTS, ICON, RADIUS, SPACE, TYPO, useTheme } from "@/theme";

/**
 * A pill that picks one option out of a row.
 *
 * Deliberately not built on `ListRow`. That primitive is a full-width settings
 * row whose title sits in a `flex: 1` container; inside a wrapping chip row the
 * chip has no width to give it, so the label collapses to nothing and all that
 * survives is the row's own trailing chevron. A pill has to size to its own
 * text, which means a pressable wrapping a `Text` and nothing more.
 */
export interface SelectChipProps {
  readonly label: string;
  readonly selected: boolean;
  readonly onPress: () => void;
  readonly disabled?: boolean;
  readonly accessibilityLabel?: string;
}

export function SelectChip({
  accessibilityLabel,
  disabled = false,
  label,
  onPress,
  selected,
}: SelectChipProps) {
  const theme = useTheme();
  return (
    <AnimatedPressable
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityRole="radio"
      accessibilityState={{ disabled, selected }}
      disabled={disabled}
      ensureMinTarget={false}
      haptic="selection"
      style={[
        styles.chip,
        { backgroundColor: theme.surfaceElevated, borderColor: theme.border },
        selected && { backgroundColor: theme.tint.primary.medium, borderColor: theme.primaryLight },
        disabled && styles.disabled,
      ]}
      onPress={onPress}
    >
      <View style={styles.inner}>
        {selected ? (
          <Feather
            accessibilityElementsHidden
            color={theme.primaryLight}
            importantForAccessibility="no"
            name="check"
            size={ICON.xs}
          />
        ) : null}
        <Text
          numberOfLines={1}
          style={[styles.label, { color: selected ? theme.text : theme.textSecondary }]}
        >
          {label}
        </Text>
      </View>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    // A 40pt target rather than the 44pt default: a wrapping row of pills that
    // each claimed 44 square would push the composer's fields off the sheet.
    minHeight: 40,
    justifyContent: "center",
    paddingHorizontal: SPACE.md,
    paddingVertical: SPACE.xs,
  },
  disabled: { opacity: 0.5 },
  inner: { alignItems: "center", flexDirection: "row", gap: SPACE.xxs },
  label: { ...TYPO.caption, fontFamily: FONTS.medium },
});
