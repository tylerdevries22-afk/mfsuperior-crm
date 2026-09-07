import Feather from "@expo/vector-icons/Feather";
import { Text, View } from "react-native";

import { AnimatedButton, Card } from "@/components/ui";
import { useTheme } from "@/theme";

import { styles } from "../styles";

/** Demo-only generator that drops a fresh accepted load into the unassigned lane. */
export function DemoLoadCard({
  busy,
  onAdd,
}: {
  readonly busy: boolean;
  readonly onAdd: () => void;
}) {
  const theme = useTheme();
  return (
    <Card variant="tinted">
      <View style={styles.demoLoadCopy}>
        <Text style={[styles.demoLoadTitle, { color: theme.text }]}>Demo load generator</Text>
        <Text style={[styles.demoLoadDescription, { color: theme.textSecondary }]}>Add a realistic accepted load to the unassigned lane without contacting a carrier or partner.</Text>
      </View>
      <AnimatedButton
        accessibilityLabel="Add demo unassigned load"
        fullWidth
        icon={<Feather color={theme.primaryForeground} name="plus" size={16} />}
        loading={busy}
        onPress={onAdd}
        title="Add unassigned load"
      />
    </Card>
  );
}
