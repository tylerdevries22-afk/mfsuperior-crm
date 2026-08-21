import type { ReactElement } from "react";
import {
  FlatList,
  type ListRenderItem,
  type StyleProp,
  type ViewStyle,
} from "react-native";

import { SPACE } from "../../theme";

export type HorizontalCarouselProps<Item> = {
  data: readonly Item[];
  renderItem: ListRenderItem<Item>;
  keyExtractor: (item: Item, index: number) => string;
  accessibilityLabel: string;
  itemWidth?: number;
  contentContainerStyle?: StyleProp<ViewStyle>;
  testID?: string;
};

/**
 * Horizontal discovery rail matching the carousels at Appliance Diagnostic
 * Systems commit 480991b7eb0036e4e85c37d3784b2de2ca97d10d: 10pt item gap,
 * hidden indicator, and deterministic snap geometry when itemWidth is set.
 */
export function HorizontalCarousel<Item>({
  data,
  renderItem,
  keyExtractor,
  accessibilityLabel,
  itemWidth,
  contentContainerStyle,
  testID,
}: HorizontalCarouselProps<Item>): ReactElement {
  return (
    <FlatList
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="list"
      contentContainerStyle={[carouselContent, contentContainerStyle]}
      data={data}
      decelerationRate={itemWidth ? "fast" : "normal"}
      horizontal
      keyExtractor={keyExtractor}
      renderItem={renderItem}
      showsHorizontalScrollIndicator={false}
      snapToAlignment={itemWidth ? "start" : undefined}
      snapToInterval={itemWidth ? itemWidth + SPACE.sm : undefined}
      testID={testID}
    />
  );
}

const carouselContent: ViewStyle = { alignItems: "center", gap: SPACE.sm };
