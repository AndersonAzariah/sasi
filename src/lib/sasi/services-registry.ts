/* ============================================================
   SASI — SERVICE REGISTRY (Task 28-c · Phases 8 / 9 / 11)

   The single source of truth for real South African public-service
   reference data: what a service is, which department handles it,
   what is commonly required, whether SASI can guide the preparation
   with a checklist journey, and which official source to use for
   the actual submission.

   HONESTY RULES (non-negotiable, mirror the platform rules):
   - officialSource.verified = true ONLY for official SA government
     URLs that are certain to exist (gov.za, dha.gov.za, sassa.gov.za,
     saps.gov.za, dirco.gov.za). When the exact URL is not certain,
     officialSource is null and the responsible department is named
     in `department` instead — honesty over completeness.
   - requirements / requiredDocuments are real, commonly documented
     items only. Nothing invented. Where a list may vary by office
     the entry stays generic and the UI tells the resident to
     confirm with the official source.
   - A journey is a SASI PREPARATION CHECKLIST. Completing it never
     means an official government application is complete.

   Category strings align with the platform's ServiceKey values
   (see types.ts / utils.ts SERVICES) so ServiceIcon/SERVICE_TINT
   render correctly; specific services that do not fit a reporting
   category use "other".
   ============================================================ */

export interface OfficialSource {
  /** publishing organisation, e.g. "Department of Home Affairs" */
  org: string;
  /** URL SASI is confident points at the official site */
  url: string;
  /** true ONLY when SASI is certain the URL is the official site */
  verified: boolean;
}

export interface ServiceRegistryEntry {
  /** URL-stable id, e.g. "passport" */
  slug: string;
  title: string;
  /** platform service category (ServiceKey-compatible string) */
  category: string;
  /** department / institution responsible — the honest fallback when no verified URL exists */
  department: string;
  summary: string;
  requirements: string[];
  requiredDocuments: string[];
  /** `${slug}-apply` when a meaningful SASI checklist journey exists, else null */
  journeyId: string | null;
  officialSource: OfficialSource | null;
  /** neutral place category for the map "Nearby" row, e.g. "home-affairs" */
  locationCategory: string | null;
  /** other registry slugs worth opening next */
  relatedServices: string[];
}

/* ---------- Verified official sources (certain URLs only) ---------- */

const SA_GOV: OfficialSource = {
  org: "South African Government",
  url: "https://www.gov.za",
  verified: true,
};
const DHA: OfficialSource = {
  org: "Department of Home Affairs",
  url: "https://www.dha.gov.za",
  verified: true,
};
const SASSA: OfficialSource = {
  org: "South African Social Security Agency",
  url: "https://www.sassa.gov.za",
  verified: true,
};
const SAPS: OfficialSource = {
  org: "South African Police Service",
  url: "https://www.saps.gov.za",
  verified: true,
};

/* ---------- Journey step definitions ----------
   Keyed by journeyId. Steps are preparation guidance only — every
   journey view states that finishing this checklist is not the same
   as completing an official government application. */

export interface JourneyStep {
  title: string;
  detail: string;
}

