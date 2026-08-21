import Feather from "@expo/vector-icons/Feather";
import { useRouter } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View, type ImageSourcePropType } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AnimatedButton, Sheet } from "@/components/ui";
import { getAuthRuntimeMode, getProductionAuthService } from "@/features/auth/runtime-service";
import { toAuthFailure } from "@/lib/auth";
import { useOperations } from "@/store";
import { FONTS, RADIUS_LEGACY, SPACE, SPACING, TYPO, useTheme } from "@/theme";

type SheetMode = "sign-in" | "sign-up";
type Completion = "verify-email" | "pending-approval" | null;

const logo = require("@/assets/brand/mf-logo-mark.png") as ImageSourcePropType;

export default function LoginScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [mode, setMode] = useState<SheetMode>("sign-in");
  const [sheetVisible, setSheetVisible] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [completion, setCompletion] = useState<Completion>(null);
  const runtimeMode = getAuthRuntimeMode();

  const openSheet = (nextMode: SheetMode) => {
    setMode(nextMode);
    setError(null);
    setCompletion(null);
    setSheetVisible(true);
  };

  return <View style={[styles.container, { backgroundColor: theme.background, paddingBottom: insets.bottom + SPACE.lg }]}><View style={styles.center}><View style={[styles.logoFrame, { backgroundColor: theme.surface, borderColor: theme.border }]}><Image accessibilityLabel="MF Superior Products" source={logo} style={styles.logo} /></View><Text style={[styles.title, { color: theme.text }]}>MF Superior Products</Text><Text style={[styles.subtitle, { color: theme.textSecondary }]}>Freight capacity &amp; operations</Text>{runtimeMode === "demo" ? <View style={[styles.demoPill, { backgroundColor: theme.primaryMuted, borderColor: theme.tint.primary.medium }]}><View style={[styles.demoDot, { backgroundColor: theme.primaryLight }]} /><Text style={[styles.demoText, { color: theme.primaryLight }]}>DEMO WORKSPACE</Text></View> : null}</View><View style={styles.bottom}><AnimatedButton fullWidth icon={<Feather color={theme.primaryForeground} name="log-in" size={18} />} iconPosition="right" onPress={() => openSheet("sign-in")} size="lg" title="Sign In" /><View style={styles.divider}><View style={[styles.line, { backgroundColor: theme.border }]} /><Text style={[styles.or, { color: theme.textMuted }]}>or</Text><View style={[styles.line, { backgroundColor: theme.border }]} /></View><Pressable accessibilityRole="button" onPress={() => openSheet("sign-up")} style={({ pressed }) => [styles.createButton, { backgroundColor: theme.surfaceElevated, borderColor: theme.border }, pressed && styles.pressed]}><Feather color={theme.primaryLight} name="user-plus" size={18} /><Text style={[styles.createButtonText, { color: theme.text }]}>Create customer account</Text></Pressable><Text style={[styles.inviteNote, { color: theme.textMuted }]}>Admins and drivers join by invitation. Google Workspace connects from Profile after sign-in.</Text><Text style={[styles.terms, { color: theme.textMuted }]}>By continuing, you agree to our Terms of Service and Privacy Policy.</Text></View><AuthSheet busy={busy} completion={completion} email={email} error={error} fullName={fullName} mode={mode} onClose={() => setSheetVisible(false)} onEmail={setEmail} onError={setError} onFullName={setFullName} onMode={setMode} onPassword={setPassword} onSetBusy={setBusy} onSetCompletion={setCompletion} onShowPassword={() => setShowPassword((current) => !current)} password={password} showPassword={showPassword} visible={sheetVisible} /></View>;
}

