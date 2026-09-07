import { OperationsDomainError } from "../../domain/errors";
import type {
  DemoOperationsState,
  EdiTransaction,
  EntityId,
  GeoPoint,
  HosDutyStatus,
  Shipment,
  ShipmentStatus,
} from "../../domain/types";
import { encodeId, productionOnlyError } from "./errors";
import { shipmentVersion } from "./optimisticRecords";
import { ProductionRepositoryBase } from "./repositoryBase";
import { updateDriverLocation, updateDutyStatus } from "./stateFactories";

/** Tender responses, dispatch, status transitions, and driver telemetry. */
export class ProductionShipmentRepository extends ProductionRepositoryBase {
  async respondToTender(
    shipmentId: EntityId,
    response: "accepted" | "declined",
  ): Promise<Shipment> {
    await this.performMutation<{ readonly id: string }>(
      `v1/shipments/${encodeId(shipmentId)}/tender-response`,
      { response },
    );
    return this.requireShipment(shipmentId);
  }

  async assignShipment(
    shipmentId: EntityId,
    driverId: EntityId,
    offerPriceCents?: number,
  ): Promise<Shipment> {
    await this.performMutation<{ readonly driverId: string }>(
      `v1/shipments/${encodeId(shipmentId)}/assignment`,
      { driverId, offerPriceCents },
    );
    return this.requireShipment(shipmentId);
  }

  async addDemoUnassignedLoad(): Promise<Shipment> {
    throw productionOnlyError("Adding demo loads is only available in the explicit demo.");
  }

  async transitionShipment(
    shipmentId: EntityId,
    nextStatus: ShipmentStatus,
    stopId?: EntityId,
  ): Promise<Shipment> {
    const identity = this.requireIdentity();
    const shipment = this.requireShipment(shipmentId);
    await this.enqueueAndSync({
      entityId: shipmentId,
      entityVersion: shipmentVersion(shipment),
      kind: "shipment_status",
      ownerUserId: identity.userId,
      payload: stopId ? { status: nextStatus, stopId } : { status: nextStatus },
      shipmentId,
    });
    const transitioned: Shipment = { ...shipment, status: nextStatus, updatedAt: this.clock() };
    this.replaceState({
      ...this.state,
      shipments: this.state.shipments.map((candidate) => (
        candidate.id === shipmentId ? transitioned : candidate
      )),
      updatedAt: this.clock(),
    });
    return transitioned;
  }

  async advanceIntermediateStop(_shipmentId: EntityId, _stopId: EntityId): Promise<Shipment> {
    // Production shipments only carry a pickup and a delivery stop, so there is
    // no intermediate stop to advance and no server route that would accept one.
    throw productionOnlyError(
      "Intermediate stops are not part of the production shipment record yet.",
    );
  }

  async transitionDutyStatus(nextStatus: HosDutyStatus): Promise<DemoOperationsState> {
    const identity = this.requireIdentity();
    const shipment = this.findActiveShipment();
    const driverId = this.requireCurrentDriverId();
    await this.enqueueAndSync({
      entityId: driverId,
      entityVersion: shipmentVersion(shipment),
      kind: "driver_status",
      ownerUserId: identity.userId,
      payload: { status: nextStatus },
      shipmentId: shipment?.id ?? `unassigned-${driverId}`,
    });
    this.replaceState(updateDutyStatus(this.state, driverId, nextStatus, this.clock()));
    return this.state;
  }

  async recordDriverLocation(coordinates: GeoPoint): Promise<DemoOperationsState> {
    const identity = this.requireIdentity();
    const shipment = this.findActiveShipment();
    const driverId = this.requireCurrentDriverId();
    await this.enqueueAndSync({
      entityId: driverId,
      entityVersion: shipmentVersion(shipment),
      kind: "location",
      ownerUserId: identity.userId,
      payload: { coordinates },
      shipmentId: shipment?.id ?? `unassigned-${driverId}`,
    });
    this.replaceState(updateDriverLocation(this.state, driverId, coordinates, this.clock()));
    return this.state;
  }

  getShipmentEdiTransactions(shipmentId: EntityId): readonly EdiTransaction[] {
    return this.state.ediTransactions.filter((transaction) => transaction.shipmentId === shipmentId);
  }

  protected requireShipment(shipmentId: string): Shipment {
    const shipment = this.state.shipments.find((candidate) => candidate.id === shipmentId);
    if (!shipment) {
      throw new OperationsDomainError("NOT_FOUND", "The shipment could not be found.");
    }
    return shipment;
  }

  private findActiveShipment(): Shipment | null {
    return this.state.shipments.find((shipment) => (
      shipment.status !== "delivered" && shipment.status !== "cancelled" && shipment.status !== "declined"
    )) ?? null;
  }

  private requireCurrentDriverId(): string {
    const account = this.state.accounts.find((candidate) => candidate.id === this.state.session.accountId);
    if (!account?.driverId) {
      throw new OperationsDomainError("UNAUTHORIZED", "A driver account is required.");
    }
    return account.driverId;
  }
}
