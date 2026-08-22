import type {
  DemoAccount,
  DemoOperationsState,
  PostalAddress,
  Shipment,
  ShipmentEvent,
  ShipmentStop,
} from "./types";
import { DEMO_STATE_VERSION } from "./types";

export const DEMO_ACCOUNT_CREDENTIALS = {
  admin: { email: "admin@demo.mfsuperior.com", pin: "3333" },
  customer: { email: "customer@demo.mfsuperior.com", pin: "1111" },
  driver: { email: "driver@demo.mfsuperior.com", pin: "2222" },
} as const;

const FIXTURE_NOW = "2026-08-20T13:00:00.000Z";

const frontRangeGroceryAddress: PostalAddress = {
  line1: "15500 East 40th Avenue",
  city: "Aurora",
  state: "CO",
  postalCode: "80011",
  countryCode: "US",
};

const accounts: readonly DemoAccount[] = [
  {
    id: "account-customer",
    role: "customer",
    displayName: "Jordan Lee",
    email: DEMO_ACCOUNT_CREDENTIALS.customer.email,
    demoPin: DEMO_ACCOUNT_CREDENTIALS.customer.pin,
    companyName: "Front Range Grocery",
    title: "Transportation Coordinator",
    customerId: "customer-front-range",
  },
  {
    id: "account-driver",
    role: "driver",
    displayName: "Brenna Lewis",
    email: DEMO_ACCOUNT_CREDENTIALS.driver.email,
    demoPin: DEMO_ACCOUNT_CREDENTIALS.driver.pin,
    companyName: "MF Superior Products",
    title: "Professional Driver",
    driverId: "driver-brenna",
  },
  {
    id: "account-admin",
    role: "admin",
    displayName: "Morgan Brooks",
    email: DEMO_ACCOUNT_CREDENTIALS.admin.email,
    demoPin: DEMO_ACCOUNT_CREDENTIALS.admin.pin,
    companyName: "MF Superior Products",
    title: "Operations Administrator",
  },
];

const activeStops: readonly ShipmentStop[] = [
  {
    id: "stop-28471-pickup",
    sequence: 1,
    type: "pickup",
    status: "pending",
    facilityName: "Front Range Grocery Crossdock",
    facilityReference: "FRG-XD-AURORA",
    address: {
      line1: "15500 East 40th Avenue",
      city: "Aurora",
      state: "CO",
      postalCode: "80011",
      countryCode: "US",
    },
    coordinates: { latitude: 39.7714, longitude: -104.8078 },
    appointment: {
      startsAt: "2026-08-20T13:00:00.000Z",
      endsAt: "2026-08-20T14:00:00.000Z",
      timeZone: "America/Denver",
    },
    instructions: "Enter through the carrier gate and check in with the load ID and trailer number.",
    contact: { name: "Shipping Office", phone: "+1-303-555-0101" },
  },
  {
    id: "stop-28471-intermediate",
    sequence: 2,
    type: "intermediate",
    status: "pending",
    facilityName: "North Denver Market",
    facilityReference: "FRG-MKT-NORTH",
    address: {
      line1: "850 East 58th Avenue",
      city: "Denver",
      state: "CO",
      postalCode: "80216",
      countryCode: "US",
    },
    coordinates: { latitude: 39.8029, longitude: -104.9758 },
    appointment: {
      startsAt: "2026-08-20T18:30:00.000Z",
      endsAt: "2026-08-20T19:15:00.000Z",
      timeZone: "America/Denver",
    },
    instructions: "Unload pallets 1–8 at receiving door 4. Retain signed stop receipt.",
    contact: { name: "Receiving", phone: "+1-303-555-0106" },
  },
  {
    id: "stop-28471-delivery",
    sequence: 3,
    type: "delivery",
    status: "pending",
    facilityName: "Fort Collins Grocery Market",
    facilityReference: "FRG-MKT-FORT-COLLINS",
    address: {
      line1: "2200 East Harmony Road",
      city: "Fort Collins",
      state: "CO",
      postalCode: "80528",
      countryCode: "US",
    },
    coordinates: { latitude: 40.5232, longitude: -105.0364 },
    appointment: {
      startsAt: "2026-08-20T22:00:00.000Z",
      endsAt: "2026-08-20T23:00:00.000Z",
      timeZone: "America/Denver",
    },
    instructions: "Call receiving 30 minutes before arrival. Appointment required.",
    contact: { name: "Receiving", phone: "+1-970-555-0284" },
  },
];

