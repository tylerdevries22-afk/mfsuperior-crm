import { useRouter } from "expo-router";
import { StyleSheet, Text, View } from "react-native";

import { SimulationBanner, WorkspaceGrid, type WorkspaceAction } from "@/components/operations";
import { Card, Header, ListRow, Screen, SearchField, SectionHeader } from "@/components/ui";
import { useState } from "react";
import { SPACE, TYPO, useTheme } from "@/theme";

const DOCUMENTS = [
  { id: "target-check", title: "Target partner delivery checklist", subtitle: "Check-in, seal, status, and POD sequence", meta: "8 pages" },
  { id: "reefer", title: "Cold-chain response guide", subtitle: "Temperature alarms and escalation", meta: "6 pages" },
  { id: "securement", title: "Load securement field card", subtitle: "Inspection and en-route checks", meta: "4 pages" },
  { id: "edi", title: "EDI event reference", subtitle: "204, 990, 214, 210, and 997 meanings", meta: "12 pages" },
] as const;

export default function KnowledgeScreen() {
  const router = useRouter();
  const theme = useTheme();
  const [query, setQuery] = useState("");
  const normalized = query.trim().toLowerCase();
  const documents = DOCUMENTS.filter((document) => `${document.title} ${document.subtitle}`.toLowerCase().includes(normalized));
  const workspaces: readonly WorkspaceAction[] = [
    { key: "docs", label: "Operating documents", detail: "Permits and procedures", icon: "documents-outline", onPress: () => router.push({ pathname: "/feature/[slug]", params: { slug: "operating-documents" } }) },
    { key: "models", label: "Equipment models", detail: "Tractors, trailers, reefers", icon: "bus-outline", tone: "info", onPress: () => router.push({ pathname: "/feature/[slug]", params: { slug: "equipment-models" } }) },
    { key: "parts", label: "Fleet parts", detail: "Approved replacements", icon: "cog-outline", tone: "success", onPress: () => router.push({ pathname: "/feature/[slug]", params: { slug: "fleet-parts" } }) },
    { key: "edi", label: "EDI reference", detail: "Audit simulated events", icon: "git-network-outline", tone: "warning", onPress: () => router.push("/edi-audit") },
  ];

  return (
    <View style={[styles.fill, { backgroundColor: theme.background }]}>
      <Header centered onBack={() => router.back()} showBack title="Knowledge" />
      <Screen safeEdges={["left", "right", "bottom"]} scroll contentContainerStyle={styles.content}>
        <View style={styles.intro}>
          <Text style={[styles.eyebrow, { color: theme.primaryLight }]}>FIELD LIBRARY</Text>
          <Text style={[styles.title, { color: theme.text }]}>Answers for the road</Text>
          <Text style={[styles.body, { color: theme.textSecondary }]}>Find procedures, equipment references, and partner-specific checklists.</Text>
        </View>
        <SearchField onChangeText={setQuery} placeholder="Search operating documents" value={query} />
        <SimulationBanner message="The Target partner checklist is a prototype example, not an official Target operating document." />
        <SectionHeader title="Library workspaces" />
        <WorkspaceGrid actions={workspaces} />
        <SectionHeader title="Recommended" />
        <Card padding="none">
          {documents.map((document, index) => (
            <ListRow
              isLast={index === documents.length - 1}
              key={document.id}
              meta={document.meta}
              onPress={() => router.push({ pathname: "/feature/[slug]", params: { slug: "operating-documents" } })}
              subtitle={document.subtitle}
              title={document.title}
            />
          ))}
        </Card>
      </Screen>
    </View>
  );
}

const styles = StyleSheet.create({
  body: { ...TYPO.body },
  content: { gap: SPACE.md, paddingBottom: SPACE.xxl },
  eyebrow: { ...TYPO.eyebrow },
  fill: { flex: 1 },
  intro: { gap: SPACE.sm },
  title: { ...TYPO.screenTitle },
});
