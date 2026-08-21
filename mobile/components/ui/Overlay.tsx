import type { ReactNode } from "react";
import {
  KeyboardAvoidingView,
  Modal as NativeModal,
  Platform,
  Pressable,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import Feather from "@expo/vector-icons/Feather";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ICON, makeStyles, RADIUS, SPACE, TYPO, useReducedMotion, useTheme } from "../../theme";
import { PressableSurface } from "./PressableSurface";

type OverlayCommonProps = {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  footer?: ReactNode;
  dismissible?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

export type BottomSheetProps = OverlayCommonProps;
export type AppModalProps = OverlayCommonProps;

const ViewStyleAbsoluteFill: ViewStyle = {
  position: "absolute",
  top: 0,
  right: 0,
  bottom: 0,
  left: 0,
};

const useStyles = makeStyles((theme) => ({
  fill: { flex: 1 },
  backdrop: { ...ViewStyleAbsoluteFill, backgroundColor: theme.overlay },
  keyboard: { flex: 1, justifyContent: "flex-end" },
  sheet: {
    maxHeight: "88%",
    borderTopLeftRadius: RADIUS.xl,
    borderTopRightRadius: RADIUS.xl,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: theme.border,
    backgroundColor: theme.surface,
    paddingHorizontal: SPACE.lg,
  },
  grabber: {
    alignSelf: "center",
    width: 40,
    height: 5,
    marginTop: SPACE.sm,
    marginBottom: SPACE.xs,
    borderRadius: RADIUS.pill,
    backgroundColor: theme.borderLight,
  },
  header: { minHeight: 56, flexDirection: "row", alignItems: "center", gap: SPACE.sm },
  title: { ...TYPO.heading, color: theme.text, flex: 1 },
  close: { alignItems: "center", justifyContent: "center" },
  body: { flexShrink: 1 },
  footer: { paddingTop: SPACE.md, gap: SPACE.sm },
  modalKeyboard: { flex: 1, alignItems: "center", justifyContent: "center", padding: SPACE.lg },
  dialog: {
    width: "100%",
    maxWidth: 520,
    maxHeight: "88%",
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: theme.surface,
    paddingHorizontal: SPACE.lg,
    paddingBottom: SPACE.lg,
  },
}));

function OverlayHeader({ title, dismissible, onClose }: Pick<OverlayCommonProps, "title" | "dismissible" | "onClose">) {
  const styles = useStyles();
  const theme = useTheme();
  return (
    <View style={styles.header}>
      {title ? <Text accessibilityRole="header" style={styles.title}>{title}</Text> : <View style={styles.title} />}
      {dismissible ? (
        <PressableSurface accessibilityLabel="Close" onPress={onClose} style={styles.close}>
          <Feather name="x" size={ICON.lg} color={theme.text} />
        </PressableSurface>
      ) : null}
    </View>
  );
}

/** Bottom-aligned modal surface for filters, forms, and shipment actions. */
export function BottomSheet({
  visible,
  onClose,
  title,
  children,
  footer,
  dismissible = true,
  style,
  testID,
}: BottomSheetProps) {
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  return (
    <NativeModal
      animationType={reduceMotion ? "none" : "slide"}
      onRequestClose={dismissible ? onClose : undefined}
      statusBarTranslucent
      transparent
      visible={visible}
    >
      <View accessibilityViewIsModal style={styles.fill} testID={testID}>
        <Pressable
          accessibilityLabel="Close sheet"
          accessibilityRole="button"
          disabled={!dismissible}
          onPress={onClose}
          style={styles.backdrop}
        />
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.keyboard}>
          <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, SPACE.md) }, style]}>
            <View accessibilityElementsHidden importantForAccessibility="no" style={styles.grabber} />
            <OverlayHeader dismissible={dismissible} onClose={onClose} title={title} />
            <View style={styles.body}>{children}</View>
            {footer ? <View style={styles.footer}>{footer}</View> : null}
          </View>
        </KeyboardAvoidingView>
      </View>
    </NativeModal>
  );
}

/** Centered modal surface for confirmations and short focused tasks. */
export function AppModal({
  visible,
  onClose,
  title,
  children,
  footer,
  dismissible = true,
  style,
  testID,
}: AppModalProps) {
  const styles = useStyles();
  const reduceMotion = useReducedMotion();
  return (
    <NativeModal
      animationType={reduceMotion ? "none" : "fade"}
      onRequestClose={dismissible ? onClose : undefined}
      statusBarTranslucent
      transparent
      visible={visible}
    >
      <View accessibilityViewIsModal style={styles.fill} testID={testID}>
        <Pressable accessibilityLabel="Close dialog" accessibilityRole="button" disabled={!dismissible} onPress={onClose} style={styles.backdrop} />
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.modalKeyboard}>
          <View style={[styles.dialog, style]}>
            <OverlayHeader dismissible={dismissible} onClose={onClose} title={title} />
            <View style={styles.body}>{children}</View>
            {footer ? <View style={styles.footer}>{footer}</View> : null}
          </View>
        </KeyboardAvoidingView>
      </View>
    </NativeModal>
  );
}
