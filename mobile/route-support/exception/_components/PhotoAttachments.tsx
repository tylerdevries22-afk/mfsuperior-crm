import Ionicons from "@expo/vector-icons/Ionicons";
import { Image, Text, View } from "react-native";

import { Button, Card } from "@/components/ui";
import { ICON, useTheme } from "@/theme";

import { styles } from "../styles";

/** Up to three local photos; they never leave the device. */
export function PhotoAttachments({
  onAdd,
  onRemove,
  permissionError,
  uris,
}: {
  readonly onAdd: () => void;
  readonly onRemove: (uri: string) => void;
  readonly permissionError: string | null;
  readonly uris: readonly string[];
}) {
  const theme = useTheme();
  return (
    <Card title="Photos">
      <Text style={[styles.body, { color: theme.textSecondary }]}>Attach up to three local photos. They remain on this device.</Text>
      {uris.length ? (
        <View style={styles.attachmentGrid}>
          {uris.map((uri, index) => (
            <View key={uri} style={styles.attachment}>
              <Image accessibilityLabel={`Exception attachment ${index + 1}`} source={{ uri }} style={styles.attachmentImage} />
              <Button onPress={() => onRemove(uri)} size="sm" title="Remove" variant="ghost" />
            </View>
          ))}
        </View>
      ) : null}
      <Button disabled={uris.length >= 3} icon={<Ionicons color={theme.text} name="images-outline" size={ICON.md} />} onPress={onAdd} title="Choose photos" variant="secondary" />
      {permissionError ? <Text accessibilityRole="alert" style={[styles.errorText, { color: theme.danger }]}>{permissionError}</Text> : null}
    </Card>
  );
}
