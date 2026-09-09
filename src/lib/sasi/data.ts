import type {
  ActivityEvent,
  AppNotification,
  EvidenceItem,
  Finding,
  Incident,
  SasiCase,
  SasiSource,
  ServiceKey,
} from "./types";

/* ============================================================
   SASI demo dataset — one coherent, clearly-labelled dataset.
   Every record carries isDemo: true. Nothing here is real.
   ============================================================ */

/** Demo clock: anchored to the live session so relative times always read fresh.
 *  Safe for hydration: nothing time-relative renders before the mounted splash gate. */
const NOW = Date.now();

function ago(minutes: number): string {
  return new Date(NOW - minutes * 60000).toISOString();
}
function ahead(minutes: number): string {
  return new Date(NOW + minutes * 60000).toISOString();
}

export const DEMO_NOW = new Date(NOW).toISOString();

export const DEMO_USER = {
  name: "Thabo Mokoena",
  firstName: "Thabo",
  email: "thabo.mokoena@demo.sasi.org.za",
  memberSince: "2025-11-03",
  location: {
    province: "Gauteng",
    municipality: "City of Johannesburg",
    city: "Johannesburg",
    suburb: "Melrose",
    ward: "Ward 74",
  },
  isDemo: true as const,
};

/* ---------- SOURCES ---------- */

export const SOURCES: SasiSource[] = [
  {
    id: "SRC-101",
    title: "Planned maintenance notice — bulk water supply, northern network",
    publisher: "Johannesburg Water (demo reference)",
    sourceType: "OFFICIAL",
    publishedAt: ago(29 * 60 * 26),
    retrievedAt: ago(9 * 60 + 40),
    verification: "CONFIRMED",
    confidence: "HIGH",
    snippet:
      "Scheduled maintenance on the bulk supply system may cause interruptions in northern suburbs. (Demo reference notice — not a real publication.)",
    isDemo: true,
  },
  {
    id: "SRC-102",
    title: "Residents report outages across northern suburbs",
    publisher: "Daily civic news feed (demo reference)",
    sourceType: "NEWS",
    publishedAt: ago(6 * 60 * 5),
    retrievedAt: ago(8 * 60 + 55),
    verification: "REPORTED",
    confidence: "MEDIUM",
    snippet:
      "Multiple resident reports of tap water running dry since yesterday evening. (Demo reference article — not a real publication.)",
    isDemo: true,
  },
  {
    id: "SRC-103",
    title: "Hotline call reference — outage reported for the area",
    publisher: "You (user provided)",
    sourceType: "USER_PROVIDED",
    retrievedAt: ago(7 * 60 + 5),
    verification: "REPORTED",
    confidence: "MEDIUM",
    snippet: "Reference number captured from your municipal hotline call. (Demo.)",
    isDemo: true,
  },
  {
    id: "SRC-104",
    title: "Reservoir level telemetry — area supply zone",
    publisher: "Open data portal (demo reference)",
    sourceType: "DATABASE",
    publishedAt: ago(3 * 60 * 2),
    retrievedAt: ago(6 * 60 + 12),
    verification: "CONFIRMED",
    confidence: "HIGH",
    snippet: "Levels trending down overnight, consistent with a supply interruption. (Demo reference data.)",
    isDemo: true,
  },
  {
    id: "SRC-201",
    title: "Pressure advisory — low pressure in southern zones",
    publisher: "Johannesburg Water (demo reference)",
    sourceType: "OFFICIAL",
    publishedAt: ago(40 * 60 * 22),
    retrievedAt: ago(30 * 60 * 12),
    verification: "CONFIRMED",
    confidence: "HIGH",
    snippet: "Advisory of reduced pressure while a pressure-reducing valve is repaired. (Demo reference.)",
    isDemo: true,
  },
  {
    id: "SRC-301",
    title: "Streetlight fault logged with ward office",
    publisher: "Ward office note (demo reference)",
    sourceType: "DOCUMENT",
    publishedAt: ago(9 * 60 * 24 * 4),
    retrievedAt: ago(9 * 60 * 24 * 2),
    verification: "REPORTED",
    confidence: "MEDIUM",
    snippet: "Fault logged and assigned a reference. (Demo reference.)",
    isDemo: true,
  },
];

