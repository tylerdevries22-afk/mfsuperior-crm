import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { Badge, Button, Card, Header, PressableSurface, Screen, SectionHeader, TextArea, TextField } from "@/components/ui";
import type { EquipmentType } from "@/domain/types";
import { ICON, RADIUS, SPACE, TYPO, useTheme } from "@/theme";

const EQUIPMENT: readonly { value: EquipmentType; label: string; detail: string; icon: "cube-outline" | "snow-outline" | "layers-outline" }[] = [
  { value: "dry_van", label: "Dry van", detail: "General freight", icon: "cube-outline" },
  { value: "reefer", label: "Reefer", detail: "Temperature controlled", icon: "snow-outline" },
  { value: "flatbed", label: "Flatbed", detail: "Open-deck freight", icon: "layers-outline" },
];

export default function ConfigureScreen() {
  const router = useRouter();
  const theme = useTheme();
  const [equipmentType, setEquipmentType] = useState<EquipmentType>("dry_van");
  const [origin, setOrigin] = useState("");
  const [destination, setDestination] = useState("");
  const [commodity, setCommodity] = useState("");
  const [instructions, setInstructions] = useState("");
  const canContinue = useMemo(() => origin.trim().length >= 3 && destination.trim().length >= 3 && commodity.trim().length >= 2, [commodity, destination, origin]);

  return (
    <View style={[styles.fill, { backgroundColor: theme.background }]}>
      <Header centered onBack={() => router.back()} showBack subtitle="Step 1 of 2" title="Configure load" />
      <Screen keyboardAware safeEdges={["left", "right", "bottom"]} scroll contentContainerStyle={styles.content}>
        <View style={styles.intro}>
          <Text style={[styles.eyebrow, { color: theme.primaryLight }]}>NEW FREIGHT WORKFLOW</Text>
          <Text style={[styles.title, { color: theme.text }]}>Define the move</Text>
          <Text style={[styles.body, { color: theme.textSecondary }]}>Choose equipment and add the core lane details before arranging workflow milestones.</Text>
        </View>

        <SectionHeader title="Equipment" />
        <View style={styles.equipmentGrid}>
          {EQUIPMENT.map((equipment) => {
            const selected = equipment.value === equipmentType;
            return (
              <PressableSurface
                accessibilityLabel={`${equipment.label}, ${equipment.detail}`}
                accessibilityRole="radio"
                accessibilityState={{ checked: selected }}
                haptic="selection"
                key={equipment.value}
                onPress={() => setEquipmentType(equipment.value)}
                style={[
                  styles.equipmentCard,
                  { backgroundColor: selected ? theme.primaryMuted : theme.surface, borderColor: selected ? theme.primaryLight : theme.border },
                ]}
              >
                <Ionicons color={selected ? theme.primaryLight : theme.textMuted} name={equipment.icon} size={ICON.lg} />
                <Text style={[styles.equipmentLabel, { color: theme.text }]}>{equipment.label}</Text>
                <Text style={[styles.equipmentDetail, { color: theme.textSecondary }]}>{equipment.detail}</Text>
                {selected ? <Badge label="Selected" tone="brand" /> : null}
              </PressableSurface>
            );
          })}
        </View>

        <SectionHeader title="Lane details" />
        <Card>
          <View style={styles.form}>
            <TextField autoCapitalize="words" label="Origin" onChangeText={setOrigin} placeholder="City, state or facility" value={origin} />
            <TextField autoCapitalize="words" label="Destination" onChangeText={setDestination} placeholder="City, state or facility" value={destination} />
            <TextField autoCapitalize="sentences" label="Commodity" onChangeText={setCommodity} placeholder="General merchandise" value={commodity} />
            <TextArea label="Special instructions" onChangeText={setInstructions} placeholder="Appointments, temperature, securement…" value={instructions} />
          </View>
        </Card>

        <Button
          disabled={!canContinue}
          fullWidth
          icon={<Ionicons color={theme.primaryForeground} name="arrow-forward" size={ICON.md} />}
          iconPosition="right"
          onPress={() => router.push({
            pathname: "/workflow-builder",
            params: { equipmentType, origin: origin.trim(), destination: destination.trim(), commodity: commodity.trim(), instructions: instructions.trim() },
          })}
          title="Continue to workflow"
        />
      </Screen>
    </View>
  );
}

const styles = StyleSheet.create({
  body: { ...TYPO.body },
  content: { gap: SPACE.md, paddingBottom: SPACE.xxl },
  equipmentCard: { borderRadius: RADIUS.md, borderWidth: 1, flexBasis: "30%", flexGrow: 1, gap: SPACE.xs, minHeight: 154, padding: SPACE.md },
  equipmentDetail: { ...TYPO.caption },
  equipmentGrid: { flexDirection: "row", flexWrap: "wrap", gap: SPACE.sm },
  equipmentLabel: { ...TYPO.cardTitle },
  eyebrow: { ...TYPO.eyebrow },
  fill: { flex: 1 },
  form: { gap: SPACE.md },
  intro: { gap: SPACE.sm },
  title: { ...TYPO.screenTitle },
});