const JOURNEY_STEPS: Record<string, JourneyStep[]> = {
  "passport-apply": [
    {
      title: "Confirm your identity documents",
      detail:
        "Make sure you have a valid green barcoded ID or Smart ID card. If your ID is missing, the Smart ID journey comes first.",
    },
    {
      title: "Gather what the office needs",
      detail:
        "The DHA-73 application form, your ID, identical colour passport photos and the fee. Offices also capture your fingerprints.",
    },
    {
      title: "Visit a Home Affairs office in person",
      detail:
        "Passport applications are submitted in person (or at a South African mission abroad if you live outside the country).",
    },
    {
      title: "Keep your proof of application",
      detail:
        "Keep the receipt / reference you are given — it is how you follow up. Home Affairs publishes a status-check channel on its website.",
    },
    {
      title: "Collect your passport in person",
      detail:
        "Passports are handed to the applicant only. Bring your ID and the receipt when you collect.",
    },
  ],
  "smart-id-apply": [
    {
      title: "Check your eligibility",
      detail:
        "South African citizens from 16 years and permanent residents can apply for a Smart ID card. Children need a parent or guardian present.",
    },
    {
      title: "Prepare your current documents",
      detail:
        "Your green barcoded ID book (when converting) or your birth certificate for first-time applicants. If your ID was lost or stolen, report it and take the affidavit or case number with you.",
    },
    {
      title: "Visit a Home Affairs office that issues Smart IDs",
      detail:
        "Your fingerprints and photo are captured at the office — this cannot be done online. Some banks partner with Home Affairs for card renewals; the DHA website lists participating branches.",
    },
    {
      title: "Keep your receipt / reference",
      detail:
        "You will receive proof of application. Keep it — collection requires it.",
    },
    {
      title: "Collect your Smart ID card",
      detail:
        "Cards are collected in person by the applicant (or the guardian for a child).",
    },
  ],
  "birth-certificate-apply": [
    {
      title: "Register the birth on time",
      detail:
        "Births should be registered within 30 days. Later registrations are possible but follow a longer process with extra documents.",
    },
    {
      title: "Bring the parents' documents",
      detail:
        "Both parents' ID documents, the hospital or clinic proof of birth, and your marriage certificate if you are married.",
    },
    {
      title: "Apply at a Home Affairs office",
      detail:
        "Birth registration is done in person at a Home Affairs office (hospitals may help with the notice of birth).",
    },
    {
      title: "Keep the certificate safe",
      detail:
        "The birth certificate unlocks later services — ID, grants and school registration. Take certified copies; keep the original safe.",
    },
  ],
  "sassa-grants-apply": [
    {
      title: "Check which grant fits your situation",
      detail:
        "SASSA grants (older persons, child support, disability and others) each have their own age, income and assessment rules on the SASSA website.",
    },
    {
      title: "Gather your documents",
      detail:
        "Your ID, proof of income and assets, bank statements, the child's birth certificate for child grants, or a medical report for a disability grant. SASSA will tell you exactly what your grant needs.",
    },
    {
      title: "Apply in person at a SASSA office",
      detail:
        "Grant applications are done in person (no fee is charged). You may bring someone to assist you.",
    },
    {
      title: "Get and keep your receipt",
      detail:
        "SASSA gives you a proof of application with a reference. Applications are assessed by SASSA — SASI cannot check or speed up the outcome.",
    },
    {
      title: "Follow up with SASSA",
      detail:
        "Use the reference and SASSA's official contact channels (including the fraud line 0800 601 011) — never a third party who asks for payment.",
    },
  ],
  "driver-licence-apply": [
    {
      title: "Confirm where you need to go",
      detail:
        "Driver licences are handled by Driving Licence Testing Centres (DLTCs) run by your municipality / province. Many take bookings — ask your local centre.",
    },
    {
      title: "Bring what the DLTC requires",
      detail:
        "Your ID (certified copy), ID photographs, your learner's licence for the driving test or your current card for renewal, the completed DL1 form and the fee. An eye test is done at the centre or bring a recent optometrist certificate.",
    },
    {
      title: "Complete the test / renewal at the centre",
      detail:
        "New licences require the learner's test then the driving test. Renewals only need the form, photos, eye test and fee.",
    },
    {
      title: "Keep your receipt and temporary licence",
      detail:
        "You receive a temporary driving licence while the card is produced — keep it with you when driving.",
    },
    {
      title: "Collect the card before it expires",
      detail:
        "Collect the card at the same DLTC. Check the collection period they give you.",
    },
  ],
  "vehicle-renewal-apply": [
    {
      title: "Check your renewal date",
      detail:
        "The licence disc expires at the end of the month shown on it. Late renewal adds penalties, so renew before expiry.",
    },
    {
      title: "Gather the documents",
      detail:
        "The vehicle registration certificate or the renewal notice, proof of address, and if the vehicle is not registered in your name, the owner's ID and a letter of authority.",
    },
    {
      title: "Renew through an official channel",
      detail:
        "Renew at a registering authority, selected post offices, or online where your province offers it. Fees are pro-rated by month.",
    },
    {
      title: "Display the new disc",
      detail:
        "Put the new disc on the windscreen immediately and keep the receipt.",
    },
  ],
  "police-clearance-apply": [
    {
      title: "Go to a SAPS station",
      detail:
        "Police clearance applications start at a police station, where your fingerprints are taken. Some stations handle this only at certain times — call ahead.",
    },
    {
      title: "Bring your documents and the fee",
      detail:
        "Your ID or passport and a certified copy, your fingerprints (taken at the station) and the prescribed fee.",
    },
    {
      title: "Submit and keep the receipt",
      detail:
        "The fingerprints go to the SAPS Criminal Record Centre for processing. Keep your receipt and reference.",
    },
    {
      title: "Collect or receive the certificate",
      detail:
        "Processing takes time — follow up with the station using your reference. SASI cannot check the progress of a police clearance.",
    },
  ],
};

/** Steps for a journeyId, or undefined when the journey is unknown. */
export function journeyStepsFor(journeyId: string): JourneyStep[] | undefined {
  return JOURNEY_STEPS[journeyId];
}