/* ---------- CASES ---------- */

export const CASES: SasiCase[] = [
  {
    id: "case-123",
    ref: "CASE-000123",
    title: "No water since yesterday evening",
    description:
      "Tap water stopped flowing around 19:30 yesterday. Neighbours on the same street report the same. Municipal hotline gave a reference but no restoration time.",
    service: "water",
    location: {
      province: "Gauteng",
      municipality: "City of Johannesburg",
      city: "Johannesburg",
      suburb: "Melrose",
      ward: "Ward 74",
      lat: -26.14,
      lng: 28.11,
      mapX: 53,
      mapY: 56,
    },
    status: "INVESTIGATING",
    priority: "HIGH",
    createdAt: ago(10 * 60 + 2),
    updatedAt: ago(11),
    aiState: "RESEARCHING",
    impact:
      "Household without water for cooking and sanitation. Two neighbouring homes affected.",
    isDemo: true,
    events: [
      {
        id: "ev-1",
        at: ago(10 * 60 + 2),
        label: "Report received",
        detail: "You told SASI the water has been off since yesterday evening.",
        kind: "user",
      },
      {
        id: "ev-2",
        at: ago(10 * 60),
        label: "Location identified",
        detail: "Melrose, Johannesburg — Ward 74. Service: Water.",
        kind: "ai",
        agent: "Investigation Agent",
      },
      {
        id: "ev-3",
        at: ago(9 * 60 + 44),
        label: "2 relevant official sources found",
        detail: "Maintenance notice and reservoir telemetry matched to your area.",
        kind: "source",
        agent: "Research Agent",
      },
      {
        id: "ev-4",
        at: ago(9 * 60 + 40),
        label: "Evidence reviewed",
        detail: "2 photos you provided were processed.",
        kind: "evidence",
        agent: "Evidence Agent",
      },
      {
        id: "ev-5",
        at: ago(8 * 60 + 55),
        label: "Community reports corroborated",
        detail: "News reports confirm outages across nearby suburbs.",
        kind: "source",
        agent: "Research Agent",
      },
      {
        id: "ev-6",
        at: ago(6 * 60 + 20),
        label: "Finding generated",
        detail: "Outage consistent with planned bulk maintenance (AI-inferred, medium confidence).",
        kind: "finding",
        agent: "Investigation Agent",
      },
      {
        id: "ev-7",
        at: ago(12),
        label: "Recommended next step prepared",
        detail: "SASI prepared a service report to the municipal water utility for your review.",
        kind: "ai",
        agent: "Government Navigator Agent",
      },
    ],
    proposedAction: {
      id: "act-1",
      title: "Submit a water service report to the municipal utility",
      rationale:
        "An official report creates a traceable reference and links your case to the maintenance notice already identified.",
      whatHappens:
        "SASI will prepare a structured service report using your description, location and evidence, and submit it through the utility's public reporting channel.",
      infoShared:
        "Your description, suburb, ward, evidence photos and contact reference. Your email is not shared without approval.",
      recipient: "Johannesburg Water public reporting channel (via official pathway)",
      state: "PROPOSED",
      createdAt: ago(12),
    },
    verification: {
      state: "PENDING",
      detail: "Verification will start once the approved action is completed.",
    },
  },
  {
    id: "case-118",
    ref: "CASE-000118",
    title: "Low water pressure for two weeks",
    description:
      "Pressure drops severely every morning between 05:00 and 08:00. Advisory exists but the repair seems delayed.",
    service: "water",
    location: {
      province: "Gauteng",
      municipality: "City of Johannesburg",
      city: "Johannesburg",
      suburb: "Soweto",
      ward: "Ward 13",
      lat: -26.27,
      lng: 27.86,
      mapX: 41,
      mapY: 70,
    },
    status: "ACTION_REQUIRED",
    priority: "MEDIUM",
    createdAt: ago(60 * 24 * 9),
    updatedAt: ago(60 * 26),
    aiState: "WAITING_FOR_APPROVAL",
    impact: "Morning routines severely affected; elderly resident in the home.",
    isDemo: true,
    events: [
      {
        id: "ev-11",
        at: ago(60 * 24 * 9),
        label: "Report received",
        kind: "user",
      },
      {
        id: "ev-12",
        at: ago(60 * 24 * 9 - 8),
        label: "Official advisory matched",
        detail: "Pressure advisory found for your zone.",
        kind: "source",
        agent: "Research Agent",
      },
      {
        id: "ev-13",
        at: ago(60 * 26),
        label: "Follow-up recommended",
        detail: "No restoration update after 8 days. SASI prepared a follow-up enquiry.",
        kind: "ai",
        agent: "Follow-up Agent",
      },
    ],
    proposedAction: {
      id: "act-2",
      title: "Send a follow-up enquiry about the pressure repair",
      rationale: "The advisory is 9 days old with no progress update on record.",
      whatHappens: "SASI will prepare a polite follow-up referencing the original advisory and your case log.",
      infoShared: "Case reference, suburb and issue description.",
      recipient: "Municipal water services public enquiries channel",
      state: "PROPOSED",
      createdAt: ago(60 * 26),
    },
  },
  {
    id: "case-104",
    ref: "CASE-000104",
    title: "Streetlight outage on a main road",
    description: "Four streetlights out for two weeks on a busy stretch. Ward office logged a fault.",
    service: "electricity",
    location: {
      province: "Gauteng",
      municipality: "City of Johannesburg",
      city: "Johannesburg",
      suburb: "Rosebank",
      ward: "Ward 73",
      lat: -26.15,
      lng: 28.04,
      mapX: 49,
      mapY: 54,
    },
    status: "WAITING",
    priority: "LOW",
    createdAt: ago(60 * 24 * 14),
    updatedAt: ago(60 * 24 * 2),
    aiState: "IDLE",
    impact: "Reduced visibility at night for pedestrians.",
    isDemo: true,
    events: [
      { id: "ev-21", at: ago(60 * 24 * 14), label: "Report received", kind: "user" },
      { id: "ev-22", at: ago(60 * 24 * 4), label: "Fault reference found", detail: "Ward office note matched.", kind: "source", agent: "Research Agent" },
      { id: "ev-23", at: ago(60 * 24 * 2), label: "Monitoring for updates", detail: "SASI checks the case every 48h.", kind: "system", agent: "Follow-up Agent" },
    ],
  },
  {
    id: "case-097",
    ref: "CASE-000097",
    title: "Large pothole damaging vehicles",
    description: "Deep pothole on a residential collector road. Reported, inspected and repaired.",
    service: "roads",
    location: {
      province: "Gauteng",
      municipality: "City of Johannesburg",
      city: "Johannesburg",
      suburb: "Sandton",
      ward: "Ward 103",
      lat: -26.11,
      lng: 28.06,
      mapX: 55,
      mapY: 47,
    },
    status: "RESOLVED",
    priority: "MEDIUM",
    createdAt: ago(60 * 24 * 34),
    updatedAt: ago(60 * 24 * 21),
    aiState: "COMPLETE",
    impact: "Vehicle damage risk — resolved after repair.",
    isDemo: true,
    events: [
      { id: "ev-31", at: ago(60 * 24 * 34), label: "Report received", kind: "user" },
      { id: "ev-32", at: ago(60 * 24 * 33), label: "Roads department pathway identified", kind: "ai", agent: "Government Navigator Agent" },
      { id: "ev-33", at: ago(60 * 24 * 30), label: "Action approved and submitted", kind: "action" },
      { id: "ev-34", at: ago(60 * 24 * 21), label: "Repair verified", detail: "Your confirmation photo matched a repair record.", kind: "verification", agent: "Verification Agent" },
    ],
    verification: {
      state: "VERIFIED",
      detail: "Repair confirmed by your site photo on 20 Jan.",
      checkedAt: ago(60 * 24 * 21),
    },
  },
];

