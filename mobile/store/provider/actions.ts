import { toOperationsFailure, type OperationsFailure } from "../../domain/errors";
import type { OperationsRepository } from "../../domain/repository";
import { unregisterDeviceForNotifications } from "../../lib/notifications/service";
import type { OperationsActions } from "./types";

type SetOperationsError = (failure: OperationsFailure | null) => void;

/**
 * Every mutation funnels through one failure boundary so screens can stay
 * boolean-driven while the provider owns the surfaced error.
 */
export function createOperationsActions(
  repository: OperationsRepository,
  setError: SetOperationsError,
): OperationsActions {
  const runMutation = async (mutation: () => Promise<unknown>): Promise<boolean> => {
    setError(null);
    try {
      await mutation();
      return true;
    } catch (mutationError: unknown) {
      setError(toOperationsFailure(mutationError));
      return false;
    }
  };

  return {
    signIn: (email, pin) => runMutation(() => repository.signIn(email, pin)),
    restoreSession: () => runMutation(() => repository.hydrate()),
    signOut: () => runMutation(async () => {
      if (repository.mode === "production") {
        await unregisterDeviceForNotifications().catch(() => undefined);
      }
      await repository.signOut();
    }),
    switchDemoRole: (role) => runMutation(() => repository.switchDemoRole(role)),
    resetDemo: () => runMutation(() => repository.resetDemo()),
    respondToTender: (shipmentId, response) => runMutation(
      () => repository.respondToTender(shipmentId, response),
    ),
    assignShipment: (shipmentId, driverId, offerPriceCents) => runMutation(
      () => repository.assignShipment(shipmentId, driverId, offerPriceCents),
    ),
    addDemoUnassignedLoad: () => runMutation(() => repository.addDemoUnassignedLoad()),
    transitionShipment: (shipmentId, nextStatus, stopId) => runMutation(
      () => repository.transitionShipment(shipmentId, nextStatus, stopId),
    ),
    advanceIntermediateStop: (shipmentId, stopId) => runMutation(
      () => repository.advanceIntermediateStop(shipmentId, stopId),
    ),
    transitionDutyStatus: (nextStatus) => runMutation(
      () => repository.transitionDutyStatus(nextStatus),
    ),
    recordDriverLocation: (coordinates) => runMutation(
      () => repository.recordDriverLocation(coordinates),
    ),
    reportException: (shipmentId, input) => runMutation(
      () => repository.reportException(shipmentId, input),
    ),
    resolveException: (exceptionId, resolutionNote, resumeStatus) => runMutation(
      () => repository.resolveException(exceptionId, resolutionNote, resumeStatus),
    ),
    submitProofOfDelivery: (shipmentId, input) => runMutation(
      () => repository.submitProofOfDelivery(shipmentId, input),
    ),
    sendMessage: (input) => runMutation(() => repository.sendMessage(input)),
    createCustomerRequest: (input) => runMutation(
      () => repository.createCustomerRequest(input),
    ),
    markMessageRead: (messageId) => runMutation(() => repository.markMessageRead(messageId)),
    setAvailabilityBlock: (input) => runMutation(() => repository.setAvailabilityBlock(input)),
    removeAvailabilityBlock: (blockId) => runMutation(
      () => repository.removeAvailabilityBlock(blockId),
    ),
    setAvailabilityRule: (input) => runMutation(() => repository.setAvailabilityRule(input)),
    removeAvailabilityRule: (ruleId) => runMutation(
      () => repository.removeAvailabilityRule(ruleId),
    ),
    setDriverShift: (input) => runMutation(() => repository.setDriverShift(input)),
    removeDriverShift: (shiftId) => runMutation(() => repository.removeDriverShift(shiftId)),
    requestShiftCoverage: (input) => runMutation(
      () => repository.requestShiftCoverage(input),
    ),
    respondToShiftCoverage: (requestId, response) => runMutation(
      () => repository.respondToShiftCoverage(requestId, response),
    ),
    retryScheduleSync: (shiftId) => runMutation(() => repository.retryScheduleSync(shiftId)),
    upsertVehicle: (input) => runMutation(() => repository.upsertVehicle(input)),
    assignVehicle: (vehicleId, driverId) => runMutation(
      () => repository.assignVehicle(vehicleId, driverId),
    ),
    transferVehicle: (vehicleId, targetDriverId, note) => runMutation(
      () => repository.transferVehicle(vehicleId, targetDriverId, note),
    ),
    updateVehicleThumbnail: (vehicleId, source) => runMutation(
      () => repository.updateVehicleThumbnail(vehicleId, source),
    ),
    createMaintenanceOrder: (input) => runMutation(
      () => repository.createMaintenanceOrder(input),
    ),
    updateMaintenanceOrder: (orderId, patch) => runMutation(
      () => repository.updateMaintenanceOrder(orderId, patch),
    ),
    upsertComplianceDocument: (input) => runMutation(
      () => repository.upsertComplianceDocument(input),
    ),
    issuePayout: (driverId, periodStart, periodEnd) => runMutation(
      () => repository.issuePayout(driverId, periodStart, periodEnd),
    ),
    markPayoutPaid: (payoutId, rail) => runMutation(
      () => repository.markPayoutPaid(payoutId, rail),
    ),
    // A read, so it surfaces its own failure to the caller rather than
    // routing through runMutation, which only reports success as a boolean.
    listPayoutMethods: async () => {
      try {
        return await repository.listPayoutMethods();
      } catch (readError: unknown) {
        setError(toOperationsFailure(readError));
        return [];
      }
    },
    savePayoutMethod: (input) => runMutation(() => repository.savePayoutMethod(input)),
    removePayoutMethod: (methodId) => runMutation(() => repository.removePayoutMethod(methodId)),
    setDefaultPayoutMethod: (methodId) => runMutation(
      () => repository.setDefaultPayoutMethod(methodId),
    ),
    clearError: () => setError(null),
  };
}