const activeEvents: readonly ShipmentEvent[] = [
  createEvent(
    "event-28471-tender",
    "shipment-28471",
    "tender_received",
    "204",
    "system",
    "2026-08-19T14:05:00.000Z",
    "Customer load tender received",
    "tendered",
  ),
  createEvent(
    "event-28471-accepted",
    "shipment-28471",
    "tender_accepted",
    "990",
    "admin",
    "2026-08-19T14:22:00.000Z",
    "Load tender accepted",
    "accepted",
  ),
  createEvent(
    "event-28471-dispatched",
    "shipment-28471",
    "dispatched",
    "AF",
    "admin",
    "2026-08-20T11:45:00.000Z",
    "Brenna Lewis assigned and dispatched",
    "dispatched",
  ),
];

const shipments: readonly Shipment[] = [
  {
    id: "shipment-28471",
    loadNumber: "MF-28471",
    purchaseOrderNumber: "PO-7831142",
    billOfLadingNumber: "BOL-28471-MSP",
    proNumber: "MFS-260820-01",
    customerId: "customer-front-range",
    assignedDriverId: "driver-brenna",
    status: "dispatched",
    commodity: "General merchandise",
    weightPounds: 42_000,
    palletCount: 24,
    equipmentType: "dry_van",
    distanceMiles: 414,
    estimatedDurationMinutes: 465,
    charges: {
      linehaulCents: 125_000,
      fuelSurchargeCents: 24_500,
      accessorialsCents: 7_500,
      currency: "USD",
    },
    specialInstructions: "Seal must remain intact except at the scheduled intermediate stop.",
    stops: activeStops,
    events: activeEvents,
    createdAt: "2026-08-19T14:05:00.000Z",
    updatedAt: "2026-08-20T11:45:00.000Z",
  },
  {
    id: "shipment-28492",
    loadNumber: "MF-28492",
    purchaseOrderNumber: "PO-7831299",
    billOfLadingNumber: "BOL-28492-MSP",
    proNumber: "MFS-260821-02",
    customerId: "customer-front-range",
    status: "tendered",
    commodity: "Frozen foods",
    weightPounds: 38_000,
    palletCount: 22,
    equipmentType: "reefer",
    temperatureFahrenheit: -10,
    distanceMiles: 337,
    estimatedDurationMinutes: 390,
    charges: {
      linehaulCents: 142_000,
      fuelSurchargeCents: 27_800,
      accessorialsCents: 0,
      currency: "USD",
    },
    specialInstructions: "Pre-cool trailer to -10°F and record pulp temperature at pickup.",
    stops: [
      {
        id: "stop-28492-pickup",
        sequence: 1,
        type: "pickup",
        status: "pending",
        facilityName: "Front Range Grocery Crossdock",
        facilityReference: "FRG-XD-AURORA",
        address: activeStops[0].address,
        coordinates: activeStops[0].coordinates,
        appointment: {
          startsAt: "2026-08-21T11:00:00.000Z",
          endsAt: "2026-08-21T12:00:00.000Z",
          timeZone: "America/Denver",
        },
        instructions: "Use refrigerated check-in lane and present pre-cool reading.",
        contact: { name: "Cold Storage Office", phone: "+1-303-555-0120" },
      },
      {
        id: "stop-28492-delivery",
        sequence: 2,
        type: "delivery",
        status: "pending",
        facilityName: "Colorado Springs Cold Market",
        facilityReference: "FRG-MKT-COS",
        address: {
          line1: "3650 North Nevada Avenue",
          city: "Colorado Springs",
          state: "CO",
          postalCode: "80907",
          countryCode: "US",
        },
        coordinates: { latitude: 38.8828, longitude: -104.8197 },
        appointment: {
          startsAt: "2026-08-21T19:00:00.000Z",
          endsAt: "2026-08-21T20:00:00.000Z",
          timeZone: "America/Denver",
        },
        instructions: "Back into refrigerated receiving door 2 and keep unit running.",
        contact: { name: "Grocery Receiving", phone: "+1-719-555-0156" },
      },
    ],
    events: [
      createEvent(
        "event-28492-tender",
        "shipment-28492",
        "tender_received",
        "204",
        "system",
        "2026-08-20T12:35:00.000Z",
        "Refrigerated load tender received",
        "tendered",
      ),
    ],
    createdAt: "2026-08-20T12:35:00.000Z",
    updatedAt: "2026-08-20T12:35:00.000Z",
  },
  {
    id: "shipment-28395",
    loadNumber: "MF-28395",
    purchaseOrderNumber: "PO-7829910",
    billOfLadingNumber: "BOL-28395-DEN",
    proNumber: "MFS-260818-04",
    customerId: "customer-front-range",
    assignedDriverId: "driver-brenna",
    status: "delivered",
    commodity: "Home goods",
    weightPounds: 31_600,
    palletCount: 18,
    equipmentType: "dry_van",
    distanceMiles: 74,
    estimatedDurationMinutes: 105,
    charges: {
      linehaulCents: 68_000,
      fuelSurchargeCents: 11_200,
      accessorialsCents: 5_000,
      currency: "USD",
    },
    specialInstructions: "Liftgate service approved. Return signed delivery receipt.",
    stops: [
      {
        id: "stop-28395-pickup",
        sequence: 1,
        type: "pickup",
        status: "completed",
        facilityName: "MF Superior Products Crossdock",
        address: {
          line1: "4850 Colorado Boulevard",
          city: "Denver",
          state: "CO",
          postalCode: "80216",
          countryCode: "US",
        },
        coordinates: { latitude: 39.7843, longitude: -104.9397 },
        appointment: {
          startsAt: "2026-08-18T14:00:00.000Z",
          endsAt: "2026-08-18T15:00:00.000Z",
          timeZone: "America/Denver",
        },
        instructions: "Collect sealed drop trailer 531.",
        arrivedAt: "2026-08-18T13:52:00.000Z",
        completedAt: "2026-08-18T14:28:00.000Z",
      },
      {
        id: "stop-28395-delivery",
        sequence: 2,
        type: "delivery",
        status: "completed",
        facilityName: "Parker Home Goods Receiving",
        facilityReference: "FRG-MKT-PARKER",
        address: {
          line1: "11150 South Twenty Mile Road",
          city: "Parker",
          state: "CO",
          postalCode: "80134",
          countryCode: "US",
        },
        coordinates: { latitude: 39.5148, longitude: -104.7701 },
        appointment: {
          startsAt: "2026-08-18T16:00:00.000Z",
          endsAt: "2026-08-18T17:00:00.000Z",
          timeZone: "America/Denver",
        },
        instructions: "Liftgate delivery at receiving door 1.",
        arrivedAt: "2026-08-18T15:49:00.000Z",
        completedAt: "2026-08-18T16:31:00.000Z",
      },
    ],
    events: [
      createEvent(
        "event-28395-delivered",
        "shipment-28395",
        "delivered",
        "D1",
        "driver",
        "2026-08-18T16:31:00.000Z",
        "Shipment delivered and signed by Casey R.",
        "delivered",
      ),
    ],
    createdAt: "2026-08-17T20:00:00.000Z",
    updatedAt: "2026-08-18T16:31:00.000Z",
  },
];

