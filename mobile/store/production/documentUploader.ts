import type { VehicleThumbnailSource } from "../../domain/types";
import {
  readUploadBody,
  uploadToSignedUrl,
  type ApiClient,
  type UploadIntentResponse,
  type UploadSource,
} from "../../lib/network";
import type { OfflineMutation } from "../../lib/offline";
import { encodeId } from "./errors";
import { fileNameFromUri, mimeTypeFromUri, uploadContentType } from "./uploadNaming";

interface VehicleThumbnailUploadIntent {
  readonly path: string;
  readonly upload: {
    readonly contentType: string;
    readonly expiresAt: string;
    readonly token: string;
    readonly url: string;
  };
}

interface DocumentUploaderOptions {
  readonly apiClient: ApiClient;
  readonly fetchImplementation: typeof fetch;
  readonly uploadBaseUrl: string | undefined;
}

/** Signed-URL uploads for retained photo, signature, and thumbnail bytes. */
export class ProductionDocumentUploader {
  private readonly apiClient: ApiClient;
  private readonly fetchImplementation: typeof fetch;
  private readonly uploadBaseUrl: string | undefined;

  constructor(options: DocumentUploaderOptions) {
    this.apiClient = options.apiClient;
    this.fetchImplementation = options.fetchImplementation;
    this.uploadBaseUrl = options.uploadBaseUrl;
  }

  /** Uploads retained photo/signature bytes, returning the linked document id. */
  async uploadPendingDocument(mutation: OfflineMutation): Promise<string | undefined> {
    if (mutation.kind === "photo") {
      const payload = mutation.payload as {
        readonly fileName: string;
        readonly fileUri: string;
        readonly mimeType: string;
      };
      return this.uploadDocument(mutation, {
        contentType: uploadContentType(payload.mimeType, "image/jpeg"),
        fileName: payload.fileName,
        kind: "photo",
        source: { uri: payload.fileUri },
      });
    }
    if (mutation.kind === "signature") {
      const payload = mutation.payload as { readonly signatureData: string };
      if (payload.signatureData.startsWith("file://")) {
        return this.uploadDocument(mutation, {
          contentType: uploadContentType(mimeTypeFromUri(payload.signatureData), "image/png"),
          fileName: fileNameFromUri(payload.signatureData),
          kind: "signature",
          source: { uri: payload.signatureData },
        });
      }
      return this.uploadDocument(mutation, {
        contentType: "image/png",
        fileName: "signature.png",
        kind: "signature",
        source: { base64: payload.signatureData },
      });
    }
    return undefined;
  }

  /** Uploads a vehicle photo, returning the storage path the fleet write links. */
  async uploadVehicleThumbnail(
    vehicleId: string,
    source: VehicleThumbnailSource,
    idempotencyKey: string,
  ): Promise<string> {
    const uploadBody = await readUploadBody({ uri: source.uri }, this.fetchImplementation);
    const intent = await this.apiClient.requestJson<VehicleThumbnailUploadIntent>(
      `v1/vehicles/${encodeId(vehicleId)}/thumbnail-upload-intent`,
      {
        body: {
          byteSize: uploadBody.byteSize,
          contentType: source.contentType,
          fileName: source.fileName,
        },
        idempotencyKey,
        method: "POST",
      },
    );
    await uploadToSignedUrl(intent.upload, uploadBody, {
      baseUrl: this.uploadBaseUrl,
      fetchImplementation: this.fetchImplementation,
    });
    return intent.path;
  }

  private async uploadDocument(
    mutation: OfflineMutation,
    input: {
      readonly contentType: string;
      readonly fileName: string;
      readonly kind: "photo" | "signature";
      readonly source: UploadSource;
    },
  ): Promise<string> {
    const body = await readUploadBody(input.source, this.fetchImplementation);
    const intent = await this.apiClient.requestJson<UploadIntentResponse>(
      "v1/documents/upload-intent",
      {
        body: {
          byteSize: body.byteSize,
          contentType: input.contentType,
          fileName: input.fileName,
          kind: input.kind,
          shipmentId: mutation.shipmentId,
        },
        idempotencyKey: `${mutation.idempotencyKey}-upload-${mutation.attempts}`,
        method: "POST",
      },
    );
    await uploadToSignedUrl(intent.upload, body, {
      baseUrl: this.uploadBaseUrl,
      fetchImplementation: this.fetchImplementation,
    });
    return intent.documentId;
  }
}
