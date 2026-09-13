/* ============================================================
   SASI — structured-answer validation + corroboration tests
   (Task 29 §7/§39 — the model is never trusted blindly)

   bun test src/lib/sasi/__tests__/civic-ai.test.ts
   ============================================================ */

import { describe, expect, test } from "bun:test";
import {
  corroborateStructured,
  extractJsonBlock,
  validateStructuredAnswer,
} from "../civic-ai";
import { SERVICE_REGISTRY } from "../services-registry";

const REAL_SLUG = SERVICE_REGISTRY.find((e) => e.journeyId)?.slug ?? "passport";
const REAL_JOURNEY = SERVICE_REGISTRY.find((e) => e.journeyId)?.journeyId ?? "passport-apply";

describe("extractJsonBlock", () => {
  test("parses fenced and prose-wrapped JSON", () => {
    expect(extractJsonBlock('```json\n{"a":1}\n```')).toEqual({ a: 1 });
    expect(extractJsonBlock('Sure! {"a":1} hope that helps')).toEqual({ a: 1 });
  });

  test("returns null on unusable output", () => {
    expect(extractJsonBlock("no json here")).toBe(null);
    expect(extractJsonBlock("")).toBe(null);
  });
});

describe("validateStructuredAnswer", () => {
  test("keeps valid sections and strips unknown fields", () => {
    const out = validateStructuredAnswer({
      answer: "Here is the answer.",
      whatYouNeed: ["ID number"],
      nextStep: "Book an appointment.",
      service: { slug: REAL_SLUG, title: "Anything" },
      invented_field: "should be stripped",
    });
    expect(out).not.toBe(null);
    expect(out!.answer).toBe("Here is the answer.");
    expect(out!.whatYouNeed).toEqual(["ID number"]);
    expect((out as unknown as Record<string, unknown>)["invented_field"]).toBeUndefined();
  });

  test("caps runaway list lengths and rejects wrong shapes", () => {
    const out = validateStructuredAnswer({
      answer: "x".repeat(9000),
      whatYouNeed: Array.from({ length: 40 }, (_, i) => `item ${i}`),
    });
    expect(out).not.toBe(null);
    expect(out!.answer.length).toBeLessThanOrEqual(4000);
    expect(out!.whatYouNeed!.length).toBeLessThanOrEqual(8);
  });

  test("returns null when answer is missing", () => {
    expect(validateStructuredAnswer({ whatYouNeed: ["only a list"] })).toBe(null);
    expect(validateStructuredAnswer("just a string")).toBe(null);
    expect(validateStructuredAnswer(null)).toBe(null);
  });
});

describe("corroborateStructured (registry honesty)", () => {
  test("keeps a real registry service and adopts the registry title", () => {
    const entry = SERVICE_REGISTRY.find((e) => e.slug === REAL_SLUG)!;
    const out = corroborateStructured({
      answer: "a",
      service: { slug: REAL_SLUG, title: "Model-invented title" },
    });
    expect(out.service?.slug).toBe(REAL_SLUG);
    expect(out.service?.title).toBe(entry.title);
  });

  test("drops an invented service slug rather than deep-linking into nothing", () => {
    const out = corroborateStructured({
      answer: "a",
      service: { slug: "totally-made-up-service", title: "Fake" },
    });
    expect(out.service).toBeUndefined();
  });

  test("drops an invented journey id", () => {
    const out = corroborateStructured({
      answer: "a",
      journey: { journeyId: "fake-journey-xyz", title: "Fake" },
    });
    expect(out.journey).toBeUndefined();
  });

  test("keeps a real journey id", () => {
    const out = corroborateStructured({
      answer: "a",
      journey: { journeyId: REAL_JOURNEY, title: "x" },
    });
    expect(out.journey?.journeyId).toBe(REAL_JOURNEY);
  });
});
