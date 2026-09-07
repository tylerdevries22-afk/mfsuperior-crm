import { Text, View } from "react-native";

import { SegmentedControl, TextField } from "@/components/ui";
import type { Shipment } from "@/domain/types";
import type { FreightRequestLocationDraft } from "@/lib/tab-workspaces";
import { useTheme } from "@/theme";

import { styles } from "../styles";

export const EMPTY_LOCATION: FreightRequestLocationDraft = {
  addressLine1: "",
  city: "",
  state: "",
  postalCode: "",
};

export function RelatedShipmentField({ shipments, value, onChange }: {
  readonly shipments: readonly Shipment[];
  readonly value: string;
  readonly onChange: (value: string) => void;
}) {
  const theme = useTheme();
  const options = [
    { label: "No load", value: "none" },
    ...shipments.slice(0, 3).map((shipment) => ({ label: shipment.loadNumber, value: shipment.id })),
  ];
  return (
    <View style={styles.fieldGroup}>
      <Text style={[styles.fieldLabel, { color: theme.text }]}>Related shipment</Text>
      <SegmentedControl accessibilityLabel="Related shipment" onChange={onChange} options={options} value={value} />
      <Text style={[styles.helper, { color: theme.textSecondary }]}>Optional. Link the request to an accessible shipment when useful.</Text>
    </View>
  );
}

export function LocationFields({ error, label, onChange, value }: {
  readonly error?: string;
  readonly label: "Pickup" | "Delivery";
  readonly onChange: (value: FreightRequestLocationDraft) => void;
  readonly value: FreightRequestLocationDraft;
}) {
  const theme = useTheme();
  return (
    <View style={styles.fieldGroup}>
      <Text style={[styles.fieldLabel, { color: theme.text }]}>{label} address</Text>
      <TextField
        label={`${label} street`}
        maxLength={200}
        onChangeText={(addressLine1) => onChange({ ...value, addressLine1 })}
        placeholder="1200 Freight Way"
        value={value.addressLine1}
      />
      <TextField
        label={`${label} city`}
        maxLength={100}
        onChangeText={(city) => onChange({ ...value, city })}
        placeholder="Denver"
        value={value.city}
      />
      <View style={styles.locationRow}>
        <View style={styles.grow}>
          <TextField
            autoCapitalize="characters"
            label="State"
            maxLength={2}
            onChangeText={(state) => onChange({ ...value, state })}
            placeholder="CO"
            value={value.state}
          />
        </View>
        <View style={styles.grow}>
          <TextField
            keyboardType="number-pad"
            label="ZIP"
            maxLength={10}
            onChangeText={(postalCode) => onChange({ ...value, postalCode })}
            placeholder="80202"
            value={value.postalCode}
          />
        </View>
      </View>
      {error ? <Text accessibilityRole="alert" style={[styles.helper, { color: theme.danger }]}>{error}</Text> : null}
    </View>
  );
}
