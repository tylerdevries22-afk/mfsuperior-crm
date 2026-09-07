/**
 * The ordered parity drafts. Order is part of the contract: the manifest is
 * built by mapping this list in place.
 */

import { OPERATIONS_DRAFTS } from "./drafts-operations";
import { SHELL_DRAFTS } from "./drafts-shell";
import { WORKSPACE_DRAFTS } from "./drafts-workspace";
import type { ParityDraft } from "./types";

export const PARITY_DRAFTS = [
  ...SHELL_DRAFTS,
  ...OPERATIONS_DRAFTS,
  ...WORKSPACE_DRAFTS,
] as const satisfies readonly ParityDraft[];
