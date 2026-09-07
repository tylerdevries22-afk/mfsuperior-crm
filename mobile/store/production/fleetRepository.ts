import { vehicleTypeForApi } from "../../domain/vehicleCompatibility";

import { OperationsDomainError } from "../../domain/errors";
import type {
  ComplianceDocument,
  ComplianceDocumentInput,
  EntityId,
  MaintenanceOrder,
  MaintenanceOrderInput,
  MaintenanceOrderPatch,
  Vehicle,
  VehicleInput,
  VehicleThumbnailSource,
} from "../../domain/types";
import { encodeId } from "./errors";
import { ProductionShiftRepository } from "./shiftRepository";

/** Fleet records, the shop's work orders, and the documents that keep both legal. */
export class ProductionFleetRepository extends ProductionShiftRepository {
  async upsertVehicle(input: VehicleInput): Promise<Vehicle> {
    const saved = await this.performMutation<{ readonly id: string }>("v1/vehicles", {
      assignedDriverId: input.assignedDriverId ?? null,
      id: input.id ?? null,
      make: input.make,
      model: input.model,
      odometerMiles: input.odometerMiles,
      plateNumber: input.plateNumber,
      plateState: input.plateState,
      status: input.status,
      type: vehicleTypeForApi(input.type),
      unitNumber: input.unitNumber,
      vin: input.vin,
      year: input.year,
    }, ["vehicles"]);
    return this.requireVehicle(saved.id);
  }

  async assignVehicle(vehicleId: EntityId, driverId: EntityId | null): Promise<Vehicle> {
    await this.performMutation<{ readonly id: string }>(
      `v1/vehicles/${encodeId(vehicleId)}/assignment`,
      { driverId },
      ["vehicles"],
    );
    return this.requireVehicle(vehicleId);
  }

  async transferVehicle(
    vehicleId: EntityId,
    targetDriverId: EntityId,
    note: string,
  ): Promise<Vehicle> {
    await this.performMutation<{ readonly id: string }>(
      `v1/vehicles/${encodeId(vehicleId)}/transfer`,
      { note: note.trim(), targetDriverId },
      ["vehicles"],
    );
    return this.requireVehicle(vehicleId);
  }

  async updateVehicleThumbnail(
    vehicleId: EntityId,
    source: VehicleThumbnailSource,
  ): Promise<Vehicle> {
    this.requireIdentity();
    const path = await this.uploader.uploadVehicleThumbnail(vehicleId, source, this.idFactory());
    const saved = await this.performMutation<{ readonly id: string }>(
      `v1/vehicles/${encodeId(vehicleId)}/thumbnail`,
      { path },
      ["vehicles"],
    );
    return this.requireVehicle(saved.id);
  }

  async createMaintenanceOrder(input: MaintenanceOrderInput): Promise<MaintenanceOrder> {
    const created = await this.performMutation<{ readonly id: string }>("v1/maintenance", {
      costCents: input.costCents ?? null,
      description: input.description,
      kind: input.kind,
      odometerMiles: input.odometerMiles ?? null,
      reportedByDriverId: input.reportedByDriverId ?? null,
      scheduledFor: input.scheduledFor ?? null,
      severity: input.severity,
      summary: input.summary,
      vehicleId: input.vehicleId,
      vendorName: input.vendorName ?? null,
      // A critical order grounds the unit, so the fleet changes too.
    }, ["maintenanceOrders", "vehicles"]);
    return this.requireMaintenanceOrder(created.id);
  }

  async updateMaintenanceOrder(
    orderId: EntityId,
    patch: MaintenanceOrderPatch,
  ): Promise<MaintenanceOrder> {
    await this.performMutation<{ readonly id: string }>(
      `v1/maintenance/${encodeId(orderId)}`,
      {
        completedAt: patch.completedAt ?? null,
        costCents: patch.costCents ?? null,
        description: patch.description ?? null,
        scheduledFor: patch.scheduledFor ?? null,
        severity: patch.severity ?? null,
        status: patch.status ?? null,
        vendorName: patch.vendorName ?? null,
      },
      // Closing the last open order returns the unit to service.
      ["maintenanceOrders", "vehicles"],
    );
    return this.requireMaintenanceOrder(orderId);
  }

  async upsertComplianceDocument(input: ComplianceDocumentInput): Promise<ComplianceDocument> {
    const saved = await this.performMutation<{ readonly id: string }>("v1/compliance", {
      expiresOn: input.expiresOn,
      id: input.id ?? null,
      identifier: input.identifier,
      issuedOn: input.issuedOn,
      issuingState: input.issuingState,
      kind: input.kind,
      subjectId: input.subjectId,
      subjectType: input.subjectType,
    }, ["complianceDocuments"]);
    const document = this.state.complianceDocuments.find((candidate) => candidate.id === saved.id);
    if (!document) {
      throw new OperationsDomainError("NOT_FOUND", "That compliance document could not be found.");
    }
    return document;
  }

  private requireVehicle(vehicleId: EntityId): Vehicle {
    const vehicle = this.state.vehicles.find((candidate) => candidate.id === vehicleId);
    if (!vehicle) {
      throw new OperationsDomainError("NOT_FOUND", "The vehicle could not be found.", { vehicleId });
    }
    return vehicle;
  }

  private requireMaintenanceOrder(orderId: EntityId): MaintenanceOrder {
    const order = this.state.maintenanceOrders.find((candidate) => candidate.id === orderId);
    if (!order) {
      throw new OperationsDomainError("NOT_FOUND", "That work order could not be found.");
    }
    return order;
  }
}
