import Feather from "@expo/vector-icons/Feather";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMemo, useState, type ReactNode } from "react";
import { Image, Pressable, StyleSheet, Text, TextInput, View, type ImageSourcePropType } from "react-native";
import { DriverAvatar } from "@/components/operations";
import { Button, Header, Screen } from "@/components/ui";
import { useOperations } from "@/store";
import { RADIUS, SPACE, TYPO, useTheme } from "@/theme";

const PRICES = [75, 100, 125, 150, 175, 200, "Custom"] as const;

export default function JobAssignmentScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const theme = useTheme();
  const { actions, shipments, state } = useOperations();
  const shipment = shipments.find((item) => item.id === id);
  const vehicles = useMemo(() => state.vehicles.filter((item) => item.status === "active"), [state.vehicles]);
  const drivers = useMemo(() => [...state.drivers].sort((a, b) => rank(a.status) - rank(b.status)), [state.drivers]);
  const [vehicleId, setVehicleId] = useState(vehicles[0]?.id);
  const [driverId, setDriverId] = useState(drivers.find((driver) => driver.status === "available")?.id);
  const [price, setPrice] = useState<(typeof PRICES)[number]>(100);
  const [customPrice, setCustomPrice] = useState("");
  const [saving, setSaving] = useState(false);
  const submit = async () => {
    if (!shipment || !driverId || !vehicleId) return;
    setSaving(true);
    let ready = shipment.status !== "tendered" || await actions.respondToTender(shipment.id, "accepted");
    if (ready) ready = await actions.assignShipment(shipment.id, driverId);
    if (ready) ready = await actions.assignVehicle(vehicleId, driverId);
    setSaving(false);
    if (ready) router.replace("/(tabs)");
  };
  return <View style={[styles.fill, { backgroundColor: theme.background }]}><Header centered onBack={() => router.back()} showBack subtitle={shipment?.loadNumber ?? "Load assignment"} title="Build driver offer" /><Screen safeEdges={["left", "right", "bottom"]} scroll contentContainerStyle={styles.content}>
    <Text style={[styles.intro, { color: theme.textSecondary }]}>Select fleet capacity, driver pay, and a live-available driver. The driver receives an offer and must accept it.</Text>
    <Section title="1 · Select vehicle">{vehicles.map((vehicle) => <Choice active={vehicle.id === vehicleId} key={vehicle.id} onPress={() => setVehicleId(vehicle.id)}><Image source={vehicleImage(vehicle.type)} style={styles.vehicleImage} /><View style={styles.grow}><Text style={[styles.choiceTitle, { color: theme.text }]}>{vehicle.unitNumber} · {vehicle.year} {vehicle.make} {vehicle.model}</Text><Text style={[styles.choiceMeta, { color: theme.textMuted }]}>{vehicle.type} · {vehicle.plateState} {vehicle.plateNumber}</Text></View><Check active={vehicle.id === vehicleId} /></Choice>)}</Section>
    <Section title="2 · Set job price"><View style={styles.priceGrid}>{PRICES.map((amount) => <Pressable key={String(amount)} onPress={() => setPrice(amount)} style={[styles.price, { borderColor: amount === price ? theme.primaryLight : theme.border, backgroundColor: amount === price ? theme.primaryMuted : theme.surface }]}><Text style={[styles.priceText, { color: amount === price ? theme.primaryLight : theme.text }]}>{typeof amount === "number" ? `$${amount}` : amount}</Text></Pressable>)}</View>{price === "Custom" ? <TextInput accessibilityLabel="Custom job price" keyboardType="decimal-pad" onChangeText={setCustomPrice} placeholder="Enter custom amount" placeholderTextColor={theme.textMuted} style={[styles.input, { borderColor: theme.border, color: theme.text }]} value={customPrice} /> : null}</Section>
    <Section title="3 · Select available driver">{drivers.map((driver) => { const available = driver.status === "available"; return <Choice active={driver.id === driverId} disabled={!available} key={driver.id} onPress={() => setDriverId(driver.id)}><DriverAvatar driver={driver} size={42} /><View style={styles.grow}><Text style={[styles.choiceTitle, { color: theme.text }]}>{driver.firstName} {driver.lastName}</Text><View style={styles.liveRow}><View style={[styles.liveDot, { backgroundColor: available ? theme.success : theme.warning }]} /><Text style={[styles.choiceMeta, { color: available ? theme.success : theme.textMuted }]}>{available ? "Available now" : driver.status.replace("_", " ")}</Text></View></View><Check active={driver.id === driverId} /></Choice>; })}</Section>
    <Button disabled={!driverId || !vehicleId || (price === "Custom" && !Number(customPrice))} fullWidth loading={saving} onPress={() => void submit()} title={`Send $${price === "Custom" ? customPrice || "—" : price} offer`} />
  </Screen></View>;
}

function Section({ title, children }: { title: string; children: ReactNode }) { const theme = useTheme(); return <View style={styles.section}><Text style={[styles.sectionTitle, { color: theme.text }]}>{title}</Text>{children}</View>; }
function Choice({ active, children, disabled, onPress }: { active: boolean; children: ReactNode; disabled?: boolean; onPress: () => void }) { const theme = useTheme(); return <Pressable accessibilityRole="radio" accessibilityState={{ checked: active, disabled }} disabled={disabled} onPress={onPress} style={[styles.choice, { backgroundColor: theme.surface, borderColor: active ? theme.primaryLight : theme.border }, disabled && styles.disabled]}>{children}</Pressable>; }
function Check({ active }: { active: boolean }) { const theme = useTheme(); return <Feather color={active ? theme.primaryLight : theme.textMuted} name={active ? "check-circle" : "circle"} size={20} />; }
function rank(status: string) { return status === "available" ? 0 : status === "on_duty" ? 1 : 2; }
function vehicleImage(type: string): ImageSourcePropType { return type === "trailer" ? require("@/assets/freight/equipment-dry-van.webp") as ImageSourcePropType : require("@/assets/freight/customer-hero-truck.webp") as ImageSourcePropType; }

const styles = StyleSheet.create({ choice: { alignItems: "center", borderRadius: RADIUS.md, borderWidth: 1, flexDirection: "row", gap: SPACE.sm, minHeight: 70, padding: SPACE.sm }, choiceMeta: { ...TYPO.caption, textTransform: "capitalize" }, choiceTitle: { ...TYPO.rowTitle }, content: { gap: SPACE.lg, paddingBottom: 80 }, disabled: { opacity: 0.48 }, fill: { flex: 1 }, grow: { flex: 1, gap: 3 }, input: { ...TYPO.body, borderRadius: RADIUS.md, borderWidth: 1, minHeight: 50, paddingHorizontal: SPACE.md }, intro: { ...TYPO.body }, liveDot: { borderRadius: 4, height: 8, width: 8 }, liveRow: { alignItems: "center", flexDirection: "row", gap: 6 }, price: { alignItems: "center", borderRadius: RADIUS.pill, borderWidth: 1, minWidth: 74, paddingHorizontal: SPACE.md, paddingVertical: SPACE.sm }, priceGrid: { flexDirection: "row", flexWrap: "wrap", gap: SPACE.sm }, priceText: { ...TYPO.captionStrong }, section: { gap: SPACE.sm }, sectionTitle: { ...TYPO.heading }, vehicleImage: { borderRadius: RADIUS.sm, height: 48, width: 66 } });
