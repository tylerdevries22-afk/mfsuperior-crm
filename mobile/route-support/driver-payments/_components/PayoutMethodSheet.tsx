import Feather from "@expo/vector-icons/Feather";
import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { AnimatedButton, Sheet, SwitchRow, TextField } from "@/components/ui";
import type { PayoutMethod, PayoutMethodInput, PayoutRail } from "@/domain/types";
import { PAYOUT_RAIL_RULES } from "@/store/payoutMethodStore";
import { ICON, RADIUS, SPACE, TYPO, useTheme } from "@/theme";

import { presentationFor } from "../utils";

export interface PayoutMethodSheetProps {
  readonly rail: PayoutRail | null;
  readonly existing: PayoutMethod | null;
  readonly busy: boolean;
  readonly errorMessage: string | null;
  readonly onClose: () => void;
  readonly onSave: (input: PayoutMethodInput) => void;
  readonly onRemove: (methodId: string) => void;
}

export function PayoutMethodSheet({
  busy,
  errorMessage,
  existing,
  onClose,
  onRemove,
  onSave,
  rail,
}: PayoutMethodSheetProps) {
  const theme = useTheme();
  const [handle, setHandle] = useState("");
  const [makeDefault, setMakeDefault] = useState(false);

  useEffect(() => {
    setHandle(existing?.handle ?? "");
    setMakeDefault(existing?.isDefault ?? false);
  }, [existing, rail]);

  if (!rail) {
    return null;
  }

  const rules = PAYOUT_RAIL_RULES[rail];
  const presentation = presentationFor(rail);

  return (
    <Sheet
      footer={
        <View style={styles.footer}>
          <AnimatedButton
            accessibilityLabel={`Save ${rules.label} handle`}
            disabled={handle.trim().length === 0}
            fullWidth
            loading={busy}
            onPress={() => onSave({ handle, id: existing?.id, isDefault: makeDefault, rail })}
            title={existing ? "Update handle" : "Save handle"}
          />
          {existing ? (
            <AnimatedButton
              accessibilityLabel={`Remove ${rules.label} handle`}
              fullWidth
              onPress={() => onRemove(existing.id)}
              title="Remove"
              variant="ghost"
            />
          ) : null}
        </View>
      }
      onClose={onClose}
      title={rules.label}
      visible
    >
      <View style={styles.content}>
        <TextField
          accessibilityLabel={`${rules.label} handle`}
          autoCapitalize="none"
          autoCorrect={false}
          error={errorMessage ?? undefined}
          helperText={rules.hint}
          keyboardType={rail === "apple_cash" ? "phone-pad" : "default"}
          label="Handle"
          onChangeText={setHandle}
          placeholder={rules.placeholder}
          value={handle}
        />

        <SwitchRow
          description="Settlements default to this rail unless dispatch is told otherwise."
          label="Use as my default payout"
          onValueChange={setMakeDefault}
          value={makeDefault}
        />

        <View
          style={[
            styles.notice,
            { backgroundColor: theme.surfaceElevated, borderColor: theme.border },
          ]}
        >
          <Feather color={theme.info} name="shield" size={ICON.sm} />
          <Text style={[styles.noticeText, { color: theme.textSecondary }]}>
            Handles are kept in this device&apos;s keychain and are never shown to dispatch — a
            settlement records only which rail it went out on. MF Superior never asks for a card or
            bank account number, and this app moves no money.
          </Text>
        </View>

        <View style={styles.handoff}>
          <Feather color={theme.textMuted} name="external-link" size={ICON.xs} />
          <Text style={[styles.handoffText, { color: theme.textMuted }]}>
            {presentation.handoffNote}
          </Text>
        </View>
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  content: { gap: SPACE.md, paddingBottom: SPACE.sm },
  footer: { gap: SPACE.xs },
  handoff: { alignItems: "flex-start", flexDirection: "row", gap: SPACE.xs },
  handoffText: { ...TYPO.subtitle, flex: 1, lineHeight: 16 },
  notice: {
    alignItems: "flex-start",
    borderRadius: RADIUS.md,
    borderWidth: 1,
    flexDirection: "row",
    gap: SPACE.sm,
    padding: SPACE.md,
  },
  noticeText: { ...TYPO.caption, flex: 1 },
});
