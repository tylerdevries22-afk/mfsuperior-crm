import { useId, useState, type ReactNode } from "react";
import {
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from "react-native";
import { Feather } from "@expo/vector-icons";

import { ICON, makeStyles, RADIUS, SIZE, SPACE, TYPO, useTheme } from "../../theme";

export type TextFieldProps = TextInputProps & {
  label?: string;
  helperText?: string;
  error?: string;
  leading?: ReactNode;
  trailing?: ReactNode;
  containerStyle?: StyleProp<ViewStyle>;
};

const useStyles = makeStyles((theme) => ({
  group: { gap: SPACE.xs },
  label: { ...TYPO.captionStrong, color: theme.text },
  field: {
    minHeight: SIZE.input.default,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: theme.surface,
    paddingHorizontal: SPACE.md,
    flexDirection: "row",
    alignItems: "center",
    gap: SPACE.sm,
  },
  focused: { borderColor: theme.primaryLight, borderWidth: 2, paddingHorizontal: SPACE.md - 1 },
  invalid: { borderColor: theme.danger },
  disabled: { opacity: 0.5 },
  multiline: { minHeight: 112, alignItems: "flex-start", paddingVertical: SPACE.md },
  input: { ...TYPO.body, color: theme.text, flex: 1, minWidth: 0, paddingVertical: 0 },
  multilineInput: { minHeight: 80, textAlignVertical: "top" },
  helper: { ...TYPO.subtitle, color: theme.textSecondary },
  error: { ...TYPO.subtitle, color: theme.danger },
}));

/** Labeled input with visible focus, inline validation, and keyboard-safe sizing. */
export function TextField({
  label,
  helperText,
  error,
  leading,
  trailing,
  containerStyle,
  style,
  onFocus,
  onBlur,
  editable = true,
  multiline = false,
  accessibilityLabel,
  ...props
}: TextFieldProps) {
  const styles = useStyles();
  const theme = useTheme();
  const [focused, setFocused] = useState(false);
  const generatedId = useId();

  return (
    <View style={[styles.group, containerStyle]}>
      {label ? <Text nativeID={`${generatedId}-label`} style={styles.label}>{label}</Text> : null}
      <View style={[
        styles.field,
        focused && styles.focused,
        error && styles.invalid,
        !editable && styles.disabled,
        multiline && styles.multiline,
      ]}>
        {leading}
        <TextInput
          {...props}
          accessibilityLabel={accessibilityLabel ?? label}
          accessibilityLabelledBy={label ? `${generatedId}-label` : undefined}
          editable={editable}
          multiline={multiline}
          onBlur={(event) => { setFocused(false); onBlur?.(event); }}
          onFocus={(event) => { setFocused(true); onFocus?.(event); }}
          placeholderTextColor={theme.textMuted}
          selectionColor={theme.primaryLight}
          style={[styles.input, multiline && styles.multilineInput, style]}
        />
        {trailing}
      </View>
      {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
      {!error && helperText ? <Text style={styles.helper}>{helperText}</Text> : null}
    </View>
  );
}

export type SearchFieldProps = Omit<TextFieldProps, "leading">;

export function SearchField(props: SearchFieldProps) {
  const theme = useTheme();
  return (
    <TextField
      accessibilityRole="search"
      leading={<Feather name="search" size={ICON.md} color={theme.textMuted} />}
      returnKeyType="search"
      {...props}
    />
  );
}

export function TextArea(props: Omit<TextFieldProps, "multiline">) {
  return <TextField multiline numberOfLines={4} {...props} />;
}