export const JOURNEY_IDS: readonly string[] = Object.keys(JOURNEY_STEPS);

/* ============================================================
   THE REGISTRY
   ============================================================ */

export const SERVICE_REGISTRY: ServiceRegistryEntry[] = [
  /* ---------- Guided services (journeys) ---------- */
  {
    slug: "passport",
    title: "Tourist passport",
    category: "documents",
    department: "Department of Home Affairs (DHA)",
    summary:
      "The official travel document for South African citizens. Applications are done in person at a Home Affairs office or a South African mission abroad.",
    requirements: [
      "You must be a South African citizen.",
      "Applications are made in person — fingerprints are taken at the office.",
      "The prescribed fee is paid at the office when you apply.",
    ],
    requiredDocuments: [
      "Completed DHA-73 application form",
      "Your green barcoded ID or Smart ID card",
      "Identical colour passport photographs",
      "For children under 18: the child's birth certificate and parental consent",
    ],
    journeyId: "passport-apply",
    officialSource: DHA,
    locationCategory: "home-affairs",
    relatedServices: ["smart-id", "birth-certificate", "documents"],
  },
  {
    slug: "smart-id",
    title: "Smart ID card",
    category: "documents",
    department: "Department of Home Affairs (DHA)",
    summary:
      "The card-format identity document for South African citizens (16+) and permanent residents — first-time applications and replacements for lost or damaged IDs.",
    requirements: [
      "South African citizens from 16 years and permanent residents can apply.",
      "Applications are made in person — fingerprints and a photo are captured at the office.",
      "Children under 16 need a parent or guardian to accompany them.",
    ],
    requiredDocuments: [
      "Your green barcoded ID book (when converting to the card)",
      "Your birth certificate (first-time applicants)",
      "Sworn affidavit or police case number when replacing a lost or stolen ID",
    ],
    journeyId: "smart-id-apply",
    officialSource: DHA,
    locationCategory: "home-affairs",
    relatedServices: ["passport", "birth-certificate", "documents"],
  },
  {
    slug: "birth-certificate",
    title: "Birth certificate",
    category: "documents",
    department: "Department of Home Affairs (DHA)",
    summary:
      "Registers a birth and issues the certificate that unlocks later services — ID applications, grants and school registration.",
    requirements: [
      "Births should be registered within 30 days of the child's birth.",
      "Late registrations are possible but require additional supporting documents.",
      "Registration is done in person at a Home Affairs office.",
    ],
    requiredDocuments: [
      "ID documents of the mother and father",
      "Hospital or clinic proof of birth",
      "Marriage certificate (if the parents are married)",
    ],
    journeyId: "birth-certificate-apply",
    officialSource: DHA,
    locationCategory: "home-affairs",
    relatedServices: ["smart-id", "sassa-grants", "documents"],
  },
  {
    slug: "sassa-grants",
    title: "Social grants (SASSA)",
    category: "other",
    department: "South African Social Security Agency (SASSA)",
    summary:
      "Older persons, child support, disability and other social grants. Each grant has its own rules; applications are made in person at a SASSA office and are never charged for.",
    requirements: [
      "Each grant has its own age, income (means test) or assessment rules — check the SASSA website or office for the grant you need.",
      "Applications are made in person at a SASSA office.",
      "SASSA never charges a fee to apply — be wary of anyone who asks for money.",
    ],
    requiredDocuments: [
      "Your green barcoded ID or Smart ID",
      "Proof of income and assets (payslips, bank statements)",
      "The child's birth certificate (child support grant)",
      "A medical assessment or report (disability grant)",
      "Your marriage certificate (if married)",
    ],
    journeyId: "sassa-grants-apply",
    officialSource: SASSA,
    locationCategory: "sassa-office",
    relatedServices: ["birth-certificate", "smart-id"],
  },
  {
    slug: "driver-licence",
    title: "Driver's licence card",
    category: "other",
    department: "Department of Transport — via your local Driving Licence Testing Centre (DLTC)",
    summary:
      "New driver's licences (after a learner's licence and driving test) and renewal of an expiring licence card, handled by your local Driving Licence Testing Centre.",
    requirements: [
      "A valid learner's licence is required before taking the driving test.",
      "Renew your card before the expiry date shown on it.",
      "An eye test is done at the DLTC, or bring a recent optometrist certificate.",
    ],
    requiredDocuments: [
      "Your ID or Smart ID (certified copy)",
      "ID photographs",
      "Your learner's licence (for the driving test) or current licence card (for renewal)",
      "Completed DL1 application form and the prescribed fee",
    ],
    journeyId: "driver-licence-apply",
    officialSource: SA_GOV,
    locationCategory: "dltc",
    relatedServices: ["vehicle-renewal", "smart-id"],
  },
  {
    slug: "vehicle-renewal",
    title: "Vehicle licence disc renewal",
    category: "other",
    department: "Department of Transport — via your local registering authority",
    summary:
      "Annual renewal of a vehicle licence disc, due before the expiry month ends. Renew at a registering authority, selected post offices, or online where your province offers it.",
    requirements: [
      "Renew every 12 months, before the end of the expiry month.",
      "Late renewals carry penalties.",
      "Fees are pro-rated by month of renewal.",
    ],
    requiredDocuments: [
      "The vehicle registration certificate or licence renewal notice",
      "Proof of address",
      "If the vehicle is not registered in your name: the owner's ID and a letter of authority",
    ],
    journeyId: "vehicle-renewal-apply",
    officialSource: SA_GOV,
    locationCategory: "licensing-office",
    relatedServices: ["driver-licence"],
  },
  {
    slug: "police-clearance",
    title: "Police clearance certificate",
    category: "safety",
    department: "South African Police Service (SAPS)",
    summary:
      "An official record of your criminal history (or its absence), often required for work, study or emigration. Fingerprints are taken at a SAPS station and processed by the Criminal Record Centre.",
    requirements: [
      "Applications start in person at a SAPS station.",
      "Your fingerprints are taken at the station.",
      "Processing takes time — SASI cannot check the progress for you.",
    ],
    requiredDocuments: [
      "Your ID or passport (certified copy)",
      "A set of your fingerprints (taken at the SAPS station)",
      "The prescribed fee",
    ],
    journeyId: "police-clearance-apply",
    officialSource: SAPS,
    locationCategory: "police-station",
    relatedServices: ["smart-id", "safety"],
  },

  /* ---------- Service categories (no journey — reference + pathways) ---------- */
  {
    slug: "documents",
    title: "Documents",
    category: "documents",
    department: "Department of Home Affairs (DHA)",
    summary:
      "IDs, passports, certificates and other Home Affairs services. SASI can guide the preparation for the most common document services.",
    requirements: [],
    requiredDocuments: [],
    journeyId: null,
    officialSource: DHA,
    locationCategory: "home-affairs",
    relatedServices: ["passport", "smart-id", "birth-certificate", "police-clearance"],
  },
  {
    slug: "safety",
    title: "Safety",
    category: "safety",
    department: "South African Police Service (SAPS) · emergency services",
    summary:
      "Community safety, emergencies and crime reporting pathways. Life-threatening emergencies always go through the official emergency numbers first.",
    requirements: [],
    requiredDocuments: [],
    journeyId: null,
    officialSource: SAPS,
    locationCategory: "police-station",
    relatedServices: ["police-clearance"],
  },
  {
    slug: "local-government",
    title: "Local Government",
    category: "local-government",
    department: "Your municipality",
    summary:
      "Ward councillors, billing, rates and municipal processes. Service delivery is handled by your local municipality — SASI helps you prepare, the municipality acts.",
    requirements: [],
    requiredDocuments: [],
    journeyId: null,
    officialSource: SA_GOV,
    locationCategory: null,
    relatedServices: [],
  },
  {
    slug: "water",
    title: "Water",
    category: "water",
    department: "Your municipality (water and sanitation)",
    summary:
      "Interruptions, pressure problems, leaks and infrastructure. Reported and repaired through your municipality — SASI helps you document and track your own report.",
    requirements: [],
    requiredDocuments: [],
    journeyId: null,
    officialSource: null,
    locationCategory: null,
    relatedServices: [],
  },
  {
    slug: "electricity",
    title: "Electricity",
    category: "electricity",
    department: "Your municipality or Eskom (depending on your supplier)",
    summary:
      "Outages, streetlights, prepaid metering and connections. The responsible supplier depends on who bills you — check your municipal account.",
    requirements: [],
    requiredDocuments: [],
    journeyId: null,
    officialSource: null,
    locationCategory: null,
    relatedServices: [],
  },
  {
    slug: "roads",
    title: "Roads",
    category: "roads",
    department: "Your municipality (provincial roads / SANRAL for national routes)",
    summary:
      "Potholes, road damage, signage and traffic infrastructure. Who repairs a road depends on who owns it — municipal, provincial or national.",
    requirements: [],
    requiredDocuments: [],
    journeyId: null,
    officialSource: null,
    locationCategory: null,
    relatedServices: [],
  },
  {
    slug: "waste",
    title: "Waste",
    category: "waste",
    department: "Your municipality (waste management)",
    summary:
      "Collection schedules, illegal dumping and street cleaning — all handled by your municipality's waste department.",
    requirements: [],
    requiredDocuments: [],
    journeyId: null,
    officialSource: null,
    locationCategory: null,
    relatedServices: [],
  },
  {
    slug: "healthcare",
    title: "Healthcare",
    category: "healthcare",
    department: "Department of Health · your municipality",
    summary:
      "Clinics, hospitals, medicine supply and appointments. SASI is informational only — medical care and appointments go through the facility itself.",
    requirements: [],
    requiredDocuments: [],
    journeyId: null,
    officialSource: null,
    locationCategory: null,
    relatedServices: [],
  },
  {
    slug: "education",
    title: "Education",
    category: "education",
    department: "Department of Basic Education · your province",
    summary:
      "Schools, placements, transport and school infrastructure. Admissions and placements are handled by schools and provincial education departments.",
    requirements: [],
    requiredDocuments: [],
    journeyId: null,
    officialSource: null,
    locationCategory: null,
    relatedServices: [],
  },
  {
    slug: "housing",
    title: "Housing",
    category: "housing",
    department: "Department of Human Settlements · your municipality",
    summary:
      "Applications, settlements, RDP housing and tenure. Housing subsidies and waiting lists are administered through provincial departments and municipalities.",
    requirements: [],
    requiredDocuments: [],
    journeyId: null,
    officialSource: null,
    locationCategory: null,
    relatedServices: [],
  },
];