interface AuthSheetProps {
  readonly busy: boolean;
  readonly completion: Completion;
  readonly email: string;
  readonly error: string | null;
  readonly fullName: string;
  readonly mode: SheetMode;
  readonly password: string;
  readonly showPassword: boolean;
  readonly visible: boolean;
  readonly onClose: () => void;
  readonly onEmail: (value: string) => void;
  readonly onError: (value: string | null) => void;
  readonly onFullName: (value: string) => void;
  readonly onMode: (value: SheetMode) => void;
  readonly onPassword: (value: string) => void;
  readonly onSetBusy: (value: boolean) => void;
  readonly onSetCompletion: (value: Completion) => void;
  readonly onShowPassword: () => void;
}

function AuthSheet(props: AuthSheetProps) {
  const theme = useTheme();
  const { accounts, actions } = useOperations();
  const router = useRouter();
  const isDemo = getAuthRuntimeMode() === "demo";

  const submit = async () => {
    props.onError(null);
    props.onSetBusy(true);
    try {
      if (props.mode === "sign-up") await signUpCustomer(props);
      else {
        const succeeded = await actions.signIn(props.email, props.password);
        if (!succeeded) throw new Error("The email or password is incorrect.");
        const service = getProductionAuthService();
        const identity = service ? await service.getCurrentIdentity() : null;
        if (identity?.role === "admin" && identity.mfa.status !== "verified") router.replace("/mfa");
      }
    } catch (caught: unknown) {
      props.onError(toAuthFailure(caught).message);
    } finally {
      props.onSetBusy(false);
    }
  };

  const resetPassword = async () => {
    const service = getProductionAuthService();
    if (!service) { props.onError("Password recovery requires a configured production account."); return; }
    props.onSetBusy(true);
    try { await service.requestPasswordReset(props.email); props.onSetCompletion("verify-email"); }
    catch (caught: unknown) { props.onError(toAuthFailure(caught).message); }
    finally { props.onSetBusy(false); }
  };

  return <Sheet onClose={props.onClose} testID="login-sheet" title={props.mode === "sign-in" ? "Welcome back" : "Create customer account"} visible={props.visible}><KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}><ScrollView contentContainerStyle={styles.sheetContent} keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>{props.completion ? <CompletionState completion={props.completion} email={props.email} /> : <><Image source={logo} style={styles.sheetLogo} />{props.mode === "sign-up" ? <AuthInput icon="user" label="Full name" onChangeText={props.onFullName} placeholder="Your name" value={props.fullName} /> : null}<AuthInput autoCapitalize="none" icon="mail" keyboardType="email-address" label="Email" onChangeText={(value) => { props.onEmail(value); props.onError(null); }} placeholder="name@company.com" value={props.email} /><AuthInput autoCapitalize="none" icon="lock" label="Password" onChangeText={(value) => { props.onPassword(value); props.onError(null); }} onEye={props.onShowPassword} placeholder="12 characters minimum" secureTextEntry={!props.showPassword} value={props.password} />{props.error ? <View accessibilityLiveRegion="polite" accessibilityRole="alert" style={[styles.errorBox, { backgroundColor: theme.dangerMuted }]}><Feather color={theme.danger} name="alert-circle" size={15} /><Text style={[styles.errorText, { color: theme.danger }]}>{props.error}</Text></View> : null}{props.mode === "sign-in" ? <Pressable accessibilityRole="button" disabled={props.busy} onPress={() => void resetPassword()} style={styles.forgot}><Text style={[styles.forgotText, { color: theme.primaryLight }]}>Forgot your password?</Text></Pressable> : null}<AnimatedButton disabled={!props.email.trim() || props.password.length < (isDemo ? 4 : 12)} fullWidth loading={props.busy} onPress={() => void submit()} size="lg" title={props.mode === "sign-in" ? "Sign In" : "Create Account"} />{isDemo && props.mode === "sign-in" ? <DemoAccess accounts={accounts} onEmail={props.onEmail} onPassword={props.onPassword} /> : null}<Pressable accessibilityRole="button" onPress={() => { props.onMode(props.mode === "sign-in" ? "sign-up" : "sign-in"); props.onError(null); }} style={styles.switch}><Text style={[styles.switchText, { color: theme.textSecondary }]}>{props.mode === "sign-in" ? "Don’t have an account? " : "Already have an account? "}<Text style={{ color: theme.primaryLight, fontFamily: FONTS.semibold }}>{props.mode === "sign-in" ? "Create one" : "Sign in"}</Text></Text></Pressable>{props.mode === "sign-up" ? <Text style={[styles.pendingNote, { color: theme.textMuted }]}>Customers can request access immediately. Shipment visibility begins only after an admin links your company.</Text> : null}</>}</ScrollView></KeyboardAvoidingView></Sheet>;
}

