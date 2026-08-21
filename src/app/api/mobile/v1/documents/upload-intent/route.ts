import { and, eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { db } from "@/lib/db/client";
import {
  documentUploadIntents,
  freightDocuments,
  freightRequests,
  shipments,
} from "@/lib/db/schema";
import {
  freightRequestAccessPredicate,
  shipmentAccessPredicate,
} from "@/lib/mobile-api/access";
import { authorizeMobileRequest } from "@/lib/mobile-api/authorize";
import {
  idempotencyKeySchema,
  uploadIntentSchema,
} from "@/lib/mobile-api/contracts";
import {
  apiError,
  apiFailureResponse,
  apiSuccess,
  mergeResponseHeaders,
  MobileApiError,
  parseStrictJson,
} from "@/lib/mobile-api/http";
import { executeIdempotentMutation } from "@/lib/mobile-api/idempotency";
import {
  signDocumentUpload,
  storagePathFor,
} from "@/lib/mobile-api/upload-signer";

async function assertLinkedResourceAccess(
  shipmentId: string | null | undefined,
  requestId: string | null | undefined,
  principal: Parameters<typeof shipmentAccessPredicate>[0],
) {
  if (!shipmentId && !requestId && principal.role !== "admin") {
    throw new MobileApiError(
      400,
      "VALIDATION_ERROR",
      "Driver and customer documents must be linked to an accessible record.",
    );
  }
  if (shipmentId) {
    const [shipment] = await db
      .select({ id: shipments.id })
      .from(shipments)
      .where(
        and(eq(shipments.id, shipmentId), shipmentAccessPredicate(principal)),
      );
    if (!shipment) throw new MobileApiError(404, "NOT_FOUND", "Shipment not found.");
  }
  if (requestId) {
    const [freightRequest] = await db
      .select({ id: freightRequests.id })
      .from(freightRequests)
      .where(
        and(
          eq(freightRequests.id, requestId),
          freightRequestAccessPredicate(principal),
        ),
      );
    if (!freightRequest) {
      throw new MobileApiError(404, "NOT_FOUND", "Freight request not found.");
    }
  }
}

export async function POST(request: Request) {
  const authorization = await authorizeMobileRequest(request, {
    roles: ["admin", "driver", "customer"],
    requireCarrier: true,
    rateLimit: { scope: "mobile.upload", limit: 20, windowMs: 60_000 },
  });
  if (!authorization.authorized) return authorization.response;
  const body = await parseStrictJson(
    request,
    uploadIntentSchema,
    authorization.requestId,
  );
  if (!body.success) return body.response;
  const idempotencyKey = idempotencyKeySchema.safeParse(
    request.headers.get("idempotency-key"),
  );
  if (!idempotencyKey.success) {
    return apiError(
      400,
      {
        code: "VALIDATION_ERROR",
        message: "A valid Idempotency-Key header is required.",
      },
      authorization.requestId,
    );
  }

  try {
    await assertLinkedResourceAccess(
      body.data.shipmentId,
      body.data.requestId,
      authorization.principal,
    );
    const documentId = randomUUID();
    const path = storagePathFor(
      authorization.principal.organizationId,
      documentId,
      body.data.fileName,
    );
    const result = await executeIdempotentMutation(
      {
        principal: authorization.principal,
        idempotencyKey: idempotencyKey.data,
        operation: "document.upload_intent.create",
        payload: body.data,
      },
      async (transaction) => {
        const signed = await signDocumentUpload(path);
        const expiresAt = new Date(Date.now() + signed.expiresInSeconds * 1_000);
        await transaction.insert(freightDocuments).values({
          id: documentId,
          organizationId: authorization.principal.organizationId,
          shipmentId: body.data.shipmentId,
          requestId: body.data.requestId,
          uploadedByUserId: authorization.principal.userId,
          kind: body.data.kind,
          fileName: body.data.fileName,
          contentType: body.data.contentType,
          byteSize: body.data.byteSize,
          storageBucket: signed.bucket,
          storagePath: signed.path,
        });
        await transaction.insert(documentUploadIntents).values({
          organizationId: authorization.principal.organizationId,
          documentId,
          actorUserId: authorization.principal.userId,
          idempotencyKey: idempotencyKey.data,
          expiresAt,
        });
        return {
          status: 201,
          data: {
            documentId,
            upload: {
              url: signed.signedUrl,
              token: signed.token,
              contentType: body.data.contentType,
              expiresAt: expiresAt.toISOString(),
            },
          },
        };
      },
    );
    return mergeResponseHeaders(
      apiSuccess(result.data, authorization.requestId, {
        status: result.status,
        meta: { idempotencyReplayed: result.replayed },
      }),
      authorization.responseHeaders,
    );
  } catch (error) {
    return apiFailureResponse(error, authorization.requestId, "documents.upload_intent");
  }
}