/* ---------- FINDINGS (per case) ---------- */

export const FINDINGS: Record<string, Finding[]> = {
  "case-123": [
    {
      id: "F-123-1",
      title: "Outage consistent with planned bulk maintenance",
      status: "INFERRED",
      confidence: "MEDIUM",
      sourcesCount: 3,
      evidenceCount: 2,
      summary:
        "The timing and area of your outage match a maintenance notice on the bulk network, and reservoir telemetry shows the expected overnight drop. This finding has not been independently confirmed by the utility.",
      nextStep:
        "Approve the prepared service report so your case is on record with the utility, then monitor for a restoration update.",
      createdAt: ago(6 * 60 + 20),
      isDemo: true,
    },
    {
      id: "F-123-2",
      title: "No official restoration time published yet",
      status: "UNVERIFIED",
      confidence: "LOW",
      sourcesCount: 2,
      evidenceCount: 0,
      summary:
        "No source states when supply will return. Any estimate would be speculation, so SASI is not providing one.",
      createdAt: ago(6 * 60 + 18),
      isDemo: true,
    },
  ],
  "case-118": [
    {
      id: "F-118-1",
      title: "Advisory repair appears delayed beyond the stated window",
      status: "INFERRED",
      confidence: "MEDIUM",
      sourcesCount: 1,
      evidenceCount: 1,
      summary:
        "The advisory indicated a short repair, but pressure complaints continue after 9 days with no progress note.",
      nextStep: "Approve the follow-up enquiry so the utility responds on record.",
      createdAt: ago(60 * 26),
      isDemo: true,
    },
  ],
  "case-104": [],
  "case-097": [
    {
      id: "F-097-1",
      title: "Repair verified against site photo",
      status: "CONFIRMED",
      confidence: "HIGH",
      sourcesCount: 2,
      evidenceCount: 1,
      summary: "Your confirmation photo and the municipal repair record align.",
      createdAt: ago(60 * 24 * 21),
      isDemo: true,
    },
  ],
};

