import type { Payout, PayoutMethod, PayoutMethodInput, PayoutRail } from "@/domain/types";
import {
  payoutHandoffUrl,
  sortPayouts,
  summarizeEarnings
} from "@/route-support/driver-payments/utils";
import { useOperations } from "@/store";
import { useTheme } from "@/theme";
import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import * as Linking from "expo-linking";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";

export function useDriverPaymentsScreen() {

  const router = useRouter();

  const theme = useTheme();

  const { actions, currentDriver, effectiveRole, payouts } = useOperations();

  const [methods, setMethods] = useState<readonly PayoutMethod[]>([]);

  const [editingRail, setEditingRail] = useState<PayoutRail | null>(null);

  const [openPayout, setOpenPayout] = useState<Payout | null>(null);

  const [busy, setBusy] = useState(false);

  const [saveError, setSaveError] = useState<string | null>(null);

  const [toast, setToast] = useState<string | null>(null);

  const isDriver = effectiveRole === "driver" && currentDriver !== null;

  const refreshMethods = useCallback(async () => {
    if (!isDriver) {
      return;
    }
    setMethods(await actions.listPayoutMethods());
  }, [actions, isDriver]);

  useEffect(() => {
    if (!isDriver) return;
    let active = true;
    void actions.listPayoutMethods().then((items) => {
      if (active) setMethods(items);
    }).catch(() => {
      if (active) setSaveError("Payout methods could not be loaded. Please try again.");
    });
    return () => { active = false; };
  }, [actions, isDriver]);

  // A confirmation that clears itself; a copied handle needs acknowledging,
  // not dismissing.
  useEffect(() => {
    if (!toast) {
      return undefined;
    }
    const timer = setTimeout(() => setToast(null), 2_200);
    return () => clearTimeout(timer);
  }, [toast]);

  const summary = useMemo(() => summarizeEarnings(payouts), [payouts]);

  const ordered = useMemo(() => sortPayouts(payouts), [payouts]);

  const onSave = useCallback(async (input: PayoutMethodInput) => {
    setBusy(true);
    setSaveError(null);
    const saved = await actions.savePayoutMethod(input);
    setBusy(false);
    if (!saved) {
      // The repository rejected the handle. Its message is already safe to
      // show, so surface it on the field rather than closing over the mistake.
      setSaveError("That handle is not valid for this app. Check the format and try again.");
      return;
    }
    await refreshMethods();
    setEditingRail(null);
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
  }, [actions, refreshMethods]);

  const onRemove = useCallback(async (methodId: string) => {
    setBusy(true);
    await actions.removePayoutMethod(methodId);
    setBusy(false);
    await refreshMethods();
    setEditingRail(null);
  }, [actions, refreshMethods]);

  const onSetDefault = useCallback(async (methodId: string) => {
    void Haptics.selectionAsync().catch(() => undefined);
    await actions.setDefaultPayoutMethod(methodId);
    await refreshMethods();
  }, [actions, refreshMethods]);

  const onCopy = useCallback(async (method: PayoutMethod) => {
    await Clipboard.setStringAsync(method.handle);
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
    setToast("Handle copied");
  }, []);

  const onOpenApp = useCallback(async (method: PayoutMethod) => {
    const url = payoutHandoffUrl(method.rail, method.handle);
    if (!url) {
      return;
    }
    const supported = await Linking.canOpenURL(url).catch(() => false);
    if (!supported) {
      setToast("That app is not installed on this device");
      return;
    }
    await Linking.openURL(url);
  }, []);
  return { router, theme, methods, editingRail, setEditingRail, openPayout, setOpenPayout, busy, saveError, setSaveError, toast, isDriver, summary, ordered, onSave, onRemove, onSetDefault, onCopy, onOpenApp };
}
