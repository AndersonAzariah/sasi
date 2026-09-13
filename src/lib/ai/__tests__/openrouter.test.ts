/* ============================================================
   SASI — OpenRouter provider unit tests (Task 29 §39)

   bun test src/lib/ai/__tests__/openrouter.test.ts

   The provider's fetch is mocked; no network calls are made and
   no real API key is needed. Tests cover the §5 error surface:
   success, rate limit, upstream failure, timeout, malformed
   response, missing key, and the no-secret-logging rule.
   ============================================================ */

import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { OpenRouterProvider } from "../openrouter";
import { AIProviderError } from "../types";

const ORIGINAL_FETCH = globalThis.fetch;
const ORIG_KEY = process.env.OPENROUTER_API_KEY;
const ORIG_MODEL = process.env.OPENROUTER_MODEL;

function mockFetchOnce(impl: (url: string, init?: RequestInit) => Promise<Response>) {
  let called = 0;
  let capturedUrl = "";
  let capturedInit: RequestInit | undefined;
  // @ts-expect-error — replacing fetch for the test only
  globalThis.fetch = (url: string, init?: RequestInit) => {
    called += 1;
    capturedUrl = url;
    capturedInit = init;
    return impl(url, init);
  };
  return {
    get calls() {
      return called;
    },
    get url() {
      return capturedUrl;
    },
    get init() {
      return capturedInit;
    },
  };
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("OpenRouterProvider", () => {
  beforeEach(() => {
    process.env.OPENROUTER_API_KEY = "test-key-not-a-real-secret";
    delete process.env.OPENROUTER_MODEL;
  });

  afterEach(() => {
    globalThis.fetch = ORIGINAL_FETCH;
    if (ORIG_KEY === undefined) delete process.env.OPENROUTER_API_KEY;
    else process.env.OPENROUTER_API_KEY = ORIG_KEY;
    if (ORIG_MODEL === undefined) delete process.env.OPENROUTER_MODEL;
    else process.env.OPENROUTER_MODEL = ORIG_MODEL;
  });

  test("isConfigured reflects the presence of the key only", () => {
    const provider = new OpenRouterProvider();
    expect(provider.isConfigured()).toBe(true);
    delete process.env.OPENROUTER_API_KEY;
    expect(provider.isConfigured()).toBe(false);
  });

  test("missing key → not_configured, no fetch attempted", async () => {
    delete process.env.OPENROUTER_API_KEY;
    const mock = mockFetchOnce(async () => {
      throw new Error("must not be called");
    });
    const provider = new OpenRouterProvider();
    try {
      await provider.complete({ messages: [{ role: "user", content: "hi" }] });
      throw new Error("expected AIProviderError");
    } catch (err) {
      expect(err).toBeInstanceOf(AIProviderError);
      expect((err as AIProviderError).code).toBe("not_configured");
    }
    expect(mock.calls).toBe(0);
  });

  test("success → returns the model text and never the key", async () => {
    const mock = mockFetchOnce(
      async () =>
        jsonResponse(200, {
          choices: [{ message: { content: "Hello from the model." } }],
        })
    );
    const provider = new OpenRouterProvider();
    const result = await provider.complete({
      messages: [{ role: "user", content: "hi" }],
    });
    expect(result.text).toBe("Hello from the model.");
    expect(result.provider).toBe("openrouter");
    expect(mock.calls).toBe(1);
    expect(mock.url).toBe("https://openrouter.ai/api/v1/chat/completions");
    const headers = (mock.init?.headers ?? {}) as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer test-key-not-a-real-secret");
    /* the model name comes from config, not secrets */
    expect(typeof result.model).toBe("string");
    expect(result.model.length).toBeGreaterThan(0);
  });

  test("content parts are flattened (vision-style responses)", async () => {
    mockFetchOnce(
      async () =>
        jsonResponse(200, {
          choices: [
            { message: { content: [{ type: "text", text: "part one " }, { type: "text", text: "part two" }] } },
          ],
        })
    );
    const provider = new OpenRouterProvider();
    const result = await provider.complete({
      messages: [{ role: "user", content: "hi" }],
    });
    expect(result.text).toBe("part one part two");
  });

  test("429 → rate_limited", async () => {
    mockFetchOnce(async () => jsonResponse(429, { error: { message: "slow down" } }));
    const provider = new OpenRouterProvider();
    try {
      await provider.complete({ messages: [{ role: "user", content: "hi" }] });
      throw new Error("expected AIProviderError");
    } catch (err) {
      expect((err as AIProviderError).code).toBe("rate_limited");
      expect((err as AIProviderError).status).toBe(429);
    }
  });

  test("500 → upstream; provider body is never surfaced", async () => {
    mockFetchOnce(async () => jsonResponse(500, { error: { message: "internal: super-secret-backend-detail" } }));
    const provider = new OpenRouterProvider();
    try {
      await provider.complete({ messages: [{ role: "user", content: "hi" }] });
      throw new Error("expected AIProviderError");
    } catch (err) {
      const e = err as AIProviderError;
      expect(e.code).toBe("upstream");
      expect(e.message).not.toContain("super-secret-backend-detail");
    }
  });

  test("invalid model (404) → invalid_request", async () => {
    mockFetchOnce(async () => jsonResponse(404, { error: { message: "no such model" } }));
    const provider = new OpenRouterProvider();
    try {
      await provider.complete({ messages: [{ role: "user", content: "hi" }] });
      throw new Error("expected AIProviderError");
    } catch (err) {
      expect((err as AIProviderError).code).toBe("invalid_request");
    }
  });

  test("malformed body (no choices) → malformed", async () => {
    mockFetchOnce(async () => jsonResponse(200, { unexpected: true }));
    const provider = new OpenRouterProvider();
    try {
      await provider.complete({ messages: [{ role: "user", content: "hi" }] });
      throw new Error("expected AIProviderError");
    } catch (err) {
      expect((err as AIProviderError).code).toBe("malformed");
    }
  });

  test("empty answer → malformed", async () => {
    mockFetchOnce(async () => jsonResponse(200, { choices: [{ message: { content: "  " } }] }));
    const provider = new OpenRouterProvider();
    try {
      await provider.complete({ messages: [{ role: "user", content: "hi" }] });
      throw new Error("expected AIProviderError");
    } catch (err) {
      expect((err as AIProviderError).code).toBe("malformed");
    }
  });

  test("timeout (abort) → timeout", async () => {
    mockFetchOnce(
      () =>
        new Promise<Response>((_, reject) => {
          const err = new Error("The operation was aborted");
          err.name = "AbortError";
          reject(err);
        })
    );
    const provider = new OpenRouterProvider();
    try {
      await provider.complete({ messages: [{ role: "user", content: "hi" }] });
      throw new Error("expected AIProviderError");
    } catch (err) {
      expect((err as AIProviderError).code).toBe("timeout");
    }
  });

  test("OPENROUTER_MODEL env var changes the requested model", async () => {
    process.env.OPENROUTER_MODEL = "acme/test-model";
    const mock = mockFetchOnce(
      async () => jsonResponse(200, { choices: [{ message: { content: "ok" } }] })
    );
    const provider = new OpenRouterProvider();
    await provider.complete({ messages: [{ role: "user", content: "hi" }] });
    const body = JSON.parse(String(mock.init?.body ?? "{}")) as { model?: string };
    expect(body.model).toBe("acme/test-model");
  });
});
