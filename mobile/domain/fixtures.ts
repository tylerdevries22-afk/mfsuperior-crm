import type {
  AvailabilityBlock,
  AvailabilityRule,
  ComplianceDocument,
  DemoAccount,
  DemoOperationsState,
  MaintenanceOrder,
  Payout,
  PostalAddress,
  Shipment,
  ShipmentEvent,
  ShipmentStop,
  Vehicle,
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

/**
 * The demo fleet. Two tractors and two trailers is the smallest set that still
 * shows every state the fleet screens have to render: an assigned unit, a unit
 * in the shop behind an open repair, and a spare with no driver on it.
 */
const vehicles: readonly Vehicle[] = [
  {
    id: "vehicle-t101",
    unitNumber: "T-101",
    type: "tractor",
    vin: "1FUJGLDR8CLBP8834",
    make: "Freightliner",
    model: "Cascadia",
    year: 2022,
    plateNumber: "CO-77412",
    plateState: "CO",
    status: "active",
    odometerMiles: 412_880,
    assignedDriverId: "driver-brenna",
    createdAt: "2026-01-12T15:00:00.000Z",
    updatedAt: "2026-08-20T12:44:00.000Z",
  },
  {
    id: "vehicle-t102",
    unitNumber: "T-102",
    type: "tractor",
    vin: "3AKJHHDR9LSLL4471",
    make: "Kenworth",
    model: "T680",
    year: 2021,
    plateNumber: "CO-77518",
    plateState: "CO",
    status: "in_shop",
    odometerMiles: 507_210,
    assignedDriverId: "driver-alicia",
    createdAt: "2026-01-12T15:00:00.000Z",
    updatedAt: "2026-08-19T21:10:00.000Z",
  },
  {
    id: "vehicle-tr220",
    unitNumber: "TR-220",
    type: "trailer",
    vin: "1UYVS2537NU221004",
    make: "Utility",
    model: "3000R Reefer",
    year: 2023,
    plateNumber: "CO-91220",
    plateState: "CO",
    status: "active",
    odometerMiles: 96_440,
    assignedDriverId: "driver-ray",
    createdAt: "2026-02-02T15:00:00.000Z",
    updatedAt: "2026-08-20T11:02:00.000Z",
  },
  {
    id: "vehicle-tr221",
    unitNumber: "TR-221",
    type: "trailer",
    vin: "1JJV532D8PL221880",
    make: "Wabash",
    model: "DuraPlate Dry Van",
    year: 2020,
    plateNumber: "CO-91221",
    plateState: "CO",
    status: "active",
    odometerMiles: 148_905,
    createdAt: "2026-02-02T15:00:00.000Z",
    updatedAt: "2026-08-15T18:30:00.000Z",
  },
];

/**
 * Concrete calendar spans. These sit close to the fixture clock on purpose so
 * the availability month always opens on a week that has something in it.
 */
const availabilityBlocks: readonly AvailabilityBlock[] = [
  {
    id: "availability-brenna-time-off",
    driverId: "driver-brenna",
    startsAt: "2026-08-22T06:00:00.000Z",
    endsAt: "2026-08-23T05:59:00.000Z",
    kind: "time_off",
    note: "Family commitment — no dispatch.",
    createdAt: "2026-08-14T17:20:00.000Z",
    updatedAt: "2026-08-14T17:20:00.000Z",
  },
  {
    id: "availability-brenna-morning",
    driverId: "driver-brenna",
    startsAt: "2026-08-21T06:00:00.000Z",
    endsAt: "2026-08-21T18:00:00.000Z",
    kind: "unavailable",
    note: "Medical appointment.",
    createdAt: "2026-08-17T14:05:00.000Z",
    updatedAt: "2026-08-17T14:05:00.000Z",
  },
  {
    id: "availability-samuel-preferred",
    driverId: "driver-samuel",
    startsAt: "2026-08-21T12:00:00.000Z",
    endsAt: "2026-08-22T02:00:00.000Z",
    kind: "preferred",
    note: "Prefers long-haul departures after noon.",
    createdAt: "2026-08-16T19:40:00.000Z",
    updatedAt: "2026-08-16T19:40:00.000Z",
  },
  {
    id: "availability-alicia-time-off",
    driverId: "driver-alicia",
    startsAt: "2026-08-24T06:00:00.000Z",
    endsAt: "2026-08-27T05:59:00.000Z",
    kind: "time_off",
    note: "Scheduled PTO.",
    createdAt: "2026-07-30T16:00:00.000Z",
    updatedAt: "2026-07-30T16:00:00.000Z",
  },
  {
    id: "availability-kenji-available",
    driverId: "driver-kenji",
    startsAt: "2026-08-20T12:00:00.000Z",
    endsAt: "2026-08-21T04:00:00.000Z",
    kind: "available",
    createdAt: "2026-08-19T22:15:00.000Z",
    updatedAt: "2026-08-19T22:15:00.000Z",
  },
];

/** Standing weekly patterns the calendar expands over any visible range. */
const availabilityRules: readonly AvailabilityRule[] = [
  {
    id: "availability-rule-brenna-sunday",
    driverId: "driver-brenna",
    weekday: 0,
    startMinute: 0,
    endMinute: 1_440,
    kind: "unavailable",
    effectiveFrom: "2026-06-01T06:00:00.000Z",
    createdAt: "2026-05-28T15:00:00.000Z",
    updatedAt: "2026-05-28T15:00:00.000Z",
  },
  {
    id: "availability-rule-samuel-saturday",
    driverId: "driver-samuel",
    weekday: 6,
    startMinute: 0,
    endMinute: 1_440,
    kind: "unavailable",
    effectiveFrom: "2026-06-01T06:00:00.000Z",
    createdAt: "2026-05-28T15:00:00.000Z",
    updatedAt: "2026-05-28T15:00:00.000Z",
  },
];

const maintenanceOrders: readonly MaintenanceOrder[] = [
  {
    id: "maintenance-t102-aftertreatment",
    vehicleId: "vehicle-t102",
    kind: "repair",
    status: "in_progress",
    severity: "high",
    summary: "Aftertreatment fault — derate warning",
    description:
      "Driver reported a dash derate warning north of Pueblo. Unit towed to the Denver shop for aftertreatment diagnosis.",
    openedAt: "2026-08-19T20:35:00.000Z",
    odometerMiles: 507_210,
    vendorName: "Rocky Mountain Truck Service",
    reportedByDriverId: "driver-alicia",
    updatedAt: "2026-08-20T09:15:00.000Z",
  },
  {
    id: "maintenance-t101-pm-a",
    vehicleId: "vehicle-t101",
    kind: "preventive",
    status: "scheduled",
    severity: "low",
    summary: "PM-A service — 415,000 mi interval",
    description: "Oil, filters, chassis lube, and a full brake measurement.",
    openedAt: "2026-08-12T16:00:00.000Z",
    scheduledFor: "2026-08-26T14:00:00.000Z",
    odometerMiles: 412_880,
    vendorName: "MF Superior Shop",
    costCents: 68_500,
    updatedAt: "2026-08-12T16:00:00.000Z",
  },
  {
    id: "maintenance-tr220-inspection",
    vehicleId: "vehicle-tr220",
    kind: "inspection",
    status: "completed",
    severity: "medium",
    summary: "Annual DOT inspection",
    description: "Reefer unit, brakes, and lighting passed. Replaced two marker lamps.",
    openedAt: "2026-07-28T15:00:00.000Z",
    completedAt: "2026-07-29T18:40:00.000Z",
    odometerMiles: 94_120,
    vendorName: "Front Range Trailer",
    costCents: 41_200,
    updatedAt: "2026-07-29T18:40:00.000Z",
  },
];

/**
 * Expiries are staggered across every bucket the licensing screen renders:
 * one already expired, two inside thirty days, one inside ninety, and the rest
 * comfortably clear.
 *
 * These are calendar dates rather than instants, so they are stamped at midday
 * UTC. Midnight UTC lands on the previous local day everywhere west of
 * Greenwich, which would show a registration as expiring a day early for every
 * driver in the fleet.
 */
const complianceDocuments: readonly ComplianceDocument[] = [
  {
    id: "compliance-t101-registration",
    subjectType: "vehicle",
    subjectId: "vehicle-t101",
    kind: "registration",
    identifier: "CO-77412",
    issuingState: "CO",
    issuedOn: "2025-09-01T12:00:00.000Z",
    expiresOn: "2026-09-01T12:00:00.000Z",
    updatedAt: "2025-09-01T00:00:00.000Z",
  },
  {
    id: "compliance-t101-inspection",
    subjectType: "vehicle",
    subjectId: "vehicle-t101",
    kind: "annual_inspection",
    identifier: "INSP-2026-1180",
    issuingState: "CO",
    issuedOn: "2026-03-15T12:00:00.000Z",
    expiresOn: "2027-03-15T12:00:00.000Z",
    updatedAt: "2026-03-15T00:00:00.000Z",
  },
  {
    id: "compliance-t102-registration",
    subjectType: "vehicle",
    subjectId: "vehicle-t102",
    kind: "registration",
    identifier: "CO-77518",
    issuingState: "CO",
    issuedOn: "2025-11-30T12:00:00.000Z",
    expiresOn: "2026-11-30T12:00:00.000Z",
    updatedAt: "2025-11-30T00:00:00.000Z",
  },
  {
    id: "compliance-tr220-registration",
    subjectType: "vehicle",
    subjectId: "vehicle-tr220",
    kind: "registration",
    identifier: "CO-91220",
    issuingState: "CO",
    issuedOn: "2025-12-15T12:00:00.000Z",
    expiresOn: "2026-12-15T12:00:00.000Z",
    updatedAt: "2025-12-15T00:00:00.000Z",
  },
  {
    id: "compliance-tr221-inspection",
    subjectType: "vehicle",
    subjectId: "vehicle-tr221",
    kind: "annual_inspection",
    identifier: "INSP-2025-0904",
    issuingState: "CO",
    issuedOn: "2025-10-05T12:00:00.000Z",
    expiresOn: "2026-10-05T12:00:00.000Z",
    updatedAt: "2025-10-05T00:00:00.000Z",
  },
  {
    id: "compliance-brenna-cdl",
    subjectType: "driver",
    subjectId: "driver-brenna",
    kind: "cdl",
    identifier: "CO-DMO-48271",
    issuingState: "CO",
    issuedOn: "2024-04-12T12:00:00.000Z",
    expiresOn: "2028-04-12T12:00:00.000Z",
    updatedAt: "2024-04-12T00:00:00.000Z",
  },
  {
    id: "compliance-brenna-medical",
    subjectType: "driver",
    subjectId: "driver-brenna",
    kind: "medical_card",
    identifier: "MED-2024-55190",
    issuingState: "CO",
    issuedOn: "2024-09-14T12:00:00.000Z",
    expiresOn: "2026-09-14T12:00:00.000Z",
    updatedAt: "2024-09-14T00:00:00.000Z",
  },
  {
    id: "compliance-ray-cdl",
    subjectType: "driver",
    subjectId: "driver-ray",
    kind: "cdl",
    identifier: "CO-DMO-51884",
    issuingState: "CO",
    issuedOn: "2023-07-01T12:00:00.000Z",
    expiresOn: "2027-07-01T12:00:00.000Z",
    updatedAt: "2023-07-01T00:00:00.000Z",
  },
  {
    id: "compliance-kenji-hazmat",
    subjectType: "driver",
    subjectId: "driver-kenji",
    kind: "hazmat_endorsement",
    identifier: "HME-2021-33017",
    issuingState: "CO",
    issuedOn: "2021-08-18T12:00:00.000Z",
    expiresOn: "2026-08-18T12:00:00.000Z",
    updatedAt: "2021-08-18T00:00:00.000Z",
  },
];

/**
 * Two closed settlement periods, both prior to the week the fixture clock sits
 * in. The one delivered load lands on Tuesday of the current week and is
 * deliberately left unsettled, so the admin console always has a real period
 * to issue and the driver always has something genuinely outstanding.
 *
 * Line items always sum to `netCents`, because deductions carry negative
 * amounts.
 */
const payouts: readonly Payout[] = [
  {
    id: "payout-2026-w31",
    driverId: "driver-brenna",
    periodStart: "2026-08-02T06:00:00.000Z",
    periodEnd: "2026-08-09T05:59:00.000Z",
    status: "paid",
    grossCents: 294_820,
    deductionCents: 31_240,
    netCents: 263_580,
    rail: "venmo",
    issuedAt: "2026-08-09T16:00:00.000Z",
    paidAt: "2026-08-10T15:12:00.000Z",
    lineItems: [
      {
        id: "payout-line-w31-linehaul-front-range",
        kind: "linehaul",
        description: "Front Range regional runs · 1,014 mi",
        amountCents: 124_200,
      },
      {
        id: "payout-line-w31-linehaul-corridor",
        kind: "linehaul",
        description: "I-25 corridor runs · 1,132 mi",
        amountCents: 150_620,
      },
      {
        id: "payout-line-w31-detention",
        kind: "detention",
        description: "Detention at Front Range Grocery · 2.0 hr",
        amountCents: 20_000,
      },
      {
        id: "payout-line-w31-advance",
        kind: "advance",
        description: "Fuel advance repayment",
        amountCents: -25_000,
      },
      {
        id: "payout-line-w31-occupational",
        kind: "deduction",
        description: "Occupational accident coverage",
        amountCents: -6_240,
      },
    ],
    createdAt: "2026-08-09T16:00:00.000Z",
    updatedAt: "2026-08-10T15:12:00.000Z",
  },
  {
    id: "payout-2026-w32",
    driverId: "driver-brenna",
    periodStart: "2026-08-09T06:00:00.000Z",
    periodEnd: "2026-08-16T05:59:00.000Z",
    status: "pending",
    grossCents: 146_350,
    deductionCents: 6_240,
    netCents: 140_110,
    issuedAt: "2026-08-16T06:00:00.000Z",
    lineItems: [
      {
        id: "payout-line-w32-linehaul",
        kind: "linehaul",
        description: "Denver to Colorado Springs turns · 1,034 mi",
        amountCents: 137_800,
      },
      {
        id: "payout-line-w32-lumper",
        kind: "accessorial",
        description: "Lumper receipt · Aurora DC",
        amountCents: 8_550,
      },
      {
        id: "payout-line-w32-occupational",
        kind: "deduction",
        description: "Occupational accident coverage",
        amountCents: -6_240,
      },
    ],
    createdAt: "2026-08-16T06:00:00.000Z",
    updatedAt: "2026-08-16T06:00:00.000Z",
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
        currentLocation: { latitude: 39.7392, longitude: -104.9903 },
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
      {
        id: "driver-alicia",
        firstName: "Alicia",
        lastName: "Monroe",
        email: "alicia.monroe@demo.mfsuperior.com",
        phone: "+1-303-555-0142",
        licenseNumber: "CO-DMO-51884",
        licenseState: "CO",
        licenseClass: "A",
        status: "on_duty",
        currentLocation: { latitude: 39.5501, longitude: -105.7821 },
        locationUpdatedAt: "2026-08-20T12:48:00.000Z",
      },
      {
        id: "driver-ray",
        firstName: "Ray",
        lastName: "Whitfield",
        email: "ray.whitfield@demo.mfsuperior.com",
        phone: "+1-719-555-0163",
        licenseNumber: "CO-DMO-40217",
        licenseState: "CO",
        licenseClass: "A",
        status: "on_duty",
        currentLocation: { latitude: 38.8339, longitude: -104.8214 },
        locationUpdatedAt: "2026-08-20T12:51:00.000Z",
      },
      {
        id: "driver-kenji",
        firstName: "Kenji",
        lastName: "Watanabe",
        email: "kenji.watanabe@demo.mfsuperior.com",
        phone: "+1-970-555-0198",
        licenseNumber: "CO-DMO-46630",
        licenseState: "CO",
        licenseClass: "A",
        status: "available",
        currentLocation: { latitude: 40.5853, longitude: -105.0844 },
        locationUpdatedAt: "2026-08-20T12:44:00.000Z",
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
    vehicles: vehicles.map((vehicle) => ({ ...vehicle })),
    availabilityBlocks: availabilityBlocks.map((block) => ({ ...block })),
    availabilityRules: availabilityRules.map((rule) => ({ ...rule })),
    maintenanceOrders: maintenanceOrders.map((order) => ({ ...order })),
    complianceDocuments: complianceDocuments.map((document) => ({ ...document })),
    payouts: payouts.map((payout) => ({
      ...payout,
      lineItems: payout.lineItems.map((lineItem) => ({ ...lineItem })),
    })),
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
