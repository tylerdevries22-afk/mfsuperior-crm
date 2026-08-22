import Ionicons from "@expo/vector-icons/Ionicons";
import { useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";

import {
  Badge,
  BottomSheet,
  Button,
  Card,
  EmptyState,
  Header,
  ListRow,
  Screen,
  SectionHeader,
  SegmentedControl,
  StatTile,
  StatusBadge,
  TextArea,
  TextField,
} from "@/components/ui";
import type { CustomerRequest, CustomerRequestType, Shipment } from "@/domain/types";
import {
  isCustomerRequestDraftValid,
  validateCustomerRequestDraft,
  type CustomerRequestValidation,
  type FreightRequestLocationDraft,
} from "@/lib/tab-workspaces";
import { useOperations } from "@/store";
import { ICON, SPACE, TYPO, useTheme } from "@/theme";

const REQUEST_TYPES = [
  { label: "Quote", value: "quote" },
  { label: "Pickup", value: "pickup" },
  { label: "Delivery", value: "delivery" },
  { label: "Exception", value: "exception" },
] as const;

function RelatedShipmentField({ shipments, value, onChange }: {
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

const EMPTY_LOCATION: FreightRequestLocationDraft = {
  addressLine1: "",
  city: "",
  state: "",
  postalCode: "",
};

function LocationFields({ error, label, onChange, value }: {
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

function RequestForm({ onDone }: { readonly onDone: () => void }) {
  const theme = useTheme();
  const { actions, currentAccount, shipments, state } = useOperations();
  const [type, setType] = useState<CustomerRequestType>("quote");
  const [subject, setSubject] = useState("");
  const [details, setDetails] = useState("");
  const [shipmentId, setShipmentId] = useState("none");
  const [origin, setOrigin] = useState<FreightRequestLocationDraft>(EMPTY_LOCATION);
  const [destination, setDestination] = useState<FreightRequestLocationDraft>(EMPTY_LOCATION);
  const [validation, setValidation] = useState<CustomerRequestValidation>({});
  const [submitFailure, setSubmitFailure] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const customerId = currentAccount?.customerId ?? state.customers[0]?.id;
  const customerShipments = shipments.filter((shipment) => shipment.customerId === customerId);

  async function submit(): Promise<void> {
    const result = validateCustomerRequestDraft({
      type,
      subject,
      details,
      shipmentId: shipmentId === "none" ? undefined : shipmentId,
      origin,
      destination,
    });
    setValidation(result);
    if (!isCustomerRequestDraftValid(result)) return;
    setSubmitting(true);
    setSubmitFailure(null);
    try {
      const saved = await actions.createCustomerRequest({
        type,
        subject: subject.trim(),
        details: details.trim(),
        shipmentId: shipmentId === "none" ? undefined : shipmentId,
        origin: trimLocation(origin),
        destination: trimLocation(destination),
      });
      if (saved) onDone();
      else setSubmitFailure("The request could not be saved. Review the details and try again.");
    } catch {
      setSubmitFailure("The request could not be saved safely.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <View style={styles.form}>
      <SegmentedControl accessibilityLabel="Request type" onChange={setType} options={REQUEST_TYPES} value={type} />
      <TextField error={validation.subject} label="Subject" maxLength={80} onChangeText={setSubject} placeholder="What do you need?" value={subject} />
      <TextArea error={validation.details} label="Operational details" maxLength={500} onChangeText={setDetails} placeholder="Include dates, locations, freight, and constraints." value={details} />
      <LocationFields error={validation.origin} label="Pickup" onChange={setOrigin} value={origin} />
      <LocationFields error={validation.destination} label="Delivery" onChange={setDestination} value={destination} />
      <RelatedShipmentField onChange={setShipmentId} shipments={customerShipments} value={shipmentId} />
      {submitFailure ? <Text accessibilityRole="alert" style={[styles.formError, { color: theme.danger }]}>{submitFailure}</Text> : null}
      <Button fullWidth loading={submitting} onPress={() => { void submit(); }} title="Submit request" />
    </View>
  );
}

function trimLocation(location: FreightRequestLocationDraft): FreightRequestLocationDraft {
  return {
    addressLine1: location.addressLine1.trim(),
    city: location.city.trim(),
    postalCode: location.postalCode.trim(),
    state: location.state.trim().toUpperCase(),
  };
}

function RequestsHero() {
  const theme = useTheme();
  return (
    <View style={styles.hero}>
      <Text style={[styles.eyebrow, { color: theme.primaryLight }]}>SERVICE DESK</Text>
      <Text style={[styles.title, { color: theme.text }]}>Tell us what needs to move</Text>
      <Text style={[styles.subtitle, { color: theme.textSecondary }]}>Create a detailed freight request and follow its review status from intake through scheduling.</Text>
    </View>
  );
}

function RequestStats({ requests }: { readonly requests: readonly CustomerRequest[] }) {
  return (
    <View style={styles.statGrid}>
      <StatTile label="Open" value={String(requests.filter(({ status }) => status !== "closed").length)} />
      <StatTile label="Scheduled" value={String(requests.filter(({ status }) => status === "scheduled").length)} />
      <StatTile label="Total" value={String(requests.length)} />
    </View>
  );
}

function SubmissionSuccess() {
  const theme = useTheme();
  return (
    <Card variant="tinted">
      <View accessibilityRole="alert" style={styles.successRow}>
        <Ionicons color={theme.success} name="checkmark-circle-outline" size={ICON.lg} />
        <View style={styles.grow}>
          <Text style={[styles.successTitle, { color: theme.text }]}>Request saved</Text>
          <Text style={[styles.successCopy, { color: theme.textSecondary }]}>The operations queue now includes your request.</Text>
        </View>
        <Badge label="Submitted" tone="success" />
      </View>
    </Card>
  );
}

function RequestHistory({ requests, onCreate }: { readonly requests: readonly CustomerRequest[]; readonly onCreate: () => void }) {
  return (
    <>
      <SectionHeader title="Request history" />
      {requests.length === 0 ? (
        <EmptyState actionLabel="Create request" description="Your submitted service requests will appear here." onAction={onCreate} title="No requests yet" />
      ) : (
        <Card padding="none">
          {requests.map((request, index) => (
            <ListRow isLast={index === requests.length - 1} key={request.id} meta={request.type.replaceAll("_", " ")} subtitle={request.details} title={request.subject} trailing={<StatusBadge size="sm" status={request.status} />} />
          ))}
        </Card>
      )}
    </>
  );
}

export default function CustomerRequestsScreen() {
  const theme = useTheme();
  const { currentAccount, customerRequests, state } = useOperations();
  const [formVisible, setFormVisible] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const customerId = currentAccount?.customerId ?? state.customers[0]?.id;
  const requests = customerRequests.filter((request) => request.customerId === customerId);

  function finishRequest(): void {
    setFormVisible(false);
    setSubmitted(true);
  }

  return (
    <View style={[styles.fill, { backgroundColor: theme.background }]}>
      <Header subtitle="Quotes, pickups, deliveries, and support" title="Requests" />
      <Screen safeEdges={["left", "right", "bottom"]} scroll contentContainerStyle={styles.content}>
        <RequestsHero />
        <RequestStats requests={requests} />
        {submitted ? <SubmissionSuccess /> : null}
        <Button
          fullWidth
          icon={<Ionicons color={theme.primaryForeground} name="add-circle-outline" size={ICON.md} />}
          onPress={() => { setSubmitted(false); setFormVisible(true); }}
          size="lg"
          title="New service request"
        />
        <RequestHistory onCreate={() => setFormVisible(true)} requests={requests} />
      </Screen>

      <BottomSheet onClose={() => setFormVisible(false)} title="New service request" visible={formVisible}>
        <ScrollView contentContainerStyle={styles.formScroll} keyboardShouldPersistTaps="handled">
          {formVisible ? <RequestForm onDone={finishRequest} /> : null}
        </ScrollView>
      </BottomSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { gap: SPACE.md, paddingBottom: SPACE.xxl },
  eyebrow: { ...TYPO.eyebrow },
  fieldGroup: { gap: SPACE.xs },
  fieldLabel: { ...TYPO.captionStrong },
  fill: { flex: 1 },
  form: { gap: SPACE.md, paddingBottom: SPACE.sm },
  formError: { ...TYPO.captionStrong },
  formScroll: { paddingBottom: SPACE.sm },
  grow: { flex: 1, minWidth: 0 },
  helper: { ...TYPO.subtitle },
  hero: { gap: SPACE.sm, paddingBottom: SPACE.sm },
  locationRow: { flexDirection: "row", gap: SPACE.sm },
  statGrid: { flexDirection: "row", flexWrap: "wrap", gap: SPACE.sm },
  subtitle: { ...TYPO.body, maxWidth: 560 },
  successCopy: { ...TYPO.caption, marginTop: SPACE.xxs },
  successRow: { alignItems: "center", flexDirection: "row", gap: SPACE.sm },
  successTitle: { ...TYPO.cardTitle },
  title: { ...TYPO.screenTitle },
});
