import {
  SUPPORTED_X12_TRANSACTION_TYPES,
  X12BoundaryError,
  type ParsedX12Envelope,
  type SupportedX12TransactionType,
  type X12FunctionalGroup,
  type X12ParseLimits,
  type X12Segment,
  type X12Separators,
  type X12Transaction,
} from "./types";

const DEFAULT_LIMITS = Object.freeze({
  maxBytes: 2 * 1024 * 1024,
  maxSegments: 10_000,
  maxElementsPerSegment: 100,
  maxElementLength: 4_096,
});
const ISA_SEPARATOR_POSITIONS = [
  3, 6, 17, 20, 31, 34, 50, 53, 69, 76, 81, 83, 89, 99, 101, 103,
] as const;

type ResolvedLimits = Readonly<{
  maxBytes: number;
  maxSegments: number;
  maxElementsPerSegment: number;
  maxElementLength: number;
}>;

function resolveLimits(limits: X12ParseLimits): ResolvedLimits {
  return {
    maxBytes: Math.min(Math.max(limits.maxBytes ?? DEFAULT_LIMITS.maxBytes, 106), 20 * 1024 * 1024),
    maxSegments: Math.min(Math.max(limits.maxSegments ?? DEFAULT_LIMITS.maxSegments, 4), 50_000),
    maxElementsPerSegment: Math.min(
      Math.max(limits.maxElementsPerSegment ?? DEFAULT_LIMITS.maxElementsPerSegment, 2),
      1_000,
    ),
    maxElementLength: Math.min(
      Math.max(limits.maxElementLength ?? DEFAULT_LIMITS.maxElementLength, 1),
      64 * 1024,
    ),
  };
}

function decodePayload(payload: string | Uint8Array, maxBytes: number): string {
  const byteLength =
    typeof payload === "string"
      ? new TextEncoder().encode(payload).byteLength
      : payload.byteLength;
  if (byteLength > maxBytes) {
    throw new X12BoundaryError("PAYLOAD_TOO_LARGE", "The X12 payload exceeds the configured byte limit.");
  }
  if (typeof payload === "string") return payload;
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(payload);
  } catch {
    throw new X12BoundaryError("INVALID_ENCODING", "The X12 payload must contain valid UTF-8 text.");
  }
}

function assertSafeCharacters(text: string): void {
  for (let index = 0; index < text.length; index += 1) {
    const characterCode = text.charCodeAt(index);
    const allowedWhitespace = characterCode === 9 || characterCode === 10 || characterCode === 13;
    if (!allowedWhitespace && (characterCode < 32 || characterCode > 126)) {
      throw new X12BoundaryError("INVALID_ENCODING", "The X12 payload contains unsupported control characters.");
    }
  }
}

function separatorsFromIsa(text: string): X12Separators {
  if (!text.startsWith("ISA")) {
    throw new X12BoundaryError("INVALID_MAGIC", "An X12 interchange must begin with an ISA segment.");
  }
  if (text.length < 106) {
    throw new X12BoundaryError("INVALID_ENVELOPE", "The fixed-width ISA segment is incomplete.");
  }
  const separators = {
    element: text[3],
    component: text[104],
    segment: text[105],
  } satisfies X12Separators;
  const uniqueSeparators = new Set(Object.values(separators));
  if (
    uniqueSeparators.size !== 3 ||
    Object.values(separators).some((value) => !value || /[A-Za-z0-9\r\n]/.test(value)) ||
    ISA_SEPARATOR_POSITIONS.some((position) => text[position] !== separators.element)
  ) {
    throw new X12BoundaryError("INVALID_SEPARATOR", "The ISA separators are invalid or ambiguous.");
  }
  const isaElements = text.slice(0, 105).split(separators.element);
  if (isaElements.length !== 17 || isaElements[0] !== "ISA") {
    throw new X12BoundaryError("INVALID_ENVELOPE", "The ISA segment does not contain sixteen elements.");
  }
  return separators;
}

function parseSegment(
  rawSegment: string,
  position: number,
  separators: X12Separators,
  limits: ResolvedLimits,
): X12Segment {
  const fields = rawSegment.split(separators.element);
  if (fields.length > limits.maxElementsPerSegment + 1) {
    throw new X12BoundaryError("TOO_MANY_ELEMENTS", "An X12 segment exceeds the element limit.", position);
  }
  const tag = fields.shift() ?? "";
  if (!/^[A-Z0-9]{2,3}$/.test(tag)) {
    throw new X12BoundaryError("INVALID_ENVELOPE", "An X12 segment has an invalid identifier.", position);
  }
  if (fields.some((field) => field.length > limits.maxElementLength)) {
    throw new X12BoundaryError("ELEMENT_TOO_LONG", "An X12 element exceeds the length limit.", position);
  }
  return { tag, elements: fields, position };
}

