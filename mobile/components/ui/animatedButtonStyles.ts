import { StyleSheet } from "react-native";

import { FONTS } from "../../theme";

export const styles = StyleSheet.create({
  fullWidth: { alignSelf: "stretch" },
  // SF ships its own optical tracking, so button labels take no extra
  // letter-spacing and no bevel text shadow.
  primaryText: { fontFamily: FONTS.semibold },
  variantText: { fontFamily: FONTS.semibold },
});
