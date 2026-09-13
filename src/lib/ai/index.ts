/* ============================================================
   SASI — AI service entry point (Task 29)

   The single import surface every server-side AI feature uses:

     import { getAIProvider, aiHttpStatus } from "@/lib/ai";

   - getAIProvider(): the configured provider (OpenRouter today;
     the indirection keeps future provider swaps to one file).
   - getAIStatus(): configuration status WITHOUT secrets — safe
     to expose through /api/sasi/system-status.
   - aiHttpStatus(): maps AIProviderError codes onto honest HTTP
     statuses + user-facing messages (raw provider errors never
     reach the client).
   ============================================================ */

import { AIProviderError, type AIProvider } from "./types";
import { OpenRouterProvider, readOpenRouterConfig } from "./openrouter";

let providerInstance: AIProvider | null = null;

export function getAIProvider(): AIProvider {
  if (!providerInstance) providerInstance = new OpenRouterProvider();
  return providerInstance;
}

export interface AIStatus {
  provider: string;
  /** true when the server has an API key — never any value derived from it */
  configured: boolean;
  /** configured model name (not a secret) or null when unset */
  model: string | null;
}

export function getAIStatus(): AIStatus {
  const provider = getAIProvider();
  const config = readOpenRouterConfig();
  return {
    provider: provider.id,
    configured: provider.isConfigured(),
    model: provider.isConfigured() ? config.model : null,
  };
}

export interface AIHttpError {
  status: number;
  message: string;
  code: AIProviderError["code"];
}

/** One honest, user-safe message per failure mode — the exact UX copy
    mandated by Task 30 §OPENROUTER ERROR UX. Raw provider errors,
    request IDs and stack traces never reach the client. */
export function aiHttpStatus(err: unknown, fallback: string): AIHttpError {
  if (err instanceof AIProviderError) {
    switch (err.code) {
      case "not_configured":
        return {
          status: 503,
          code: err.code,
          message: "SASI AI is temporarily unavailable.",
        };
      case "rate_limited":
        return {
          status: 429,
          code: err.code,
          message:
            "SASI is receiving too many requests right now. Please try again.",
        };
      case "timeout":
        return {
          status: 504,
          code: err.code,
          message: "SASI took too long to respond. Please try again.",
        };
      case "invalid_request":
        return {
          status: 502,
          code: err.code,
          message: "SASI AI configuration needs attention.",
        };
      case "malformed":
      case "upstream":
      default:
        return {
          status: 502,
          code: err.code,
          message: "SASI AI is temporarily unavailable. Please try again.",
        };
    }
  }
  return {
    status: 502,
    code: "upstream",
    message: "SASI AI is temporarily unavailable. Please try again.",
  };
}

export { AIProviderError } from "./types";
export type { AIProvider } from "./types";
export type {
  AIMessage,
  AIChatRole,
  AICompletionRequest,
  AICompletionResult,
  AIContentPart,
  AITextPart,
  AIImagePart,
} from "./types";
