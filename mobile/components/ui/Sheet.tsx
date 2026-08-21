import type { BottomSheetProps } from "./Overlay";
import { BottomSheet } from "./Overlay";

export type SheetProps = BottomSheetProps;

/**
 * Named sheet surface matching Appliance Diagnostic Systems commit
 * 480991b7eb0036e4e85c37d3784b2de2ca97d10d. This component preserves the
 * route-facing `Sheet` API while `BottomSheet` remains available to MF code.
 */
export function Sheet(props: SheetProps) {
  return <BottomSheet {...props} />;
}
