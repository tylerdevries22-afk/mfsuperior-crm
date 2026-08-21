import { Text, View } from "react-native";

import { makeStyles, SIZE, SPACE, TYPO } from "../../theme";
import { PressableSurface } from "./PressableSurface";

export type SectionHeaderProps = {
  title: string;
  action?: string;
  onAction?: () => void;
};

const useStyles = makeStyles((theme) => ({
  header: { marginTop: SPACE.md, flexDirection: "row", alignItems: "center", gap: SPACE.md },
  title: { ...TYPO.section, color: theme.text, flex: 1 },
  actionButton: { minWidth: SIZE.hit, alignItems: "center", justifyContent: "center", paddingHorizontal: SPACE.xs },
  action: { ...TYPO.captionStrong, color: theme.primaryLight },
}));

/** Section title with an optional trailing text action. */
export function SectionHeader({ title, action, onAction }: SectionHeaderProps) {
  const styles = useStyles();
  return (
    <View style={styles.header}>
      <Text accessibilityRole="header" style={styles.title}>{title}</Text>
      {action && onAction ? (
        <PressableSurface accessibilityLabel={action} haptic="selection" onPress={onAction} style={styles.actionButton}>
          <Text style={styles.action}>{action}</Text>
        </PressableSurface>
      ) : null}
    </View>
  );
}
