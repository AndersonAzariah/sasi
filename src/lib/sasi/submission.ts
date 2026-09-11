/* ============================================================
   SASI — institutional submission architecture (PREPARATION ONLY).

   This module defines the seam where a real government submission
   integration will one day plug in. It deliberately does NOT
   submit anything: there is no live adapter, no credentials, no
   endpoint, and no agreement with any institution. Until a real
   adapter is registered and enabled:

     - submitToInstitution() returns NOT_CONNECTED
     - no SubmissionRecord is ever created with a fake status
     - no external reference number is ever generated

   UI copy that uses this module must say:
     "Submission integrations are not currently connected."
   ============================================================ */

export interface Institution {
  /** stable key, e.g. "coj-water" — assigned when a REAL integration exists */
  key: string;
  name: string;
  /** MUNICIPAL | PROVINCIAL | NATIONAL | OTHER */
  level: "MUNICIPAL" | "PROVINCIAL" | "NATIONAL" | "OTHER";
  /** service keys this institution could accept (ServiceKey subset) */
  services: string[];
}

export interface SubmissionRequest {
  userId: string;
  caseRef: string;
  institutionKey: string;
  /** the assembled report payload that WOULD be sent (kept local) */
  payload: Record<string, unknown>;
}

export type SubmissionStatus =
  | "NOT_CONNECTED"
  | "PREPARED"
  | "QUEUED"
  | "SUBMITTED"
  | "FAILED";

export interface SubmissionResult {
  status: SubmissionStatus;
  /** always null today (no adapters exist) — a real adapter may return
      an institution-issued reference, never a fabricated one */
  externalReference: string | null;
  /** honest, user-facing explanation */
  message: string;
}

/**
 * A SubmissionAdapter is the contract a future integration
 * (municipality, provincial department, national department)
 * implements. Registering one is an explicit, reviewed act —
 * never a config flag.
 */
export interface SubmissionAdapter {
  institution: Institution;
  /** perform a REAL submission; must return a verified external reference or throw */
  submit(req: SubmissionRequest): Promise<{
    status: "SUBMITTED" | "FAILED";
    externalReference: string | null;
    raw?: Record<string, unknown>;
  }>;
}

/**
 * The registry. It is EMPTY on purpose. An adapter appears here only
 * when a real institutional integration has been built, reviewed and
 * authorised. There is nothing to fake in this file.
 */
export const SUBMISSION_ADAPTERS: readonly SubmissionAdapter[] = [];

export function listInstitutions(): Institution[] {
  return SUBMISSION_ADAPTERS.map((a) => a.institution);
}

export function submissionCapabilities(): {
  connected: false;
  adapters: number;
  message: string;
} {
  return {
    connected: false,
    adapters: SUBMISSION_ADAPTERS.length,
    message: "Submission integrations are not currently connected.",
  };
}

export async function submitToInstitution(
  req: SubmissionRequest
): Promise<SubmissionResult> {
  const adapter = SUBMISSION_ADAPTERS.find(
    (a) => a.institution.key === req.institutionKey
  );
  if (!adapter) {
    return {
      status: "NOT_CONNECTED",
      externalReference: null,
      message:
        "Submission integrations are not currently connected. Nothing was sent.",
    };
  }
  /* A real adapter's result is passed through untouched — the honesty
     boundary lives in the adapter review, not here. */
  const result = await adapter.submit(req);
  return {
    status: result.status,
    externalReference: result.externalReference,
    message:
      result.status === "SUBMITTED"
        ? "Submitted. Keep the reference for your records."
        : "The submission failed. Nothing was confirmed — try again later.",
  };
}
