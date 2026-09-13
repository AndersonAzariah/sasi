/* ============================================================
   SASI — AI provider contract (Task 29)

   Every AI feature in SASI talks to ONE abstraction:

     route → AI service (prompts + validation) → AIProvider → OpenRouter

   - Providers are constructed and used ONLY on the server.
     Nothing in this folder may be imported from client code.
   - The provider never returns raw provider errors to callers —
     it throws AIProviderError with a stable `code` the route maps
     to an honest HTTP status + user-facing message.
   - API keys never appear here: implementations read them from
     server-side environment variables and never log them.
   - Replacing OpenRouter with another provider means adding one
     class and changing the factory — no route edits.
   ============================================================ */

/** A single content part for multimodal messages (text or image). */
export interface AITextPart {
  type: "text";
  text: string;
}

export interface AIImagePart {
  type: "image_url";
  image_url: { url: string };
}

export type AIContentPart = AITextPart | AIImagePart;

export type AIChatRole = "system" | "user" | "assistant";

export interface AIMessage {
  role: AIChatRole;
  /** plain text, or content parts for multimodal (vision) requests */
  content: string | AIContentPart[];
}

export interface AICompletionRequest {
  messages: AIMessage[];
  /** sampling temperature (provider default when omitted) */
  temperature?: number;
  /** hard ceiling on generated tokens (provider default when omitted) */
  maxTokens?: number;
  /** per-request timeout in ms (falls back to the provider's default) */
  timeoutMs?: number;
}

export interface AICompletionResult {
  /** the model's reply text (content of the first choice) */
  text: string;
  /** the model that actually answered (for diagnostics only) */
  model: string;
  /** the provider id that served the request */
  provider: string;
}

/** Stable machine-readable failure codes — routes translate these
    into honest HTTP responses; raw provider payloads NEVER leak. */
export type AIErrorCode =
  | "not_configured" // no API key configured server-side
  | "rate_limited" // upstream rate limit / quota
  | "timeout" // the request took too long
  | "upstream" // provider outage or upstream failure
  | "malformed" // provider answered with an unusable shape
  | "invalid_request"; // our request was rejected (bad model name, bad body)

export class AIProviderError extends Error {
  code: AIErrorCode;
  /** upstream HTTP status when known (never the response body) */
  status?: number;

  constructor(code: AIErrorCode, message: string, status?: number) {
    super(message);
    this.name = "AIProviderError";
    this.code = code;
    this.status = status;
  }
}

export interface AIProvider {
  /** short id for diagnostics ("openrouter") */
  readonly id: string;
  /** true when the provider has the server-side configuration it needs */
  isConfigured(): boolean;
  complete(req: AICompletionRequest): Promise<AICompletionResult>;
}
