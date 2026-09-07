import Ionicons from "@expo/vector-icons/Ionicons";
import { useState } from "react";
import { ScrollView, View } from "react-native";

import { BottomSheet, Button, Header, Screen } from "@/components/ui";
import { RequestForm } from "@/route-support/requests/_components/RequestForm";
import {
  RequestHistory,
  RequestStats,
  RequestsHero,
  SubmissionSuccess,
} from "@/route-support/requests/_components/RequestSections";
import { styles } from "@/route-support/requests/styles";
import { useOperations } from "@/store";
import { ICON, useTheme } from "@/theme";

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
