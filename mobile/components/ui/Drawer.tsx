import type { ReactNode } from "react";
import { Feather } from "@expo/vector-icons";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { makeStyles, RADIUS, SPACE, TYPO, useReducedMotion, useTheme } from "../../theme";
import { AnimatedPressable } from "./AnimatedPressable";

export type DrawerProps = {
  visible: boolean;
  onClose: () => void;
  children: ReactNode;
  title?: string;
  side?: "left" | "right";
  dismissible?: boolean;
  footer?: ReactNode;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

const useStyles = makeStyles((theme) => ({
  fill: { flex: 1, flexDirection: "row" },
  alignRight: { justifyContent: "flex-end" },
  backdrop: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, backgroundColor: theme.overlay },
  keyboard: { flex: 1, flexDirection: "row" },
  keyboardRight: { justifyContent: "flex-end" },
  panel: {
    width: 340,
    maxWidth: "88%",
    backgroundColor: theme.surface,
    borderColor: theme.border,
  },
  panelLeft: { borderRightWidth: 1, borderTopRightRadius: RADIUS.lg, borderBottomRightRadius: RADIUS.lg },
  panelRight: { borderLeftWidth: 1, borderTopLeftRadius: RADIUS.lg, borderBottomLeftRadius: RADIUS.lg },
  header: { minHeight: 56, paddingHorizontal: SPACE.lg, flexDirection: "row", alignItems: "center", gap: SPACE.sm },
  title: { ...TYPO.heading, color: theme.text, flex: 1 },
  close: { alignItems: "center", justifyContent: "center" },
  body: { flex: 1, paddingHorizontal: SPACE.lg },
  footer: { paddingHorizontal: SPACE.lg, paddingTop: SPACE.md },
}));

/**
 * Side-panel drawer adapted from Appliance Diagnostic Systems commit
 * 480991b7eb0036e4e85c37d3784b2de2ca97d10d overlay geometry.
 */
export function Drawer({
  visible,
  onClose,
  children,
  title,
  side = "right",
  dismissible = true,
  footer,
  style,
  testID,
}: DrawerProps) {
  const styles = useStyles();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const right = side === "right";

  return (
    <Modal
      animationType={reduceMotion ? "none" : "fade"}
      onRequestClose={dismissible ? onClose : undefined}
      statusBarTranslucent
      transparent
      visible={visible}
    >
      <View accessibilityViewIsModal style={[styles.fill, right && styles.alignRight]} testID={testID}>
        <Pressable
          accessibilityLabel="Close drawer"
          accessibilityRole="button"
          disabled={!dismissible}
          onPress={onClose}
          style={styles.backdrop}
        />
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={[styles.keyboard, right && styles.keyboardRight]}
        >
          <View
            style={[
              styles.panel,
              right ? styles.panelRight : styles.panelLeft,
              { paddingBottom: Math.max(insets.bottom, SPACE.md), paddingTop: Math.max(insets.top, SPACE.md) },
              style,
            ]}
          >
            <View style={styles.header}>
              {title ? <Text accessibilityRole="header" style={styles.title}>{title}</Text> : <View style={styles.title} />}
              {dismissible ? (
                <AnimatedPressable accessibilityLabel="Close" onPress={onClose} style={styles.close}>
                  <Feather color={theme.text} name="x" size={24} />
                </AnimatedPressable>
              ) : null}
            </View>
            <View style={styles.body}>{children}</View>
            {footer ? <View style={styles.footer}>{footer}</View> : null}
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}
