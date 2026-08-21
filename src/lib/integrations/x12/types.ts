export const SUPPORTED_X12_TRANSACTION_TYPES = [
  "204",
  "990",
  "214",
  "210",
  "997",
] as const;

export type SupportedX12TransactionType =
  (typeof SUPPORTED_X12_TRANSACTION_TYPES)[number];

export type X12Separators = Readonly<{
  element: string;
  component: string;
  segment: string;
}>;

export type X12Segment = Readonly<{
  tag: string;
  elements: ReadonlyArray<string>;
  position: number;
}>;

export type X12Transaction = Readonly<{
  type: SupportedX12TransactionType;
  controlNumber: string;
  segments: ReadonlyArray<X12Segment>;
}>;

export type X12FunctionalGroup = Readonly<{
  functionalCode: string;
  controlNumber: string;
  transactions: ReadonlyArray<X12Transaction>;
  segments: ReadonlyArray<X12Segment>;
}>;

export type ParsedX12Envelope = Readonly<{
  separators: X12Separators;
  senderId: string;
  receiverId: string;
  interchangeControlNumber: string;
  segments: ReadonlyArray<X12Segment>;
  groups: ReadonlyArray<X12FunctionalGroup>;
}>;

export type X12ParseLimits = Readonly<{
  maxBytes?: number;
  maxSegments?: number;
  maxElementsPerSegment?: number;
  maxElementLength?: number;
}>;

export type X12BoundaryErrorCode =
  | "PAYLOAD_TOO_LARGE"
  | "INVALID_ENCODING"
  | "INVALID_MAGIC"
  | "INVALID_SEPARATOR"
  | "TOO_MANY_SEGMENTS"
  | "TOO_MANY_ELEMENTS"
  | "ELEMENT_TOO_LONG"
  | "INVALID_ENVELOPE"
  | "CONTROL_NUMBER_MISMATCH"
  | "SEGMENT_COUNT_MISMATCH"
  | "UNSUPPORTED_TRANSACTION";

export class X12BoundaryError extends Error {
  constructor(
    readonly code: X12BoundaryErrorCode,
    message: string,
    readonly segmentPosition?: number,
  ) {
    super(message);
    this.name = "X12BoundaryError";
  }
}
