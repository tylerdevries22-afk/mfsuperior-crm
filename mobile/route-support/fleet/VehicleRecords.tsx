import { Card, ListRow, SectionHeader, StatusBadge } from "@/components/ui";
import { DOCUMENT_KIND_LABELS, bucketFor, daysUntil, describeRemaining } from "@/route-support/licensing/utils";
import { MAINTENANCE_SEVERITY_LABELS, MAINTENANCE_STATUS_LABELS } from "@/route-support/maintenance/utils";
import { Text } from "react-native";
import { styles } from "./detailStyles";
import type { VehicleDetailModel } from "./useVehicleDetail";
export function VehicleRecords({ model }: { readonly model: VehicleDetailModel }) {
  const { theme, router, orders, documents } = model;
  return <>
        <SectionHeader
          action="Open shop"
          onAction={() => router.push("/maintenance")}
          title="Work orders"
        />
        {orders.length === 0 ? (
          <Card variant="tinted">
            <Text style={[styles.emptyNote, { color: theme.textSecondary }]}>
              No work orders on this unit.
            </Text>
          </Card>
        ) : (
          <Card padding="none">
            {orders.map((order, index) => (
              <ListRow
                isLast={index === orders.length - 1}
                key={order.id}
                onPress={() => router.push({
                  params: { id: order.id },
                  pathname: "/maintenance/[id]",
                })}
                subtitle={`${MAINTENANCE_SEVERITY_LABELS[order.severity]} · opened ${new Date(order.openedAt).toLocaleDateString()}`}
                title={order.summary}
                trailing={<StatusBadge size="sm" status={MAINTENANCE_STATUS_LABELS[order.status]} />}
              />
            ))}
          </Card>
        )}

        <SectionHeader
          action="All documents"
          onAction={() => router.push("/licensing")}
          title="Registration & inspection"
        />
        {documents.length === 0 ? (
          <Card variant="tinted">
            <Text style={[styles.emptyNote, { color: theme.textSecondary }]}>
              No documents recorded for this unit.
            </Text>
          </Card>
        ) : (
          <Card padding="none">
            {documents.map((document, index) => {
              const remaining = daysUntil(document.expiresOn);
              const bucket = bucketFor(remaining);
              return (
                <ListRow
                  isLast={index === documents.length - 1}
                  key={document.id}
                  subtitle={document.identifier}
                  title={DOCUMENT_KIND_LABELS[document.kind]}
                  trailing={
                    <Text
                      style={[
                        styles.expiry,
                        {
                          color: bucket === "expired"
                            ? theme.danger
                            : bucket === "urgent" ? theme.warning : theme.textMuted,
                        },
                      ]}
                    >
                      {describeRemaining(remaining)}
                    </Text>
                  }
                />
              );
            })}
          </Card>
        )}

  </>;
}
