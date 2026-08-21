import { parseX12Envelope } from "../x12";

const MAX_DOCUMENT_BYTES = 20 * 1024 * 1024;
const MAX_X12_BYTES = 2 * 1024 * 1024;

export type AcceptedInboundContentType =
  | "application/pdf"
  | "image/jpeg"
  | "image/png"
  | "image/webp"
  | "application/edi-x12";

export type InboundFileInspection = Readonly<{
  detectedContentType: AcceptedInboundContentType;
  byteSize: number;
  quarantineRequired: true;
  imageReencodingRequired: boolean;
}>;

export type FileBoundaryErrorCode =
  | "EMPTY_FILE"
  | "FILE_TOO_LARGE"
  | "UNSUPPORTED_MEDIA_TYPE"
  | "MAGIC_MISMATCH"
  | "DECLARED_SIZE_MISMATCH";

export class FileBoundaryError extends Error {
  constructor(
    readonly code: FileBoundaryErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "FileBoundaryError";
  }
}

function startsWith(bytes: Uint8Array, signature: ReadonlyArray<number>): boolean {
  return signature.every((value, index) => bytes[index] === value);
}

function asciiAt(bytes: Uint8Array, start: number, length: number): string {
  return String.fromCharCode(...bytes.slice(start, start + length));
}

function detectContentType(bytes: Uint8Array): AcceptedInboundContentType | null {
  if (startsWith(bytes, [0x25, 0x50, 0x44, 0x46, 0x2d])) return "application/pdf";
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return "image/jpeg";
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "image/png";
  if (asciiAt(bytes, 0, 4) === "RIFF" && asciiAt(bytes, 8, 4) === "WEBP") return "image/webp";
  if (asciiAt(bytes, 0, 3) === "ISA") return "application/edi-x12";
  return null;
}

function normalizedContentType(value: string): string {
  return value.split(";", 1)[0]?.trim().toLowerCase() ?? "";
}

function validateDeclaredSize(bytes: Uint8Array, declaredByteSize?: number): void {
  if (
    declaredByteSize !== undefined &&
    (!Number.isSafeInteger(declaredByteSize) || declaredByteSize !== bytes.byteLength)
  ) {
    throw new FileBoundaryError(
      "DECLARED_SIZE_MISMATCH",
      "The declared file size does not match the received bytes.",
    );
  }
}

function validateSize(bytes: Uint8Array, detected: AcceptedInboundContentType): void {
  const maximum = detected === "application/edi-x12" ? MAX_X12_BYTES : MAX_DOCUMENT_BYTES;
  if (bytes.byteLength > maximum) {
    throw new FileBoundaryError("FILE_TOO_LARGE", "The inbound file exceeds its bounded size limit.");
  }
}

/** Inspects inbound bytes before quarantine; extensions and client MIME claims are never trusted. */
export function inspectInboundFile(input: Readonly<{
  bytes: Uint8Array;
  declaredContentType: string;
  declaredByteSize?: number;
}>): InboundFileInspection {
  if (input.bytes.byteLength === 0) {
    throw new FileBoundaryError("EMPTY_FILE", "Empty files are not accepted.");
  }
  validateDeclaredSize(input.bytes, input.declaredByteSize);
  const detectedContentType = detectContentType(input.bytes);
  if (!detectedContentType) {
    throw new FileBoundaryError("UNSUPPORTED_MEDIA_TYPE", "The inbound file signature is not supported.");
  }
  validateSize(input.bytes, detectedContentType);
  if (normalizedContentType(input.declaredContentType) !== detectedContentType) {
    throw new FileBoundaryError("MAGIC_MISMATCH", "The declared media type does not match the file signature.");
  }
  if (detectedContentType === "application/edi-x12") {
    parseX12Envelope(input.bytes, { maxBytes: MAX_X12_BYTES });
  }
  return {
    detectedContentType,
    byteSize: input.bytes.byteLength,
    quarantineRequired: true,
    imageReencodingRequired: detectedContentType.startsWith("image/"),
  };
}
