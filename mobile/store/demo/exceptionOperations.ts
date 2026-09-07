import { OperationsDomainError } from "../../domain/errors";
import { transitionShipmentStatus } from "../../domain/transitions";
import type {
  DemoOperationsState,
  EntityId,
  ExceptionReport,
  ExceptionReportInput,
  Shipment,
  ShipmentStatus,
} from "../../domain/types";
import { getSessionContext, requireRole, type DemoWriteContext, type StateUpdate } from "./context";
import { appendEdiTransaction, createEdiTransaction } from "./edi";
import { findShipment } from "./lookups";
import {
  assertCanOperateShipment,
  currentCoordinates,
  eventSourceForRole,
  replaceShipment,
} from "./shipmentSupport";
import { requireTrimmedText } from "./validation";

export function reportException(
  { state, occurredAt, nextId }: DemoWriteContext,
  shipmentId: EntityId,
  input: ExceptionReportInput,
): StateUpdate<ExceptionReport> {
  const context = getSessionContext(state);
  const shipment = findShipment(state, shipmentId);
  assertCanOperateShipment(context, shipment);
  requireTrimmedText(input.description, "Exception description", 10, 1_000);
  if (input.stopId && !shipment.stops.some((stop) => stop.id === input.stopId)) {
    throw new OperationsDomainError(
      "NOT_FOUND",
      "The selected shipment stop could not be found.",
      { stopId: input.stopId },
    );
  }

  const report: ExceptionReport = {
    id: nextId("exception"),
    shipmentId,
    stopId: input.stopId,
    category: input.category,
    severity: input.severity,
    status: "open",
    description: input.description.trim(),
    reportedByAccountId: context.account.id,
    reportedAt: occurredAt,
    attachmentUris: (input.attachmentUris ?? []).filter((uri) => uri.trim().length > 0),
  };
  const transitioned = shipment.status === "exception"
    ? shipment
    : transitionShipmentStatus(shipment, "exception", {
        eventId: nextId("event"),
        occurredAt,
        source: eventSourceForRole(context.effectiveRole),
        description: report.description,
        stopId: input.stopId,
        coordinates: currentCoordinates(state, context),
      });
  let nextState: DemoOperationsState = {
    ...replaceShipment(state, transitioned, occurredAt),
    exceptions: [...state.exceptions, report],
    updatedAt: occurredAt,
  };
  nextState = appendEdiTransaction(
    nextState,
    createEdiTransaction(
      nextId("edi"),
      transitioned,
      "214",
      `Exception: ${report.category.replaceAll("_", " ")}`,
      occurredAt,
    ),
    occurredAt,
  );
  return { state: nextState, result: report };
}

export function resolveException(
  { state, occurredAt, nextId }: DemoWriteContext,
  exceptionId: EntityId,
  resolutionNote: string,
  resumeStatus: ShipmentStatus,
): StateUpdate<ExceptionReport> {
  const context = getSessionContext(state);
  requireRole(context, "admin", "Only an admin can resolve shipment exceptions.");
  requireTrimmedText(resolutionNote, "Resolution note", 5, 1_000);
  const report = state.exceptions.find((candidate) => candidate.id === exceptionId);
  if (!report) {
    throw new OperationsDomainError("NOT_FOUND", "The exception report could not be found.");
  }
  if (report.status === "resolved") {
    throw new OperationsDomainError("INVALID_TRANSITION", "This exception is already resolved.");
  }

  const shipment = findShipment(state, report.shipmentId);
  const transitioned = transitionShipmentStatus(shipment, resumeStatus, {
    eventId: nextId("event"),
    occurredAt,
    source: "admin",
    description: resolutionNote.trim(),
    stopId: report.stopId,
  });
  const lastEvent = transitioned.events.at(-1);
  const resolvedShipment: Shipment = lastEvent
    ? {
        ...transitioned,
        events: [
          ...transitioned.events.slice(0, -1),
          {
            ...lastEvent,
            type: "exception_resolved",
            eventCode: "P1",
            description: resolutionNote.trim(),
          },
        ],
      }
    : transitioned;
  const resolvedReport: ExceptionReport = {
    ...report,
    status: "resolved",
    resolutionNote: resolutionNote.trim(),
    resolvedAt: occurredAt,
  };
  const nextState: DemoOperationsState = {
    ...replaceShipment(state, resolvedShipment, occurredAt),
    exceptions: state.exceptions.map((candidate) => candidate.id === exceptionId ? resolvedReport : candidate),
    updatedAt: occurredAt,
  };
  return { state: nextState, result: resolvedReport };
}