/* ---------- lookups ---------- */

export function registryEntryBySlug(slug: string): ServiceRegistryEntry | undefined {
  return SERVICE_REGISTRY.find((r) => r.slug === slug);
}

export function registryEntryByJourneyId(journeyId: string): ServiceRegistryEntry | undefined {
  return SERVICE_REGISTRY.find((r) => r.journeyId === journeyId);
}

export const JOURNEY_ENTRIES: ServiceRegistryEntry[] = SERVICE_REGISTRY.filter(
  (r) => r.journeyId !== null
);

/** Neutral place categories for the "Nearby" map row (display labels). */
export const LOCATION_CATEGORY_LABELS: Record<string, string> = {
  "home-affairs": "Home Affairs offices",
  "sassa-office": "SASSA offices",
  "police-station": "police stations",
  dltc: "driving licence testing centres",
  "licensing-office": "vehicle licensing offices",
};

/* ============================================================
   DTOs shared by the 28-c API routes and views (client-safe —
   the route files never leak server types into the client).
   ============================================================ */

export type JourneyRunStatus = "ACTIVE" | "PAUSED" | "COMPLETED";

export interface JourneyRunDTO {
  journeyId: string;
  status: JourneyRunStatus;
  stepsDone: number[];
  /** journey snapshot saved when the run started (parsed; null if unreadable) */
  payload: JourneyRunPayload | null;
  createdAt: string;
  updatedAt: string;
}

