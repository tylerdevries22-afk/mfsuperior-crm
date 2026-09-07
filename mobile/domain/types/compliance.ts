import type { EntityId, IsoDateTime } from "./core";

export const COMPLIANCE_SUBJECT_TYPES = ["vehicle", "driver"] as const;

export type ComplianceSubjectType = (typeof COMPLIANCE_SUBJECT_TYPES)[number];

export const COMPLIANCE_DOCUMENT_KINDS = [
  "registration",
  "ifta",
  "annual_inspection",
  "insurance",
  "cdl",
  "medical_card",
  "hazmat_endorsement",
] as const;

export type ComplianceDocumentKind = (typeof COMPLIANCE_DOCUMENT_KINDS)[number];

export interface ComplianceDocument {
  readonly id: EntityId;
  readonly subjectType: ComplianceSubjectType;
  readonly subjectId: EntityId;
  readonly kind: ComplianceDocumentKind;
  readonly identifier: string;
  readonly issuingState: string;
  readonly issuedOn: IsoDateTime;
  readonly expiresOn: IsoDateTime;
  readonly updatedAt: IsoDateTime;
}

export interface ComplianceDocumentInput {
  readonly id?: EntityId;
  readonly subjectType: ComplianceSubjectType;
  readonly subjectId: EntityId;
  readonly kind: ComplianceDocumentKind;
  readonly identifier: string;
  readonly issuingState: string;
  readonly issuedOn: IsoDateTime;
  readonly expiresOn: IsoDateTime;
}
