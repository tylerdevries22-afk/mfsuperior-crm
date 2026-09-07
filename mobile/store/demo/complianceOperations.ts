import { OperationsDomainError } from "../../domain/errors";
import type { ComplianceDocument, ComplianceDocumentInput } from "../../domain/types";
import { getSessionContext, requireRole, type DemoWriteContext, type StateUpdate } from "./context";
import { findDriver, findVehicle } from "./lookups";
import { normalizedIsoDateTime } from "./validation";

export function upsertComplianceDocument(
  { state, occurredAt, nextId }: DemoWriteContext,
  input: ComplianceDocumentInput,
): StateUpdate<ComplianceDocument> {
  requireRole(
    getSessionContext(state),
    "admin",
    "An Admin role is required to record a compliance document.",
  );
  if (input.subjectType === "vehicle") {
    findVehicle(state, input.subjectId);
  } else {
    findDriver(state, input.subjectId);
  }

  const issuedOn = normalizedIsoDateTime(input.issuedOn);
  const expiresOn = normalizedIsoDateTime(input.expiresOn);
  if (Date.parse(expiresOn) <= Date.parse(issuedOn)) {
    throw new OperationsDomainError(
      "VALIDATION_FAILED",
      "A document has to expire after it was issued.",
    );
  }

  const existing = input.id
    ? state.complianceDocuments.find((candidate) => candidate.id === input.id)
    : state.complianceDocuments.find(
        (candidate) => candidate.subjectId === input.subjectId && candidate.kind === input.kind,
      );

  const document: ComplianceDocument = {
    expiresOn,
    id: existing?.id ?? nextId("compliance"),
    identifier: input.identifier,
    issuedOn,
    issuingState: input.issuingState,
    kind: input.kind,
    subjectId: input.subjectId,
    subjectType: input.subjectType,
    updatedAt: occurredAt,
  };

  const others = state.complianceDocuments.filter((candidate) => candidate.id !== document.id);
  return {
    result: document,
    state: {
      ...state,
      complianceDocuments: [...others, document],
      updatedAt: occurredAt,
    },
  };
}
