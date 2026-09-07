import { agendaListStyles } from "./_styles/agendaList";
import { chromeStyles } from "./_styles/chrome";
import { dayTimelineStyles } from "./_styles/dayTimeline";
import { filterModalStyles } from "./_styles/filterModal";
import { newJobFormStyles } from "./_styles/newJobForm";
import { pickerStyles } from "./_styles/pickers";

/**
 * Ported verbatim from the Appliance Diagnostic Systems schedule at
 * 480991b7eb0036e4e85c37d3784b2de2ca97d10d so the two schedules share one
 * geometry. Only the token import changes: MF exposes the same reference
 * palette through `@/theme` rather than `@/constants/theme`.
 *
 * Appliance-specific style names are kept (`cardApplianceStack`,
 * `dayBlockApplianceImage`) because they are the reference's names; the
 * freight screens fill them with equipment artwork instead.
 *
 * The sheet is assembled here from one `StyleSheet.create` per feature area in
 * `./_styles`. The flat, single-namespace shape is deliberate: it is the shape
 * the reference exposes and the one every screen in this folder consumes, so
 * the split stays an authoring detail rather than a change consumers can see.
 * Keys are unique across the parts, so no part shadows another.
 */
export const styles = {
  ...chromeStyles,
  ...agendaListStyles,
  ...dayTimelineStyles,
  ...filterModalStyles,
  ...newJobFormStyles,
  ...pickerStyles,
};