/* ---------- EVIDENCE ---------- */

export const EVIDENCE: EvidenceItem[] = [
  {
    id: "EVD-1",
    type: "PHOTO",
    title: "Dry tap — kitchen, 19:47",
    description: "Tap runs dry with sputtering air before stopping.",
    createdAt: ago(10 * 60 + 40),
    location: "Melrose, Johannesburg",
    caseId: "case-123",
    verification: "REPORTED",
    imageKey: "dry-tap",
    isDemo: true,
  },
  {
    id: "EVD-2",
    type: "PHOTO",
    title: "Street view — no visible leak",
    description: "Road and verge outside the property, no pooling water.",
    createdAt: ago(10 * 60 + 36),
    location: "Melrose, Johannesburg",
    caseId: "case-123",
    verification: "REPORTED",
    imageKey: "leak-street",
    isDemo: true,
  },
  {
    id: "EVD-3",
    type: "NOTE",
    title: "Hotline reference captured",
    description: "Reference: REF-88231 (demo). Agent said maintenance is underway in the area.",
    createdAt: ago(9 * 60 + 55),
    location: "Phone call",
    caseId: "case-123",
    verification: "USER_PROVIDED" as EvidenceItem["verification"],
    isDemo: true,
  },
  {
    id: "EVD-4",
    type: "LINK",
    title: "Maintenance notice bookmark",
    description: "Utility notice page saved as supporting context.",
    createdAt: ago(9 * 60 + 30),
    caseId: "case-123",
    verification: "CONFIRMED",
    url: "https://example.org/demo/maintenance-notice",
    isDemo: true,
  },
  {
    id: "EVD-5",
    type: "PHOTO",
    title: "Pressure gauge — morning",
    description: "Gauge reads well below normal during 06:00 window.",
    createdAt: ago(60 * 24 * 8),
    location: "Soweto, Johannesburg",
    caseId: "case-118",
    verification: "REPORTED",
    imageKey: "reservoir",
    isDemo: true,
  },
  {
    id: "EVD-6",
    type: "NOTE",
    title: "Neighbour confirmations",
    description: "Two neighbours confirmed the same pressure pattern.",
    createdAt: ago(60 * 24 * 8),
    caseId: "case-118",
    verification: "REPORTED",
    isDemo: true,
  },
  {
    id: "EVD-7",
    type: "PHOTO",
    title: "Dark street at 20:15",
    description: "Stretch with four unlit poles.",
    createdAt: ago(60 * 24 * 14),
    location: "Rosebank, Johannesburg",
    caseId: "case-104",
    verification: "REPORTED",
    imageKey: "leak-street",
    isDemo: true,
  },
  {
    id: "EVD-8",
    type: "PHOTO",
    title: "Pothole before repair",
    description: "Depth reference with ruler.",
    createdAt: ago(60 * 24 * 34),
    location: "Sandton, Johannesburg",
    caseId: "case-097",
    verification: "CONFIRMED",
    imageKey: "burst-pipe",
    isDemo: true,
  },
  {
    id: "EVD-9",
    type: "PHOTO",
    title: "Repaired surface after works",
    description: "Fresh compound over the repaired area.",
    createdAt: ago(60 * 24 * 21),
    location: "Sandton, Johannesburg",
    caseId: "case-097",
    verification: "CONFIRMED",
    imageKey: "leak-street",
    isDemo: true,
  },
];

