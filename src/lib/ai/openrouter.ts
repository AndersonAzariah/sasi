/* ============================================================
   SASI — OpenRouter provider (Task 29)

   The ONLY place in the codebase that talks to OpenRouter.

   SERVER ONLY:
   - Reads OPENROUTER_API_KEY from the server environment.
     The key is never returned, logged, serialised or sent to
     the browser. It exists only inside the Authorization header.
   - Model, temperature, token ceiling and timeout are all
     server-side configuration (env vars with safe defaults) so
     the deployment can be tuned from Vercel without code edits.

   ERROR DISCIPLINE:
   - Every failure becomes AIProviderError with a stable code.
   - Raw provider response bodies are never logged or returned —
     only the HTTP status is kept for diagnostics.
   ============================================================ */

import {
  AIProviderError,
  type AICompletionRequest,
  type AICompletionResult,
  type AIProvider,
} from "./types";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

/** Sensible default so the app works out of the box; deployments
    override with OPENROUTER_MODEL in the environment.
    Task 31: the owner's OpenRouter key is FREE-TIER ONLY, so the
    default must be a free model — verified live against the real
    provider for strict-JSON structured output (answer/whatYouNeed/
    nextStep/service/officialSource all emitted and parseable).
    The previous default (openai/gpt-4o-mini) is a paid model and
    failed with 402-class errors on a free-only key. */
const DEFAULT_MODEL = "nvidia/nemotron-3-super-120b-a12b:free";
const DEFAULT_TIMEOUT_MS = 45_000;
const DEFAULT_MAX_TOKENS = 1200;
const DEFAULT_TEMPERATURE = 0.4;

/** The public base URL used for OpenRouter's optional app
    attribution headers (never the API key). */
function appBaseUrl(): string {
  return (
    process.env.NEXTAUTH_URL ??
    (process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : undefined) ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined) ??
    "http://localhost:3000"
  );
}

export interface OpenRouterConfig {
  model: string;
  visionModel: string;
  temperature: number;
  maxTokens: number;
  timeoutMs: number;
}

/** Server-side configuration — names and defaults are safe to
    surface (no secrets); only the key stays private. */
export function readOpenRouterConfig(): OpenRouterConfig {
  const model = process.env.OPENROUTER_MODEL?.trim() || DEFAULT_MODEL;
  const visionModel =
    process.env.OPENROUTER_VISION_MODEL?.trim() || model;
  const num = (raw: string | undefined, fallback: number) => {
    const n = Number(raw);
    return Number.isFinite(n) && n > 0 ? n : fallback;
  };
  return {
    model,
    visionModel,
    temperature: num(process.env.OPENROUTER_TEMPERATURE, DEFAULT_TEMPERATURE),
    maxTokens: Math.round(num(process.env.OPENROUTER_MAX_TOKENS, DEFAULT_MAX_TOKENS)),
    timeoutMs: num(process.env.OPENROUTER_TIMEOUT_MS, DEFAULT_TIMEOUT_MS),
  };
}

interface ORContentPart {
  type: string;
  text?: string;
  image_url?: { url: string };
}

interface ORResponse {
  choices?: { message?: { content?: string | ORContentPart[] } }[];
  error?: { message?: string };
}

function flattenContent(content: string | ORContentPart[] | undefined): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((part) => (part.type === "text" ? (part.text ?? "") : ""))
      .join("")
      .trim();
  }
  return "";
}

export class OpenRouterProvider implements AIProvider {
  readonly id = "openrouter";

  isConfigured(): boolean {
    return Boolean(process.env.OPENROUTER_API_KEY);
  }

  async complete(req: AICompletionRequest): Promise<AICompletionResult> {
    const key = process.env.OPENROUTER_API_KEY;
    if (!key) {
      throw new AIProviderError(
        "not_configured",
        "The AI provider is not configured on this server."
      );
    }

    const config = readOpenRouterConfig();
    const model = req.messages.some(
      (m) => Array.isArray(m.content) && m.content.some((p) => p.type === "image_url")
    )
      ? config.visionModel
      : config.model;

    const timeoutMs = req.timeoutMs ?? config.timeoutMs;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    let res: Response;
    try {
      res = await fetch(OPENROUTER_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
          "HTTP-Referer": appBaseUrl(),
          /* ByteString-safe: HTTP header values must be latin1 (0-255).
             The previous title contained an em dash (U+2014), which made
             Node's fetch throw synchronously — every provider call failed
             before it left the server while Bun's dev tooling tolerated
             it, so the bug only surfaced in the real Node runtime. */
          "X-Title": "SASI - South African Service Intelligence",
        },
        body: JSON.stringify({
          model,
          messages: req.messages,
          temperature: req.temperature ?? config.temperature,
          max_tokens: req.maxTokens ?? config.maxTokens,
        }),
        signal: controller.signal,
        cache: "no-store",
      });
    } catch (err) {
      clearTimeout(timer);
      if (err instanceof Error && err.name === "AbortError") {
        throw new AIProviderError("timeout", `The AI provider did not answer within ${timeoutMs}ms.`);
      }
      /* Server log carries the real cause (message/cause codes only —
         never headers or the key) so a production outage is diagnosable
         from the platform logs; the client still gets a generic error. */
      console.error(
        "[openrouter] fetch failed:",
        err instanceof Error ? err.message : err,
        err instanceof Error && err.cause ? `| cause: ${String(err.cause)}` : ""
      );
      throw new AIProviderError("upstream", "The AI provider could not be reached.");
    }
    clearTimeout(timer);

    if (!res.ok) {
      // Status only — never the response body (it could echo prompt data).
      const status = res.status;
      console.error(`[openrouter] request failed with HTTP ${status} (model: ${model})`);
      if (status === 401 || status === 403) {
        throw new AIProviderError("upstream", "The AI provider rejected this server's credentials.", status);
      }
      if (status === 429) {
        throw new AIProviderError("rate_limited", "The AI provider is rate limiting this server.", status);
      }
      if (status === 400 || status === 404 || status === 422) {
        throw new AIProviderError("invalid_request", "The AI provider rejected the request (check OPENROUTER_MODEL).", status);
      }
      throw new AIProviderError("upstream", "The AI provider is temporarily unavailable.", status);
    }

    let data: ORResponse;
    try {
      data = (await res.json()) as ORResponse;
    } catch {
      throw new AIProviderError("malformed", "The AI provider returned an unreadable response.");
    }

    const text = flattenContent(data.choices?.[0]?.message?.content);
    if (!text.trim()) {
      throw new AIProviderError("malformed", "The AI provider returned an empty answer.");
    }

    return { text, model, provider: this.id };
  }
}