function AuthInput({ icon, label, onEye, ...inputProps }: { readonly icon: "user" | "mail" | "lock"; readonly label: string; readonly onEye?: () => void } & React.ComponentProps<typeof TextInput>) {
  const theme = useTheme();
  return <View style={styles.field}><Text style={[styles.inputLabel, { color: theme.textSecondary }]}>{label}</Text><View style={[styles.inputWrap, { backgroundColor: theme.surfaceElevated, borderColor: theme.border }]}><Feather color={theme.textMuted} name={icon} size={18} /><TextInput accessibilityLabel={label} placeholderTextColor={theme.textMuted} style={[styles.input, { color: theme.text }]} {...inputProps} />{onEye ? <Pressable accessibilityLabel="Toggle password visibility" accessibilityRole="button" hitSlop={8} onPress={onEye}><Feather color={theme.textMuted} name={inputProps.secureTextEntry ? "eye" : "eye-off"} size={18} /></Pressable> : null}</View></View>;
}

function DemoAccess({ accounts, onEmail, onPassword }: { readonly accounts: ReturnType<typeof useOperations>["accounts"]; readonly onEmail: (value: string) => void; readonly onPassword: (value: string) => void }) {
  const theme = useTheme();
  return <View style={styles.demoAccess}><View style={styles.demoLabelRow}><View style={[styles.line, { backgroundColor: theme.border }]} /><Text style={[styles.demoAccessLabel, { color: theme.textMuted }]}>DEMO ACCESS</Text><View style={[styles.line, { backgroundColor: theme.border }]} /></View><View style={styles.demoButtons}>{accounts.map((account) => <Pressable accessibilityRole="button" key={account.id} onPress={() => { onEmail(account.email); onPassword(account.demoPin ?? ""); }} style={({ pressed }) => [styles.demoButton, { backgroundColor: theme.surfaceElevated, borderColor: theme.border }, pressed && styles.pressed]}><Feather color={theme.primaryLight} name={account.role === "admin" ? "shield" : account.role === "driver" ? "truck" : "user"} size={14} /><Text style={[styles.demoButtonText, { color: theme.textSecondary }]}>{account.role}</Text></Pressable>)}</View></View>;
}

async function signUpCustomer(props: AuthSheetProps): Promise<void> {
  const service = getProductionAuthService();
  if (!service) throw new Error("Customer registration requires configured Supabase authentication.");
  if (!props.fullName.trim()) throw new Error("Enter your full name.");
  const result = await service.signUp(props.email, props.password);
  props.onSetCompletion(result.emailConfirmationRequired ? "verify-email" : "pending-approval");
}

function CompletionState({ completion, email }: { readonly completion: Exclude<Completion, null>; readonly email: string }) {
  const theme = useTheme();
  return <View style={styles.completion}><View style={[styles.completionIcon, { backgroundColor: theme.primaryMuted, borderColor: theme.tint.primary.medium }]}>{completion === "verify-email" ? <ActivityIndicator color={theme.primaryLight} /> : <Feather color={theme.success} name="check" size={28} />}</View><Text style={[styles.completionTitle, { color: theme.text }]}>{completion === "verify-email" ? "Check your email" : "Request received"}</Text><Text style={[styles.completionBody, { color: theme.textSecondary }]}>{completion === "verify-email" ? `We sent a secure link to ${email}. Open it on this device to verify your account.` : "An admin must link your customer company before shipments become visible. You can submit freight requests while access is pending."}</Text></View>;
}

