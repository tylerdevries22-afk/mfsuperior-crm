import { OperationsDomainError } from "../../domain/errors";
import type {
  EntityId,
  ExceptionReport,
  ExceptionReportInput,
  ProofOfDelivery,
  ProofOfDeliveryInput,
  ShipmentStatus,
} from "../../domain/types";
import { encodeId } from "./errors";
import { enqueueAttachmentMutations, enqueueSignatureMutation } from "./offlineDrafts";
import {
  createOptimisticException,
  createOptimisticProof,
  resumableStatus,
  shipmentVersion,
} from "./optimisticRecords";
import { ProductionShipmentRepository } from "./shipmentRepository";

/**
 * Exception reports and proofs of delivery.
 *
 * Both are filed from the cab with photo or signature bytes attached, so both
 * go through the offline queue and are reflected optimistically until it drains.
 */
export class ProductionExceptionRepository extends ProductionShipmentRepository {
  async reportException(
    shipmentId: EntityId,
    input: ExceptionReportInput,
  ): Promise<ExceptionReport> {
    const identity = this.requireIdentity();
    const shipment = this.requireShipment(shipmentId);
    await enqueueAttachmentMutations(
      this.offlineQueue,
      identity,
      shipment,
      input.attachmentUris ?? [],
    );
    const mutation = await this.enqueueAndSync({
      entityId: shipmentId,
      entityVersion: shipmentVersion(shipment),
      kind: "exception",
      ownerUserId: identity.userId,
      payload: { input },
      pendingFileUris: input.attachmentUris,
      shipmentId,
    });
    const report = createOptimisticException(mutation, identity.userId, input);
    this.replaceState({
      ...this.state,
      exceptions: [...this.state.exceptions, report],
      updatedAt: this.clock(),
    });
    return report;
  }

  async resolveException(
    exceptionId: EntityId,
    resolutionNote: string,
    resumeStatus: ShipmentStatus,
  ): Promise<ExceptionReport> {
    const report = this.requireException(exceptionId);
    await this.performMutation<{ readonly id: string }>(
      `v1/exceptions/${encodeId(exceptionId)}/resolution`,
      { resolutionNote, resumeStatus: resumableStatus(resumeStatus) },
    );
    return {
      ...report,
      resolutionNote,
      resolvedAt: this.clock(),
      status: "resolved",
    };
  }

  async submitProofOfDelivery(
    shipmentId: EntityId,
    input: ProofOfDeliveryInput,
  ): Promise<ProofOfDelivery> {
    const identity = this.requireIdentity();
    const shipment = this.requireShipment(shipmentId);
    const fileUris = input.attachments?.map((attachment) => attachment.uri) ?? [];
    await enqueueAttachmentMutations(this.offlineQueue, identity, shipment, fileUris);
    await enqueueSignatureMutation(this.offlineQueue, identity, shipment, input.signatureData);
    const mutation = await this.enqueueAndSync({
      entityId: shipmentId,
      entityVersion: shipmentVersion(shipment),
      kind: "pod",
      ownerUserId: identity.userId,
      payload: { input },
      pendingFileUris: fileUris,
      shipmentId,
    });
    const proof = createOptimisticProof(mutation, identity.userId, shipmentId, input);
    this.replaceState({
      ...this.state,
      proofsOfDelivery: [...this.state.proofsOfDelivery, proof],
      updatedAt: this.clock(),
    });
    return proof;
  }

  private requireException(exceptionId: string): ExceptionReport {
    const report = this.state.exceptions.find((candidate) => candidate.id === exceptionId);
    if (!report) {
      throw new OperationsDomainError("NOT_FOUND", "The exception report could not be found.");
    }
    return report;
  }
}