/* ---------- INCIDENTS (all demo, Gauteng focus) ---------- */

export const INCIDENTS: Incident[] = [
  {
    id: "inc-41",
    ref: "INC-0041",
    title: "Water interruption — planned maintenance",
    service: "water",
    location: {
      province: "Gauteng",
      municipality: "City of Johannesburg",
      city: "Johannesburg",
      suburb: "Sandton / Melrose area",
      mapX: 54,
      mapY: 51,
    },
    status: "CONFIRMED",
    severity: "HIGH",
    description:
      "Bulk maintenance on the northern network. Interruptions confirmed by utility notice and resident reports.",
    reportedAt: ago(10 * 60 * 22),
    updatedAt: ago(9 * 60),
    sourceIds: ["SRC-101", "SRC-102", "SRC-104"],
    affectedArea: "Parts of Sandton, Melrose, Rosebank",
    isDemo: true,
  },
  {
    id: "inc-42",
    ref: "INC-0042",
    title: "Burst pipe flooding roadway",
    service: "water",
    location: {
      province: "Gauteng",
      municipality: "City of Johannesburg",
      city: "Johannesburg",
      suburb: "Soweto",
      mapX: 40,
      mapY: 68,
    },
    status: "URGENT",
    severity: "CRITICAL",
    description: "Reports of a burst main flooding a section of roadway. Crew requested.",
    reportedAt: ago(3 * 60 + 20),
    updatedAt: ago(40),
    sourceIds: ["SRC-102"],
    affectedArea: "Single intersection",
    isDemo: true,
  },
  {
    id: "inc-43",
    ref: "INC-0043",
    title: "No water reported — Midrand nodes",
    service: "water",
    location: {
      province: "Gauteng",
      municipality: "City of Johannesburg",
      city: "Midrand",
      suburb: "Halfway House",
      mapX: 53,
      mapY: 37,
    },
    status: "REPORTED",
    severity: "MEDIUM",
    description: "Scattered resident reports of dry taps since early morning. Not yet confirmed.",
    reportedAt: ago(5 * 60 + 5),
    updatedAt: ago(70),
    sourceIds: [],
    affectedArea: "Business district surroundings",
    isDemo: true,
  },
  {
    id: "inc-44",
    ref: "INC-0044",
    title: "Reservoir maintenance shutdown",
    service: "water",
    location: {
      province: "Gauteng",
      municipality: "City of Johannesburg",
      city: "Roodepoort",
      suburb: "Helderkruin",
      mapX: 33,
      mapY: 57,
    },
    status: "CONFIRMED",
    severity: "LOW",
    description: "Short planned shutdown for valve replacement. Supply expected to normalise by evening.",
    reportedAt: ago(60 * 20),
    updatedAt: ago(60 * 4),
    sourceIds: ["SRC-101"],
    affectedArea: "Feeding suburbs",
    isDemo: true,
  },
  {
    id: "inc-45",
    ref: "INC-0045",
    title: "Low pressure — western Tshwane",
    service: "water",
    location: {
      province: "Gauteng",
      municipality: "City of Tshwane",
      city: "Pretoria",
      suburb: "Pretoria West",
      mapX: 63,
      mapY: 22,
    },
    status: "REPORTED",
    severity: "MEDIUM",
    description: "Reduced pressure reported by several households. Cause under review.",
    reportedAt: ago(60 * 30),
    updatedAt: ago(60 * 6),
    sourceIds: [],
    isDemo: true,
  },
  {
    id: "inc-46",
    ref: "INC-0046",
    title: "Power outage — Alexandra blocks",
    service: "electricity",
    location: {
      province: "Gauteng",
      municipality: "City of Johannesburg",
      city: "Johannesburg",
      suburb: "Alexandra",
      mapX: 61,
      mapY: 47,
    },
    status: "CONFIRMED",
    severity: "HIGH",
    description: "Outage affecting several blocks. Utility crews on site per resident updates.",
    reportedAt: ago(7 * 60 + 45),
    updatedAt: ago(2 * 60),
    sourceIds: [],
    isDemo: true,
  },
  {
    id: "inc-47",
    ref: "INC-0047",
    title: "Pothole cluster after rains",
    service: "roads",
    location: {
      province: "Gauteng",
      municipality: "City of Tshwane",
      city: "Centurion",
      suburb: "Lyttelton",
      mapX: 64,
      mapY: 29,
    },
    status: "REPORTED",
    severity: "LOW",
    description: "Several deep potholes reported on a commuter route.",
    reportedAt: ago(60 * 26),
    updatedAt: ago(60 * 25),
    sourceIds: [],
    isDemo: true,
  },
  {
    id: "inc-48",
    ref: "INC-0048",
    title: "Waste collection delayed",
    service: "waste",
    location: {
      province: "Gauteng",
      municipality: "City of Johannesburg",
      city: "Johannesburg",
      suburb: "Soweto",
      mapX: 38,
      mapY: 73,
    },
    status: "REPORTED",
    severity: "LOW",
    description: "Collections missed on the usual Tuesday route.",
    reportedAt: ago(60 * 40),
    updatedAt: ago(60 * 38),
    sourceIds: [],
    isDemo: true,
  },
  {
    id: "inc-49",
    ref: "INC-0049",
    title: "Supply restored — Randburg",
    service: "water",
    location: {
      province: "Gauteng",
      municipality: "City of Johannesburg",
      city: "Randburg",
      suburb: "Ferndale",
      mapX: 47,
      mapY: 44,
    },
    status: "RESOLVED",
    severity: "MEDIUM",
    description: "Interrupted supply restored after a pipe repair. Pressure still stabilising.",
    reportedAt: ago(60 * 50),
    updatedAt: ago(60 * 8),
    sourceIds: ["SRC-101"],
    isDemo: true,
  },
];

