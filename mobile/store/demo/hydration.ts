import { OperationsDomainError, toOperationsFailure } from "../../domain/errors";
import {
  anchorDemoStateTo,
  createDemoOperationsState,
  reanchorDemoState,
} from "../../domain/fixtures";
import type { HydrationResult } from "../../domain/repository";
import type { DemoOperationsState } from "../../domain/types";
import type { PersistenceAdapter } from "../persistence";
import {
  deserializeDemoOperationsState,
  serializeDemoOperationsState,
} from "../stateSchema";

/**
 * The fixture timeline is anchored onto the current day so a long-lived demo
 * never drifts entirely into the past. Anchoring reads the injected clock, so
 * a test pinning the clock to the fixture anchor sees the canonical data.
 */
export function freshDemoState(clock: () => string): DemoOperationsState {
  return anchorDemoStateTo(createDemoOperationsState(), new Date(clock()));
}

/**
 * Reads persisted state, falling back to a fresh fixture whenever the stored
 * copy cannot be trusted. The returned state is identity-equal to `current`
 * only when nothing was restored, which is how the caller knows there is no
 * change to publish to its listeners.
 */
export async function hydrateDemoState(
  current: DemoOperationsState,
  persistence: PersistenceAdapter,
  clock: () => string,
): Promise<HydrationResult> {
  try {
    const serialized = await persistence.read();
    if (serialized === null) {
      await persistence.write(serializeDemoOperationsState(current));
      return { state: current, recoveryFailure: null };
    }

    // Restored state carries whatever day it was last anchored to, so it
    // is moved onto today before anyone reads it.
    return {
      state: reanchorDemoState(deserializeDemoOperationsState(serialized), new Date(clock())),
      recoveryFailure: null,
    };
  } catch (error: unknown) {
    const failure = toOperationsFailure(error);
    const fallbackState = freshDemoState(clock);

    if (
      !(error instanceof OperationsDomainError) ||
      error.code !== "CORRUPT_PERSISTED_STATE"
    ) {
      return { state: fallbackState, recoveryFailure: failure };
    }

    try {
      await persistence.write(serializeDemoOperationsState(fallbackState));
    } catch (persistenceError: unknown) {
      return {
        state: fallbackState,
        recoveryFailure: toOperationsFailure(persistenceError),
      };
    }

    return { state: fallbackState, recoveryFailure: failure };
  }
}
