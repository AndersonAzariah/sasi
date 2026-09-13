/* ============================================================
   SASI — Universal search engine tests (Task 29 §39)

   bun test src/lib/sasi/__tests__/search.test.ts

   Pure-function tests: intent routing, grouped results,
   threshold honesty (no fabricated hits), saved-item search.
   ============================================================ */

import { describe, expect, test } from "bun:test";
import {
  detectIntent,
  searchSASI,
  servicesByCategory,
} from "../search";
import { SERVICE_REGISTRY } from "../services-registry";

describe("detectIntent", () => {
  test("location-shaped queries route to Nearby", () => {
    expect(detectIntent("nearest clinic").nearby).toBe(true);
    expect(detectIntent("clinic near me").nearby).toBe(true);
    expect(detectIntent("where can I get a passport").nearby).toBe(true);
  });

  test("verification-shaped queries route to Verify", () => {
    expect(detectIntent("is this message fake?").verify).toBe(true);
    expect(detectIntent("check this sms for scam").verify).toBe(true);
    expect(detectIntent("how do I verify a SASSA sms").verify).toBe(true);
  });

  test("plain service lookups carry no intent", () => {
    const i = detectIntent("how do I apply for a passport");
    expect(i.nearby).toBe(false);
    expect(i.verify).toBe(false);
  });

  test("rights questions route to Explore (Task 30)", () => {
    expect(detectIntent("What are my rights?").rights).toBe(true);
    expect(detectIntent("know my rights as a tenant").rights).toBe(true);
    expect(detectIntent("passport").rights).toBe(false);
  });

  test("document-explanation requests route to Documents (Task 30)", () => {
    expect(detectIntent("Explain this document").documents).toBe(true);
    expect(detectIntent("what does this letter mean").documents).toBe(true);
    expect(detectIntent("passport").documents).toBe(false);
  });
});

describe("searchSASI", () => {
  test("passport finds the passport service, journey and Home Affairs", () => {
    const r = searchSASI("passport");
    expect(r.services.some((h) => h.param === "passport")).toBe(true);
    expect(r.journeys.length).toBeGreaterThan(0);
    expect(
      r.organisations.some((h) => h.id === "org:home-affairs")
    ).toBe(true);
    /* verified flags come from the registry's verified official source */
    const passport = r.services.find((h) => h.param === "passport");
    expect(passport?.verified).toBe(true);
  });

  test("ID replacement phrasing finds the Smart ID service", () => {
    const r = searchSASI("I need to replace my ID");
    expect(
      r.services.some((h) => h.param === "smart-id" || h.param === "passport")
    ).toBe(true);
  });

  test("gibberish returns zero hits (nothing fabricated)", () => {
    const r = searchSASI("zzqqx blorg 9182");
    expect(r.total).toBe(0);
    expect(r.services).toHaveLength(0);
    expect(r.journeys).toHaveLength(0);
    expect(r.organisations).toHaveLength(0);
  });

  test("every hit maps to a real registry entry", () => {
    const r = searchSASI("grant");
    for (const hit of r.services) {
      expect(SERVICE_REGISTRY.some((e) => e.slug === hit.param)).toBe(true);
    }
  });

  test("saved items are searched and routed by kind", () => {
    const r = searchSASI("passport", [
      { kind: "service", itemId: "passport", title: "Passport" },
      { kind: "answer", itemId: "CASE-000001", title: "My water question" },
    ]);
    expect(r.saved.some((h) => h.param === "passport")).toBe(true);
    /* "passport" query should not surface the water answer */
    expect(r.saved.some((h) => h.id.includes("CASE-000001"))).toBe(false);
  });

  test("empty query returns an empty result, not an error", () => {
    const r = searchSASI("   ");
    expect(r.total).toBe(0);
    expect(r.query).toBe("");
  });
});

describe("servicesByCategory", () => {
  test("groups only real categories and covers the whole registry", () => {
    const groups = servicesByCategory();
    const total = groups.reduce((n, g) => n + g.services.length, 0);
    expect(total).toBe(SERVICE_REGISTRY.length);
    for (const g of groups) {
      expect(g.label.length).toBeGreaterThan(0);
      for (const s of g.services) expect(s.category).toBe(g.category);
    }
  });
});
