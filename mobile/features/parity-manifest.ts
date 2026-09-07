/**
 * Machine-readable route and component parity contract for Appliance
 * Diagnostic Systems commit 480991b7eb0036e4e85c37d3784b2de2ca97d10d.
 *
 * Provider-neutral marketplace routes are intentional. Named freight
 * partners belong only in Profile > Integrations and never own product IA.
 *
 * The pinned routes, draft rows, vocabulary, and hash live under `./parity/`;
 * this module composes them into the frozen manifest and its lookup.
 */
import { PARITY_DRAFTS } from "./parity/drafts";
import { componentHashFor } from "./parity/hash";
import { REFERENCE_COMMIT } from "./parity/reference-routes";
import type { ReferenceRoute } from "./parity/reference-routes";
import type { ParityMapping } from "./parity/types";

export { REFERENCE_COMMIT, REFERENCE_ROUTES } from "./parity/reference-routes";
export type { ReferenceRoute } from "./parity/reference-routes";
export type {
  ComponentFamily,
  ParityMapping,
  ParityRole,
  ParityState,
} from "./parity/types";
export { PARITY_STATES } from "./parity/vocabulary";
export { componentHashFor } from "./parity/hash";
export { NOT_PORTED_REASON, NOT_PORTED_ROUTES } from "./parity/not-ported";

export const PARITY_MANIFEST: readonly ParityMapping[] = Object.freeze(
  PARITY_DRAFTS.map((draft) => {
    const mappingWithoutHash = {
      ...draft,
      referenceCommit: REFERENCE_COMMIT,
      roles: Object.freeze([...draft.roles]),
      states: Object.freeze([...draft.states]),
      components: Object.freeze([...draft.components]),
    } as const;
    return Object.freeze({
      ...mappingWithoutHash,
      componentHash: componentHashFor(mappingWithoutHash),
    });
  }),
);

/** Look up a single pinned-reference route without accepting generic slugs. */
export function getParityMapping(referenceRoute: ReferenceRoute): ParityMapping {
  const mapping = PARITY_MANIFEST.find((candidate) => candidate.referenceRoute === referenceRoute);
  if (!mapping) throw new RangeError(`Missing parity mapping for ${referenceRoute}`);
  return mapping;
}
