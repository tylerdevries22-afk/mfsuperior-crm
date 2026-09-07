/**
 * Composition root for the offline mutation queue. Persistence, validation,
 * and retry scheduling live in the sibling modules below; this file pins the
 * public surface so consumers keep a single stable import path.
 */
export { OfflineMutationQueue } from "./OfflineMutationQueue";
export type { OfflineMutationQueueOptions } from "./OfflineMutationQueue";
export { deserializeOfflineQueue } from "./queue-serialization";
