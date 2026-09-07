import { useMemo } from "react";

import { createOperationsActions } from "./provider/actions";
import { OperationsContext } from "./provider/context";
import { buildOperationsContextValue } from "./provider/selectors";
import type {
  OperationsActions,
  OperationsContextValue,
  OperationsProviderProps,
} from "./provider/types";
import { useOperationsState } from "./provider/useOperationsState";
import { useVehicleTransferNotifications } from "./provider/useVehicleTransferNotifications";
import { createOperationsRepositoryFromEnvironment } from "./repositoryFactory";

export type {
  OperationsActions,
  OperationsContextValue,
  OperationsProviderProps,
} from "./provider/types";
export { useOperations, useOptionalOperations } from "./provider/context";

const defaultRepository = createOperationsRepositoryFromEnvironment();

export function OperationsProvider({
  children,
  repository = defaultRepository,
}: OperationsProviderProps) {
  const { state, isHydrated, error, setError } = useOperationsState(repository);

  useVehicleTransferNotifications(repository, state, isHydrated);

  const actions = useMemo<OperationsActions>(
    () => createOperationsActions(repository, setError),
    [repository, setError],
  );

  const value = useMemo<OperationsContextValue>(() => buildOperationsContextValue({
    state,
    isHydrated,
    isDemo: repository.mode === "demo",
    error,
    actions,
  }), [actions, error, isHydrated, repository.mode, state]);

  return <OperationsContext.Provider value={value}>{children}</OperationsContext.Provider>;
}
