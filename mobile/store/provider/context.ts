import { createContext, useContext } from "react";

import type { OperationsContextValue } from "./types";

export const OperationsContext = createContext<OperationsContextValue | null>(null);

export function useOperations(): OperationsContextValue {
  const value = useContext(OperationsContext);
  if (!value) {
    throw new Error("useOperations must be used inside an OperationsProvider.");
  }
  return value;
}

/** For shared chrome that can also render in isolated previews and tests. */
export function useOptionalOperations(): OperationsContextValue | null {
  return useContext(OperationsContext);
}