const styles = StyleSheet.create({
  bottom: { gap: SPACING.md },
  center: { alignItems: "center", flex: 1, justifyContent: "center" },
  completion: { alignItems: "center", gap: SPACE.md, paddingBottom: SPACE.xl, paddingTop: SPACE.md },
  completionBody: { ...TYPO.body, lineHeight: 23, textAlign: "center" },
  completionIcon: { alignItems: "center", borderRadius: 36, borderWidth: 1, height: 72, justifyContent: "center", width: 72 },
  completionTitle: { ...TYPO.heading },
  container: { flex: 1, paddingHorizontal: SPACING.xl },
  createButton: { alignItems: "center", borderRadius: RADIUS_LEGACY.lg, borderWidth: 1, flexDirection: "row", gap: SPACE.sm, justifyContent: "center", minHeight: 54 },
  createButtonText: { ...TYPO.cardTitle, fontSize: 15 },
  demoAccess: { gap: SPACE.sm, marginTop: SPACE.sm },
  demoAccessLabel: { ...TYPO.metricLabel },
  demoButton: { alignItems: "center", borderRadius: RADIUS_LEGACY.md, borderWidth: 1, flex: 1, flexDirection: "row", gap: 5, justifyContent: "center", minHeight: 42 },
  demoButtons: { flexDirection: "row", gap: SPACE.xs },
  demoButtonText: { ...TYPO.captionStrong, textTransform: "capitalize" },
  demoDot: { borderRadius: 3, height: 6, width: 6 },
  demoLabelRow: { alignItems: "center", flexDirection: "row", gap: SPACE.sm },
  demoPill: { alignItems: "center", borderRadius: 13, borderWidth: 1, flexDirection: "row", gap: 6, marginTop: SPACE.lg, minHeight: 28, paddingHorizontal: 10 },
  demoText: { ...TYPO.metricLabel },
  divider: { alignItems: "center", flexDirection: "row", gap: SPACING.md },
  errorBox: { alignItems: "flex-start", borderRadius: RADIUS_LEGACY.sm, flexDirection: "row", gap: 8, padding: SPACE.md },
  errorText: { ...TYPO.captionStrong, flex: 1 },
  field: { gap: 6 },
  forgot: { alignSelf: "flex-end", minHeight: 44, justifyContent: "center" },
  forgotText: { ...TYPO.captionStrong },
  input: { ...TYPO.body, flex: 1, minHeight: 50, paddingVertical: 12 },
  inputLabel: { ...TYPO.captionStrong, marginLeft: 3 },
  inputWrap: { alignItems: "center", borderRadius: RADIUS_LEGACY.md, borderWidth: 1, flexDirection: "row", gap: SPACE.sm, minHeight: 54, paddingHorizontal: SPACE.md },
  inviteNote: { ...TYPO.caption, lineHeight: 18, textAlign: "center" },
  line: { flex: 1, height: 1 },
  logo: { height: 118, width: 118 },
  logoFrame: { alignItems: "center", borderRadius: 30, borderWidth: 1, height: 132, justifyContent: "center", marginBottom: SPACING.xl, overflow: "hidden", width: 132 },
  or: { ...TYPO.caption },
  pendingNote: { ...TYPO.caption, lineHeight: 18, textAlign: "center" },
  pressed: { opacity: 0.68, transform: [{ scale: 0.98 }] },
  sheetContent: { gap: SPACE.md, paddingBottom: SPACE.xl },
  sheetLogo: { alignSelf: "center", borderRadius: 14, height: 58, width: 58 },
  subtitle: { ...TYPO.body, textAlign: "center" },
  switch: { alignItems: "center", minHeight: 44, justifyContent: "center" },
  switchText: { ...TYPO.caption },
  terms: { ...TYPO.subtitle, lineHeight: 17, textAlign: "center" },
  title: { ...TYPO.largeTitle, fontSize: 31, lineHeight: 37, textAlign: "center" },
});