/* ---------- NOTIFICATIONS ---------- */

export const NOTIFICATIONS: AppNotification[] = [
  {
    id: "ntf-1",
    kind: "ACTION",
    title: "SASI is waiting for your approval",
    body: "A prepared service report for CASE-000123 needs your review before anything is submitted.",
    at: ago(12),
    read: false,
    caseRef: "CASE-000123",
  },
  {
    id: "ntf-2",
    kind: "INVESTIGATION",
    title: "Your investigation has a new finding",
    body: "Finding: outage consistent with planned bulk maintenance (AI-inferred, medium confidence).",
    at: ago(6 * 60 + 20),
    read: false,
    caseRef: "CASE-000123",
  },
  {
    id: "ntf-3",
    kind: "UPDATE",
    title: "Additional evidence may help verify this issue",
    body: "A short video of the tap would strengthen CASE-000123.",
    at: ago(60 * 5),
    read: false,
    caseRef: "CASE-000123",
  },
  {
    id: "ntf-4",
    kind: "CASE",
    title: "Your case has been updated",
    body: "CASE-000118 moved to Action required — a follow-up enquiry is prepared.",
    at: ago(60 * 26),
    read: true,
    caseRef: "CASE-000118",
  },
  {
    id: "ntf-5",
    kind: "UPDATE",
    title: "Monitoring update",
    body: "CASE-000104: no utility response yet. Next automatic check in 24h.",
    at: ago(60 * 24 * 2),
    read: true,
    caseRef: "CASE-000104",
  },
  {
    id: "ntf-6",
    kind: "SYSTEM",
    title: "Verification completed",
    body: "CASE-000097 verified as repaired. The case is now resolved.",
    at: ago(60 * 24 * 21),
    read: true,
    caseRef: "CASE-000097",
  },
];

/* ---------- ACTIVITY ---------- */