export function createDemoOperationsState(): DemoOperationsState {
  return {
    version: DEMO_STATE_VERSION,
    session: { accountId: null, effectiveRole: null },
    accounts: accounts.map((account) => ({ ...account })),
    customers: [
      {
        id: "customer-front-range",
        companyName: "Front Range Grocery",
        contact: {
          name: "Jordan Lee",
          phone: "+1-612-555-0204",
          email: DEMO_ACCOUNT_CREDENTIALS.customer.email,
        },
        billingAddress: { ...frontRangeGroceryAddress },
      },
    ],
    drivers: [
      {
        id: "driver-brenna",
        firstName: "Brenna",
        lastName: "Lewis",
        email: DEMO_ACCOUNT_CREDENTIALS.driver.email,
        phone: "+1-720-555-0177",
        licenseNumber: "CO-DMO-48271",
        licenseState: "CO",
        licenseClass: "A",
        status: "on_duty",
        currentLocation: { latitude: 45.0043, longitude: -93.2288 },
        locationUpdatedAt: "2026-08-20T12:56:00.000Z",
      },
      {
        id: "driver-samuel",
        firstName: "Samuel",
        lastName: "Ortiz",
        email: "samuel.ortiz@demo.mfsuperior.com",
        phone: "+1-303-555-0118",
        licenseNumber: "CO-DMO-39120",
        licenseState: "CO",
        licenseClass: "A",
        status: "available",
        currentLocation: { latitude: 39.7747, longitude: -104.9627 },
        locationUpdatedAt: "2026-08-20T12:40:00.000Z",
      },
    ],
    shipments: shipments.map(cloneShipment),
    hosClocks: [
      {
        driverId: "driver-brenna",
        status: "on_duty_not_driving",
        statusStartedAt: "2026-08-20T12:45:00.000Z",
        drivingMinutesUsed: 215,
        shiftMinutesUsed: 270,
        cycleMinutesUsed: 1_480,
        minutesSinceQualifyingBreak: 215,
        offDutyMinutesToday: 605,
        breaksTakenToday: 1,
        entries: [
          {
            id: "hos-entry-1",
            driverId: "driver-brenna",
            status: "off_duty",
            startedAt: "2026-08-19T23:00:00.000Z",
            endedAt: "2026-08-20T09:05:00.000Z",
            durationMinutes: 605,
            locationDescription: "Minneapolis, MN",
            isSimulated: true,
          },
          {
            id: "hos-entry-2",
            driverId: "driver-brenna",
            status: "driving",
            startedAt: "2026-08-20T09:10:00.000Z",
            endedAt: "2026-08-20T12:45:00.000Z",
            durationMinutes: 215,
            locationDescription: "Minneapolis, MN",
            note: "Repositioned equipment and completed pre-trip route.",
            isSimulated: true,
          },
        ],
      },
    ],
    exceptions: [
      {
        id: "exception-28372",
        shipmentId: "shipment-28395",
        category: "delay",
        severity: "low",
        status: "resolved",
        description: "Receiving door unavailable at appointment time.",
        resolutionNote: "Receiver opened door 1 after a 14-minute delay.",
        reportedByAccountId: "account-driver",
        reportedAt: "2026-08-18T15:53:00.000Z",
        resolvedAt: "2026-08-18T16:07:00.000Z",
        attachmentUris: [],
      },
    ],
    proofsOfDelivery: [
      {
        id: "pod-28395",
        shipmentId: "shipment-28395",
        stopId: "stop-28395-delivery",
        status: "accepted",
        recipientName: "Casey R.",
        signatureData: "demo-signature://casey-r",
        notes: "18 pallets received in good condition.",
        attachments: [
          {
            id: "attachment-28395-1",
            kind: "photo",
            uri: "demo-photo://shipment-28395-delivery",
            name: "Delivered freight",
          },
        ],
        submittedByAccountId: "account-driver",
        submittedAt: "2026-08-18T16:31:00.000Z",
      },
    ],
    messages: [
      {
        id: "message-1",
        threadId: "thread-shipment-28471",
        threadKind: "shipment",
        shipmentId: "shipment-28471",
        senderAccountId: "account-admin",
        recipientAccountIds: ["account-driver"],
        body: "Trailer 531 is ready at the carrier lot. Seal number is in the load notes.",
        sentAt: "2026-08-20T11:48:00.000Z",
        readByAccountIds: ["account-admin", "account-driver"],
      },
      {
        id: "message-2",
        threadId: "thread-shipment-28471",
        threadKind: "shipment",
        shipmentId: "shipment-28471",
        senderAccountId: "account-driver",
        recipientAccountIds: ["account-admin"],
        body: "Copy. Pre-trip is complete and I am heading to the DC gate.",
        sentAt: "2026-08-20T12:52:00.000Z",
        readByAccountIds: ["account-driver"],
      },
    ],
    ediTransactions: [
      {
        id: "edi-28471-204",
        shipmentId: "shipment-28471",
        transactionType: "204",
        direction: "inbound",
        status: "received",
        senderId: "SHIPPER-DEMO",
        receiverId: "MFS-DEMO",
        controlNumber: "000028471",
        summary: "Motor carrier load tender",
        createdAt: "2026-08-19T14:05:00.000Z",
        isSimulated: true,
      },
      {
        id: "edi-28471-990",
        shipmentId: "shipment-28471",
        transactionType: "990",
        direction: "outbound",
        status: "acknowledged",
        senderId: "MFS-DEMO",
        receiverId: "SHIPPER-DEMO",
        controlNumber: "000028472",
        summary: "Load tender acceptance",
        createdAt: "2026-08-19T14:22:00.000Z",
        acknowledgedAt: "2026-08-19T14:23:00.000Z",
        isSimulated: true,
      },
      {
        id: "edi-28395-214",
        shipmentId: "shipment-28395",
        transactionType: "214",
        direction: "outbound",
        status: "acknowledged",
        senderId: "MFS-DEMO",
        receiverId: "SHIPPER-DEMO",
        controlNumber: "000028395",
        summary: "Delivered shipment status",
        createdAt: "2026-08-18T16:32:00.000Z",
        acknowledgedAt: "2026-08-18T16:34:00.000Z",
        isSimulated: true,
      },
      {
        id: "edi-28395-210",
        shipmentId: "shipment-28395",
        transactionType: "210",
        direction: "outbound",
        status: "generated",
        senderId: "MFS-DEMO",
        receiverId: "SHIPPER-DEMO",
        controlNumber: "000028396",
        summary: "Motor carrier freight invoice",
        createdAt: "2026-08-19T15:00:00.000Z",
        isSimulated: true,
      },
      {
        id: "edi-28395-997",
        shipmentId: "shipment-28395",
        transactionType: "997",
        direction: "inbound",
        status: "received",
        senderId: "SHIPPER-DEMO",
        receiverId: "MFS-DEMO",
        controlNumber: "000028397",
        summary: "Functional acknowledgement",
        createdAt: "2026-08-19T15:02:00.000Z",
        isSimulated: true,
      },
      {
        id: "edi-28492-204",
        shipmentId: "shipment-28492",
        transactionType: "204",
        direction: "inbound",
        status: "received",
        senderId: "SHIPPER-DEMO",
        receiverId: "MFS-DEMO",
        controlNumber: "000028492",
        summary: "Refrigerated load tender",
        createdAt: "2026-08-20T12:35:00.000Z",
        isSimulated: true,
      },
    ],
    requests: [
      {
        id: "request-1",
        customerId: "customer-front-range",
        type: "quote",
        status: "reviewing",
        subject: "Denver to Pueblo weekly replenishment",
        details: "Quote five dry-van loads per week beginning September 1.",
        requestedAt: "2026-08-19T16:00:00.000Z",
        updatedAt: "2026-08-20T09:15:00.000Z",
      },
      {
        id: "request-2",
        customerId: "customer-front-range",
        shipmentId: "shipment-28471",
        type: "delivery",
        status: "scheduled",
        subject: "Confirm Chicago appointment",
        details: "Receiving confirmed the 5:00–6:00 PM CDT appointment window.",
        requestedAt: "2026-08-19T20:00:00.000Z",
        updatedAt: "2026-08-20T10:20:00.000Z",
      },
    ],
    quotes: [
      {
        id: "quote-1042",
        quoteNumber: "Q-2026-1042",
        customerId: "customer-front-range",
        requestId: "request-1",
        status: "draft",
        origin: {
          line1: "4850 Colorado Boulevard",
          city: "Denver",
          state: "CO",
          postalCode: "80216",
          countryCode: "US",
        },
        destination: {
          line1: "3300 Dillon Drive",
          city: "Pueblo",
          state: "CO",
          postalCode: "81008",
          countryCode: "US",
        },
        equipmentType: "dry_van",
        commodity: "General merchandise",
        estimatedDistanceMiles: 118,
        charges: {
          linehaulCents: 74_000,
          fuelSurchargeCents: 12_500,
          accessorialsCents: 0,
          currency: "USD",
        },
        totalCents: 86_500,
        createdAt: "2026-08-20T09:15:00.000Z",
        expiresAt: "2026-08-27T09:15:00.000Z",
      },
    ],
    integrations: [
      {
        id: "integration-x12-boundary",
        name: "Generic X12 boundary",
        status: "not_configured",
        summary: "204, 990, 214, 210, and 997 contracts are available after partner onboarding.",
        lastCheckedAt: FIXTURE_NOW,
        isSimulation: true,
      },
      {
        id: "integration-driver-gps",
        name: "Driver GPS",
        status: "not_configured",
        summary: "Location updates queue locally until a production session is connected.",
        lastCheckedAt: FIXTURE_NOW,
        isSimulation: true,
      },
      {
        id: "integration-partner-production",
        name: "Partner production connection",
        status: "not_configured",
        summary: "Production credentials and certification have not been configured.",
        lastCheckedAt: FIXTURE_NOW,
        isSimulation: false,
      },
    ],
    updatedAt: FIXTURE_NOW,
  };
}

