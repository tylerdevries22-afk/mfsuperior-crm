import { useEffect, useState, type Dispatch, type SetStateAction } from "react";

import { toOperationsFailure, type OperationsFailure } from "../../domain/errors";
import { createDemoOperationsState } from "../../domain/fixtures";
import type { OperationsRepository } from "../../domain/repository";
import type { DemoOperationsState } from "../../domain/types";

export interface OperationsStateHandle {
  readonly state: DemoOperationsState;
  readonly isHydrated: boolean;
  readonly error: OperationsFailure | null;
  readonly setError: Dispatch<SetStateAction<OperationsFailure | null>>;
}

/**
 * Owns the repository subscription and the one-shot hydration handshake.
 * A failed hydration still resolves the tree, on demo state, so the app
 * renders an error rather than hanging on a spinner.
 */
export function useOperationsState(repository: OperationsRepository): OperationsStateHandle {
  const [state, setState] = useState<DemoOperationsState>(() => repository.getState());
  const [isHydrated, setIsHydrated] = useState(false);
  const [error, setError] = useState<OperationsFailure | null>(null);

  useEffect(() => {
    let isActive = true;
    const unsubscribe = repository.subscribe((nextState) => {
      if (isActive) {
        setState(nextState);
      }
    });

    repository.hydrate().then(
      (result) => {
        if (!isActive) {
          return;
        }
        setState(result.state);
        setError(result.recoveryFailure);
        setIsHydrated(true);
      },
      (hydrationError: unknown) => {
        if (!isActive) {
          return;
        }
        setState(createDemoOperationsState());
        setError(toOperationsFailure(hydrationError));
        setIsHydrated(true);
      },
    );

    return () => {
      isActive = false;
      unsubscribe();
    };
  }, [repository]);

  return { state, isHydrated, error, setError };
}
