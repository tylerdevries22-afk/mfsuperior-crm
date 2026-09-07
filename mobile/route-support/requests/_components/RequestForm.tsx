import { useState } from "react";
import { Text, View } from "react-native";

import { Button, SegmentedControl, TextArea, TextField } from "@/components/ui";
import type { CustomerRequestType } from "@/domain/types";
import {
  isCustomerRequestDraftValid,
  validateCustomerRequestDraft,
  type CustomerRequestValidation,
  type FreightRequestLocationDraft,
} from "@/lib/tab-workspaces";
import { useOperations } from "@/store";
import { useTheme } from "@/theme";

import { styles } from "../styles";
import { EMPTY_LOCATION, LocationFields, RelatedShipmentField } from "./RequestFormFields";

const REQUEST_TYPES = [
  { label: "Quote", value: "quote" },
  { label: "Pickup", value: "pickup" },
  { label: "Delivery", value: "delivery" },
  { label: "Exception", value: "exception" },
] as const;

export function RequestForm({ onDone }: { readonly onDone: () => void }) {
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
