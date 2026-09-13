/* ============================================================
   SASI — Explore / civic knowledge data (Task 29)

   The discovery layer's static, client-safe reference data.
   HONESTY RULES (non-negotiable, same as the service registry):
   - An organisation is listed only when the institution is real and
     its official website is CERTAIN. website: null means "we do not
     have a verified link — confirm through the department directly".
   - Nothing here implies endorsement by SASI or by the institution.
   - Topics are neutral groupings of REAL registry entries and REAL
     in-app information views — never a fake "knowledge graph".
   ============================================================ */

export interface OrganisationEntry {
  /** URL-stable id, e.g. "home-affairs" */
  id: string;
  name: string;
  shortName: string;
  sphere: "national" | "municipal";
  /** what the organisation is responsible for (public knowledge) */
  responsibilities: string[];
  /** registry service slugs this organisation handles */
  serviceSlugs: string[];
  /** official website — ONLY when certain, never a guess */
  website: string | null;
}

export interface CivicTopic {
  id: string;
  name: string;
  description: string;
  serviceSlugs: string[];
  /** in-app public information views worth visiting */
  infoViews: string[];
  /** neutral place category for the Nearby link, when meaningful */
  locationCategory: string | null;
}

export interface InfoEntry {
  /** in-app view id (client-side state route) */
  view: string;
  title: string;
  description: string;
}

/* ------------------------------------------------------------
   Government organisations — verified entries only
   ------------------------------------------------------------ */

export const ORGANISATIONS: OrganisationEntry[] = [
  {
    id: "home-affairs",
    name: "Department of Home Affairs",
    shortName: "Home Affairs (DHA)",
    sphere: "national",
    responsibilities: [
      "Identity documents and Smart ID cards",
      "Passports and travel documents",
      "Birth, marriage and death registration",
      "Immigration and refugee services",
    ],
    serviceSlugs: ["passport", "smart-id", "birth-certificate", "documents"],
    website: "https://www.dha.gov.za",
  },
  {
    id: "sassa",
    name: "South African Social Security Agency",
    shortName: "SASSA",
    sphere: "national",
    responsibilities: [
      "Social grants (older persons, disability, child support)",
      "Grant applications, reviews and payment queries",
      "Social relief of distress",
    ],
    serviceSlugs: ["sassa-grants"],
    website: "https://sassa.gov.za",
  },
  {
    id: "saps",
    name: "South African Police Service",
    shortName: "SAPS",
    sphere: "national",
    responsibilities: [
      "Police clearance certificates",
      "Case reporting and investigation",
      "Public safety and emergency response",
    ],
    serviceSlugs: ["police-clearance", "safety"],
    website: "https://www.saps.gov.za",
  },
  {
    id: "transport",
    name: "Department of Transport",
    shortName: "Transport",
    sphere: "national",
    responsibilities: [
      "Driving licences via Driving Licence Testing Centres (DLTCs)",
      "Vehicle registration and licensing via registering authorities",
      "Road transport policy and the National Road Traffic Act",
    ],
    serviceSlugs: ["driver-licence", "vehicle-renewal"],
    website: "https://www.transport.gov.za",
  },
  {
    id: "national-government",
    name: "South African Government",
    shortName: "SA Government (gov.za)",
    sphere: "national",
    responsibilities: [
      "National departments, agencies and provincial governments",
      "Official services directory and government notices",
      "Presidency, Parliament and cabinet information",
    ],
    serviceSlugs: [],
    website: "https://www.gov.za",
  },
  {
    id: "your-municipality",
    name: "Your Municipality",
    shortName: "Municipal services",
    sphere: "municipal",
    responsibilities: [
      "Water and sanitation, electricity distribution (where municipal)",
      "Waste collection, roads, storms and streetlights",
      "Rates, tariffs, by-laws and service complaints",
    ],
    serviceSlugs: ["water", "electricity", "waste", "roads", "local-government", "housing"],
    /* there is no single verified "your municipality" website — honest null */
    website: null,
  },
];

/* ------------------------------------------------------------
   Civic topics — neutral groupings over real registry entries
   ------------------------------------------------------------ */

export const CIVIC_TOPICS: CivicTopic[] = [
  {
    id: "identity",
    name: "Identity & documents",
    description:
      "First ID, Smart ID card, passports and birth certificates — what each is for and how to apply.",
    serviceSlugs: ["documents", "smart-id", "passport", "birth-certificate"],
    infoViews: ["gov"],
    locationCategory: "home-affairs",
  },
  {
    id: "social-support",
    name: "Social support",
    description:
      "SASSA social grants: who qualifies, what to bring, and how applications and reviews work.",
    serviceSlugs: ["sassa-grants"],
    infoViews: [],
    locationCategory: "sassa-office",
  },
  {
    id: "healthcare",
    name: "Healthcare",
    description:
      "Clinics and hospitals, health records and patient rights in the public health system.",
    serviceSlugs: ["healthcare"],
    infoViews: ["emergency"],
    locationCategory: "clinic",
  },
  {
    id: "education",
    name: "Education",
    description:
      "Schools, admissions and documents families most often need for learners.",
    serviceSlugs: ["education", "documents"],
    infoViews: [],
    locationCategory: null,
  },
  {
    id: "transport",
    name: "Transport & driving",
    description:
      "Learner's and driver's licences, licence card renewals and vehicle licence discs.",
    serviceSlugs: ["driver-licence", "vehicle-renewal"],
    infoViews: [],
    locationCategory: "dltc",
  },
  {
    id: "safety",
    name: "Safety & justice",
    description:
      "Police clearance, opening a case, and what to do in an emergency.",
    serviceSlugs: ["police-clearance", "safety"],
    infoViews: ["emergency"],
    locationCategory: "police-station",
  },
  {
    id: "municipal",
    name: "Municipal services",
    description:
      "Water, electricity, waste, roads and local government — reporting problems and getting answers.",
    serviceSlugs: ["water", "electricity", "waste", "roads", "local-government"],
    infoViews: [],
    locationCategory: null,
  },
  {
    id: "housing",
    name: "Housing",
    description:
      "Housing support and human settlements programmes handled with municipalities and the province.",
    serviceSlugs: ["housing"],
    infoViews: [],
    locationCategory: null,
  },
];

/* ------------------------------------------------------------
   Public information index — REAL in-app information views
   ------------------------------------------------------------ */

export const INFO_INDEX: InfoEntry[] = [
  {
    view: "gov",
    title: "Government directory",
    description:
      "National departments, provincial government and municipalities — what each sphere handles.",
  },
  {
    view: "emergency",
    title: "Emergency numbers",
    description:
      "10111 police, 10177 ambulance, and the numbers that matter when minutes count.",
  },
  {
    view: "how-it-works",
    title: "How SASI works",
    description:
      "The honest loop: observe, research, correlate, verify, prepare — and never act without your approval.",
  },
  {
    view: "security",
    title: "Security",
    description:
      "How SASI protects your data, what is encrypted, and what honest limitations remain.",
  },
  {
    view: "verify",
    title: "Verify information",
    description:
      "Check a suspicious message, claim or link — with honest assessment and official reference steps.",
  },
  {
    view: "about",
    title: "About SASI",
    description:
      "Independent civic intelligence: what SASI does, what it will never do, and who it answers to.",
  },
  {
    view: "privacy",
    title: "Privacy",
    description:
      "What SASI stores, what it never does with your data, and the controls you hold.",
  },
  {
    view: "get-app",
    title: "Get the app",
    description: "Install SASI on your phone or desktop as an app.",
  },
];
