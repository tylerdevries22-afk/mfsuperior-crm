import {
  X12BoundaryError,
  type ParsedX12Envelope,
  type SupportedX12TransactionType,
  type X12Segment,
  type X12Transaction,
} from "./types";

const FUNCTIONAL_CODE_BY_TRANSACTION = Object.freeze({
  "204": "SM",
  "990": "GF",
  "214": "QM",
  "210": "IM",
  "997": "FA",
} satisfies Record<SupportedX12TransactionType, string>);

function element(segment: X12Segment, index: number): string {
  return segment.elements[index]?.trim() ?? "";
}

function numericElement(segment: X12Segment, index: number): number {
  const value = element(segment, index);
  if (!/^\d+$/.test(value)) {
    throw new X12BoundaryError(
      "INVALID_ENVELOPE",
      `The ${segment.tag} count must be numeric.`,
      segment.position,
    );
  }
  return Number(value);
}

function validateTransaction(transaction: X12Transaction): void {
  const start = transaction.segments[0];
  const end = transaction.segments.at(-1);
  if (!start || !end || end.tag !== "SE") {
    throw new X12BoundaryError("INVALID_ENVELOPE", "The transaction trailer is missing.");
  }
  if (transaction.controlNumber !== element(end, 1)) {
    throw new X12BoundaryError(
      "CONTROL_NUMBER_MISMATCH",
      "The ST and SE control numbers do not match.",
      end.position,
    );
  }
  if (numericElement(end, 0) !== transaction.segments.length) {
    throw new X12BoundaryError(
      "SEGMENT_COUNT_MISMATCH",
      "The SE segment count does not match the transaction.",
      end.position,
    );
  }
}

function validateGroup(
  envelope: ParsedX12Envelope,
  groupIndex: number,
): void {
  const group = envelope.groups[groupIndex];
  if (!group) return;
  const gs = group.segments[0];
  const ge = group.segments.at(-1);
  if (!gs || !ge || gs.tag !== "GS" || ge.tag !== "GE") {
    throw new X12BoundaryError("INVALID_ENVELOPE", "The functional group envelope is invalid.");
  }
  if (element(gs, 5) !== element(ge, 1)) {
    throw new X12BoundaryError("CONTROL_NUMBER_MISMATCH", "The GS and GE control numbers do not match.");
  }
  if (numericElement(ge, 0) !== group.transactions.length) {
    throw new X12BoundaryError("SEGMENT_COUNT_MISMATCH", "The GE transaction count is incorrect.", ge.position);
  }
  for (const transaction of group.transactions) {
    if (FUNCTIONAL_CODE_BY_TRANSACTION[transaction.type] !== group.functionalCode) {
      throw new X12BoundaryError(
        "INVALID_ENVELOPE",
        "The GS functional code does not match its transaction type.",
      );
    }
    validateTransaction(transaction);
  }
}

/** Validates envelope counts, control numbers, and the five approved freight transaction types. */
export function validateX12Envelope(
  envelope: ParsedX12Envelope,
  expectedTransactionTypes?: ReadonlyArray<SupportedX12TransactionType>,
): ParsedX12Envelope {
  const isa = envelope.segments[0];
  const iea = envelope.segments.at(-1);
  if (!isa || !iea || iea.tag !== "IEA") {
    throw new X12BoundaryError("INVALID_ENVELOPE", "The ISA or IEA envelope segment is missing.");
  }
  if (envelope.interchangeControlNumber !== element(iea, 1)) {
    throw new X12BoundaryError("CONTROL_NUMBER_MISMATCH", "The ISA and IEA control numbers do not match.");
  }
  if (numericElement(iea, 0) !== envelope.groups.length) {
    throw new X12BoundaryError("SEGMENT_COUNT_MISMATCH", "The IEA group count is incorrect.", iea.position);
  }
  envelope.groups.forEach((_, index) => validateGroup(envelope, index));
  if (expectedTransactionTypes) {
    const accepted = new Set(expectedTransactionTypes);
    const unexpected = envelope.groups.flatMap((group) => group.transactions).find((entry) => !accepted.has(entry.type));
    if (unexpected) {
      throw new X12BoundaryError("UNSUPPORTED_TRANSACTION", "The interchange contains an unexpected transaction type.");
    }
  }
  return envelope;
}