export interface JourneyRunPayload {
  journeyId: string;
  slug: string;
  title: string;
  department: string;
  steps: JourneyStep[];
  startedAt: string;
}

export interface SavedItemDTO {
  id: string;
  kind: string;
  itemId: string;
  payload: SavedItemPayload | null;
  createdAt: string;
}

export interface SavedItemPayload {
  /** display title saved at save-time (e.g. "Tourist passport") */
  title: string;
  /** for kind "service" — the registry slug to reopen */
  slug?: string;
  /** for kind "journey" — the journeyId to reopen */
  journeyId?: string;
  /** for kind "answer" — the question to continue in Ask SASI */
  question?: string;
  /** for kind "info" — the view to reopen when it is a plain app view */
  view?: string;
}

export interface ReminderDTO {
  id: string;
  title: string;
  note: string | null;
  dueAt: string | null;
  done: boolean;
  createdAt: string;
}

export interface ConversationDayDTO {
  /** UTC day key, e.g. "2026-02-10" */
  day: string;
  messages: {
    id: string;
    role: "user" | "assistant";
    content: string;
    at: string;
  }[];
}

export interface MySasiResponse {
  activeJourneys: JourneyRunDTO[];
  savedItems: SavedItemDTO[];
  reminders: ReminderDTO[];
  recentConversations: ConversationDayDTO[];
  recentNotifications: AppNotificationLiteDTO[];
}

export interface AppNotificationLiteDTO {
  id: string;
  kind: string;
  title: string;
  body: string;
  at: string;
  read: boolean;
  caseRef?: string;
}
