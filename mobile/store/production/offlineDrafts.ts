import type { Shipment } from "../../domain/types";
import type { AuthIdentity } from "../../lib/auth";
import type { OfflineMutationQueue } from "../../lib/offline";
import { shipmentVersion } from "./optimisticRecords";
import { fileNameFromUri, mimeTypeFromUri } from "./uploadNaming";

/** Photo attachments ride the queue so a dead zone cannot lose the evidence. */
export async function enqueueAttachmentMutations(
  queue: OfflineMutationQueue,
  identity: AuthIdentity,
  shipment: Shipment,
  uris: readonly string[],
): Promise<void> {
  for (const uri of uris) {
    await queue.enqueue({
      entityId: shipment.id,
      entityVersion: shipmentVersion(shipment),
      kind: "photo",
      ownerUserId: identity.userId,
      payload: { fileName: fileNameFromUri(uri), fileUri: uri, mimeType: mimeTypeFromUri(uri) },
      pendingFileUris: [uri],
      shipmentId: shipment.id,
    });
  }
}

export async function enqueueSignatureMutation(
  queue: OfflineMutationQueue,
  identity: AuthIdentity,
  shipment: Shipment,
  signatureData: string,
): Promise<void> {
  await queue.enqueue({
    entityId: shipment.id,
    entityVersion: shipmentVersion(shipment),
    kind: "signature",
    ownerUserId: identity.userId,
    payload: { signatureData },
    pendingFileUris: signatureData.startsWith("file://") ? [signatureData] : [],
    shipmentId: shipment.id,
  });
}
