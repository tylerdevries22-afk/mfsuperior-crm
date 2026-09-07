/**
 * Stable, dependency-free hashing of a route's visual-component contract.
 */

import type { ParityHashInput } from "./types";

/** Stable FNV-1a hash of the route's visual-component contract. */
export function componentHashFor(input: ParityHashInput): `fnv1a32:${string}` {
  const canonical = JSON.stringify({
    components: [...input.components].sort(),
    mfRoute: input.mfRoute,
    referenceCommit: input.referenceCommit,
    referenceRoute: input.referenceRoute,
    roles: [...input.roles].sort(),
    states: [...input.states].sort(),
  });
  let hash = 0x811c9dc5;
  for (let index = 0; index < canonical.length; index += 1) {
    hash ^= canonical.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return `fnv1a32:${(hash >>> 0).toString(16).padStart(8, "0")}`;
}