export const ACTIVITY: ActivityEvent[] = [
  { id: "act-1", at: ago(12), kind: "PERMISSION_REQUESTED", label: "Permission requested", detail: "Submit water service report", caseRef: "CASE-000123" },
  { id: "act-2", at: ago(12), kind: "FINDING_GENERATED", label: "Recommended next step prepared", caseRef: "CASE-000123" },
  { id: "act-3", at: ago(6 * 60 + 20), kind: "FINDING_GENERATED", label: "Finding generated", detail: "Outage consistent with planned maintenance", caseRef: "CASE-000123" },
  { id: "act-4", at: ago(8 * 60 + 55), kind: "SOURCE_FOUND", label: "Source discovered", detail: "News corroboration — northern suburbs outages", caseRef: "CASE-000123" },
  { id: "act-5", at: ago(9 * 60 + 40), kind: "EVIDENCE_ADDED", label: "Evidence analyzed", detail: "2 photos processed", caseRef: "CASE-000123" },
  { id: "act-6", at: ago(10 * 60 + 2), kind: "INVESTIGATION_STARTED", label: "Investigation started", caseRef: "CASE-000123" },
  { id: "act-7", at: ago(60 * 26), kind: "CASE_UPDATED", label: "Case updated", detail: "Moved to Action required", caseRef: "CASE-000118" },
  { id: "act-8", at: ago(60 * 26 + 10), kind: "CONFIDENCE_UPDATED", label: "Confidence updated", detail: "Advisory delay finding — Medium", caseRef: "CASE-000118" },
  { id: "act-9", at: ago(60 * 24 * 2), kind: "CASE_UPDATED", label: "Monitoring check", detail: "No response on streetlight fault", caseRef: "CASE-000104" },
  { id: "act-10", at: ago(60 * 24 * 21), kind: "VERIFICATION_COMPLETED", label: "Verification completed", detail: "Pothole repair confirmed", caseRef: "CASE-000097" },
  { id: "act-11", at: ago(60 * 24 * 30), kind: "ACTION_COMPLETED", label: "Action completed", detail: "Roads report submitted (approved by you)", caseRef: "CASE-000097" },
  { id: "act-12", at: ago(60 * 24 * 30 - 6), kind: "ACTION_APPROVED", label: "Action approved", detail: "You approved a roads report submission", caseRef: "CASE-000097" },
  { id: "act-13", at: ago(60 * 24 * 33), kind: "SOURCE_FOUND", label: "Source discovered", detail: "Roads department pathway", caseRef: "CASE-000097" },
  { id: "act-14", at: ago(3 * 60 + 20), kind: "INCIDENT_REPORTED", label: "Incident reported nearby", detail: "Burst pipe — Soweto (demo)" },
];

/* ---------- Reference data ---------- */

export const GAUTENG_MUNICIPALITIES = [
  "City of Johannesburg",
  "City of Tshwane",
  "Ekurhuleni",
  "Sedibeng",
  "West Rand",
];

export const SERVICE_REPORT_OPTIONS: Record<string, string[]> = {
  water: [
    "No water",
    "Low pressure",
    "Burst pipe",
    "Leak",
    "Dirty / discoloured water",
    "Infrastructure damage",
    "Other",
  ],
};

/* ---------- lookups ---------- */

export function sourcesByIds(ids: string[]): SasiSource[] {
  return SOURCES.filter((s) => ids.includes(s.id));
}

export function evidenceForCase(caseId: string): EvidenceItem[] {
  return EVIDENCE.filter((e) => e.caseId === caseId);
}

export function sourcesForCase(caseId: string): SasiSource[] {
  if (caseId === "case-123") return SOURCES.filter((s) => ["SRC-101", "SRC-102", "SRC-103", "SRC-104"].includes(s.id));
  if (caseId === "case-118") return SOURCES.filter((s) => ["SRC-201"].includes(s.id));
  if (caseId === "case-104") return SOURCES.filter((s) => ["SRC-301"].includes(s.id));
  if (caseId === "case-097") return SOURCES.filter((s) => ["SRC-101"].includes(s.id));
  return [];
}

export function caseByRef(ref: string): SasiCase | undefined {
  return CASES.find((c) => c.ref === ref);
}

export const POPULAR_SERVICES: ServiceKey[] = [
  "water",
  "electricity",
  "roads",
  "waste",
  "healthcare",
  "education",
  "housing",
  "documents",
];