function createEvent(
  id: string,
  shipmentId: string,
  type: ShipmentEvent["type"],
  eventCode: string,
  source: ShipmentEvent["source"],
  occurredAt: string,
  description: string,
  resultingStatus: ShipmentEvent["resultingStatus"],
): ShipmentEvent {
  return {
    id,
    shipmentId,
    type,
    eventCode,
    source,
    occurredAt,
    description,
    resultingStatus,
    isSimulated: true,
  };
}

function cloneShipment(shipment: Shipment): Shipment {
  return {
    ...shipment,
    charges: { ...shipment.charges },
    stops: shipment.stops.map((stop) => ({
      ...stop,
      address: { ...stop.address },
      coordinates: { ...stop.coordinates },
      appointment: { ...stop.appointment },
      contact: stop.contact ? { ...stop.contact } : undefined,
    })),
    events: shipment.events.map((event) => ({
      ...event,
      coordinates: event.coordinates ? { ...event.coordinates } : undefined,
    })),
  };
}

/**
 * The fixture timeline is anchored to a fixed date so tests stay deterministic.
 * A running demo, though, should always look current: without this the schedule
 * drifts further into the past every day until "Today" is permanently empty.
 *
 * The shift is a whole number of days, so every time-of-day and every gap
 * between records is preserved exactly — only the calendar dates move, placing
 * the fixture's "today" on the real today.
 */
