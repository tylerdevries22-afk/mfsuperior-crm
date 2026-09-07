import { homeOverviewStyles } from "./homeOverviewStyles";
import { homeLoadStyles } from "./homeLoadStyles";
import { homeActivityStyles } from "./homeActivityStyles";

export { homeAdminStyles as adminS } from "./homeAdminStyles";

/** Shared home styles split by overview, load cards, and activity. */
export const s = {
  ...homeOverviewStyles,
  ...homeLoadStyles,
  ...homeActivityStyles,
};
