import { StyleSheet, View } from "react-native";

/**
 * Ported verbatim from the Appliance Diagnostic Systems schedule at
 * 480991b7eb0036e4e85c37d3784b2de2ca97d10d. A multi-stop load uses the same
 * segmented bar the reference uses for a multi-visit job.
 */

const MAX_SEGMENTS = 5;
const GAP = 3;

interface SegmentBarProps {
  color: string;
  totalSegments: number;
  segmentIndex: number;
  width?: number;
  borderRadius?: number;
  style?: object;
}

/**
 * Vertical bar divided into N equal blocks with a small gap between each.
 *
 * - Active segment → full opacity; inactive segments → 28% opacity
 * - Single-visit jobs → plain solid bar (no change from before)
 * - Capped at 5 blocks
 *
 * The outer View must communicate its height to this component either via
 * alignItems:"stretch" on its flex parent, or by wrapping in a View with
 * explicit top/bottom (absolute positioning).  The inner blocks use flex:1
 * to share the available space.
 */
export function SegmentBar({
  color,
  totalSegments,
  segmentIndex,
  width = 3,
  borderRadius = 2,
  style,
}: SegmentBarProps) {
  const count = Math.min(Math.max(totalSegments, 1), MAX_SEGMENTS);
  const activeIdx = Math.min(Math.max(segmentIndex, 0), count - 1);

  if (count <= 1) {
    return (
      <View
        style={[
          styles.solidBar,
          { width, borderRadius, backgroundColor: color },
          style,
        ]}
      />
    );
  }

  return (
    <View style={[styles.container, { width }, style]}>
      {Array.from({ length: count }, (_, i) => (
        <View
          key={i}
          style={[
            styles.block,
            {
              backgroundColor: color,
              opacity: i === activeIdx ? 1 : 0.28,
              borderRadius,
              marginBottom: i < count - 1 ? GAP : 0,
            },
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  solidBar: {
    alignSelf: "stretch",
  },
  container: {
    alignSelf: "stretch",
    flexDirection: "column",
  },
  block: {
    flex: 1,
    width: "100%",
  },
});