const ISO_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Counted in **local** calendar days, because every screen groups by local
 * date. Measuring in UTC days lands the fixture's "today" on tomorrow for any
 * timezone behind UTC.
 */
export function demoDayOffset(now: Date, anchor: string = FIXTURE_NOW): number {
  const localMidnight = (d: Date) =>
    Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / MS_PER_DAY;
  return localMidnight(now) - localMidnight(new Date(anchor));
}

function shiftIso(value: string, days: number): string {
  return new Date(new Date(value).getTime() + days * MS_PER_DAY).toISOString();
}

function shiftDeep<T>(value: T, days: number): T {
  if (typeof value === "string") {
    return (ISO_TIMESTAMP.test(value) ? shiftIso(value, days) : value) as T;
  }
  if (Array.isArray(value)) {
    return value.map((entry) => shiftDeep(entry, days)) as unknown as T;
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, entry]) => [
        key,
        shiftDeep(entry, days),
      ]),
    ) as T;
  }
  return value;
}

/**
 * Returns the state with every fixture timestamp moved onto the current day.
 * A zero offset returns the input untouched, so tests that pin the clock to the
 * fixture anchor see exactly the canonical data.
 */
export function anchorDemoStateTo(
  state: DemoOperationsState,
  now: Date = new Date(),
): DemoOperationsState {
  const days = demoDayOffset(now);
  if (days === 0) return state;
  return shiftDeep(state, days);
}