function parseSegments(
  text: string,
  separators: X12Separators,
  limits: ResolvedLimits,
): ReadonlyArray<X12Segment> {
  const rawSegments = text.split(separators.segment);
  const trailing = rawSegments.pop()?.replace(/[\r\n\t]/g, "") ?? "";
  if (trailing.length > 0) {
    throw new X12BoundaryError("INVALID_ENVELOPE", "Unexpected data follows the final segment terminator.");
  }
  if (rawSegments.length > limits.maxSegments) {
    throw new X12BoundaryError("TOO_MANY_SEGMENTS", "The X12 payload exceeds the segment limit.");
  }
  return rawSegments.map((rawSegment, index) => {
    const normalized = rawSegment.replace(/^[\r\n\t]+|[\r\n\t]+$/g, "");
    return parseSegment(normalized, index + 1, separators, limits);
  });
}

function requiredElement(segment: X12Segment, index: number): string {
  const value = segment.elements[index]?.trim();
  if (!value) {
    throw new X12BoundaryError(
      "INVALID_ENVELOPE",
      `The ${segment.tag} segment is missing a required element.`,
      segment.position,
    );
  }
  return value;
}

function supportedTransactionType(segment: X12Segment): SupportedX12TransactionType {
  const value = requiredElement(segment, 0);
  if (!(SUPPORTED_X12_TRANSACTION_TYPES as ReadonlyArray<string>).includes(value)) {
    throw new X12BoundaryError(
      "UNSUPPORTED_TRANSACTION",
      "Only X12 204, 990, 214, 210, and 997 transactions are accepted.",
      segment.position,
    );
  }
  return value as SupportedX12TransactionType;
}

function parseTransaction(
  segments: ReadonlyArray<X12Segment>,
  startIndex: number,
): { transaction: X12Transaction; nextIndex: number } {
  const start = segments[startIndex];
  if (start?.tag !== "ST") {
    throw new X12BoundaryError("INVALID_ENVELOPE", "A functional group must contain ST transaction headers.");
  }
  const endIndex = segments.findIndex((segment, index) => index > startIndex && segment.tag === "SE");
  if (endIndex < 0) {
    throw new X12BoundaryError("INVALID_ENVELOPE", "An ST transaction is missing its SE trailer.", start.position);
  }
  const transactionSegments = segments.slice(startIndex, endIndex + 1);
  const nestedEnvelope = transactionSegments
    .slice(1, -1)
    .find((segment) => ["ISA", "IEA", "GS", "GE", "ST"].includes(segment.tag));
  if (nestedEnvelope) {
    throw new X12BoundaryError(
      "INVALID_ENVELOPE",
      "A transaction contains an unexpected envelope segment.",
      nestedEnvelope.position,
    );
  }
  return {
    transaction: {
      type: supportedTransactionType(start),
      controlNumber: requiredElement(start, 1),
      segments: transactionSegments,
    },
    nextIndex: endIndex + 1,
  };
}

function parseGroup(
  segments: ReadonlyArray<X12Segment>,
  startIndex: number,
): { group: X12FunctionalGroup; nextIndex: number } {
  const start = segments[startIndex];
  if (start?.tag !== "GS") {
    throw new X12BoundaryError("INVALID_ENVELOPE", "The interchange must contain GS functional groups.");
  }
  const transactions: X12Transaction[] = [];
  let index = startIndex + 1;
  while (segments[index]?.tag === "ST") {
    const parsed = parseTransaction(segments, index);
    transactions.push(parsed.transaction);
    index = parsed.nextIndex;
  }
  if (transactions.length === 0 || segments[index]?.tag !== "GE") {
    throw new X12BoundaryError("INVALID_ENVELOPE", "A functional group requires transactions and a GE trailer.");
  }
  return {
    group: {
      functionalCode: requiredElement(start, 0),
      controlNumber: requiredElement(start, 5),
      transactions,
      segments: segments.slice(startIndex, index + 1),
    },
    nextIndex: index + 1,
  };
}

function parseGroups(segments: ReadonlyArray<X12Segment>): ReadonlyArray<X12FunctionalGroup> {
  const groups: X12FunctionalGroup[] = [];
  let index = 1;
  while (segments[index]?.tag === "GS") {
    const parsed = parseGroup(segments, index);
    groups.push(parsed.group);
    index = parsed.nextIndex;
  }
  if (groups.length === 0 || index !== segments.length - 1 || segments[index]?.tag !== "IEA") {
    throw new X12BoundaryError("INVALID_ENVELOPE", "The interchange structure or IEA trailer is invalid.");
  }
  return groups;
}

/** Parses a bounded X12 interchange without interpreting provider-private companion rules. */
export function parseX12Envelope(
  payload: string | Uint8Array,
  parseLimits: X12ParseLimits = {},
): ParsedX12Envelope {
  const limits = resolveLimits(parseLimits);
  const text = decodePayload(payload, limits.maxBytes).replace(/^\uFEFF/, "");
  assertSafeCharacters(text);
  const separators = separatorsFromIsa(text);
  const segments = parseSegments(text, separators, limits);
  const isa = segments[0];
  if (isa?.tag !== "ISA" || segments.at(-1)?.tag !== "IEA") {
    throw new X12BoundaryError("INVALID_ENVELOPE", "The interchange must be enclosed by ISA and IEA segments.");
  }
  return {
    separators,
    senderId: requiredElement(isa, 5),
    receiverId: requiredElement(isa, 7),
    interchangeControlNumber: requiredElement(isa, 12),
    segments,
    groups: parseGroups(segments),
  };
}
