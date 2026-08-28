import type { ComponentProps } from "react";
import type Feather from "@expo/vector-icons/Feather";

export type FreightIconName = ComponentProps<typeof Feather>["name"];

export type FreightTone = "brand" | "success" | "warning" | "danger" | "info" | "neutral";

export interface FreightMetric {
  readonly label: string;
  readonly value: string;
  readonly detail?: string;
  readonly tone?: FreightTone;
}

export interface FreightRecord {
  readonly id: string;
  readonly title: string;
  readonly subtitle: string;
  readonly meta?: string;
  readonly status?: string;
  readonly tone?: FreightTone;
  readonly icon?: FreightIconName;
  readonly route?: string;
  /** Optional segment used by collection screens for functional tab filtering. */
  readonly segment?: string;
}

export interface FreightAction {
  readonly label: string;
  readonly icon: FreightIconName;
  readonly route?: string;
  readonly tone?: FreightTone;
}

export interface FreightCollectionSpec {
  readonly eyebrow: string;
  readonly title: string;
  readonly description: string;
  readonly metrics?: readonly FreightMetric[];
  readonly segments?: readonly string[];
  readonly records: readonly FreightRecord[];
  readonly primaryAction?: FreightAction;
  readonly emptyTitle?: string;
  readonly emptyDescription?: string;
}

export interface FreightDetailSpec {
  readonly eyebrow: string;
  readonly title: string;
  readonly subtitle: string;
  readonly status: string;
  readonly statusTone?: FreightTone;
  readonly metrics: readonly FreightMetric[];
  readonly timeline: readonly FreightRecord[];
  readonly actions?: readonly FreightAction[];
}

export interface FreightMarketplaceSpec {
  readonly eyebrow: string;
  readonly title: string;
  readonly description: string;
  readonly art: "capacity" | "equipment";
  readonly categories: readonly FreightRecord[];
  readonly featured: readonly FreightRecord[];
  readonly searchRoute: string;
  readonly cartRoute: string;
}

export interface FreightFormField {
  readonly key: string;
  readonly label: string;
  readonly placeholder: string;
  readonly multiline?: boolean;
}

export interface FreightFormSpec {
  readonly eyebrow: string;
  readonly title: string;
  readonly description: string;
  readonly fields: readonly FreightFormField[];
  readonly submitLabel: string;
  readonly successMessage: string;
}