/**
 * Re-anchors already-persisted demo state onto the current day.
 *
 * `anchorDemoStateTo` only helps state built fresh; a demo that is saved and
 * then reopened after midnight would drift back into the past. The offset that
 * was originally applied is recoverable without storing it, because
 * `createDemoOperationsState` is deterministic: comparing a persisted
 * appointment against its canonical counterpart gives the shift exactly.
 *
 * Appointment windows are read-only in the demo — status changes and events
 * move, appointments do not — so they are a stable reference point.
 */
export function reanchorDemoState(
  persisted: DemoOperationsState,
  now: Date = new Date(),
): DemoOperationsState {
  const canonical = createDemoOperationsState();
  const reference = canonical.shipments[0];
  const saved = reference
    ? persisted.shipments.find((shipment) => shipment.id === reference.id)
    : undefined;
  const canonicalAt = reference?.stops[0]?.appointment.startsAt;
  const savedAt = saved?.stops[0]?.appointment.startsAt;
  if (!canonicalAt || !savedAt) return persisted;

  const appliedDays = Math.round(
    (new Date(savedAt).getTime() - new Date(canonicalAt).getTime()) / MS_PER_DAY,
  );
  const wantedDays = demoDayOffset(now);
  const delta = wantedDays - appliedDays;
  if (delta === 0) return persisted;
  return shiftDeep(persisted, delta);
}
