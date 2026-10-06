import { describe, expect, it } from "vitest";
import { simulateTrader } from "../sim/generate";
import { TOLU } from "../sim/personas";
import { findHabits } from "./patterns";
import { replayTrades } from "./replay";

describe("findHabits on the demo trader", () => {
  const review = findHabits(replayTrades(simulateTrader(TOLU).book.trades));
  const status = Object.fromEntries(review.findings.map((f) => [f.id, f.status]));

  it("detects exactly the planted habits", () => {
    expect(status).toEqual({
      "closed-chasing": "detected",
      "closed-panic": "not-detected",
      "earnings-roulette": "detected",
      "cutting-winners": "detected",
      revenge: "detected",
    });
  });

  it("backs every detection with evidence trades and a summary built from metrics", () => {
    for (const f of review.findings.filter((x) => x.status === "detected")) {
      expect(f.evidence.length).toBeGreaterThan(0);
      expect(f.pValue).toBeLessThan(0.01);
      expect(f.summary.length).toBeGreaterThan(40);
      for (const v of Object.values(f.metrics)) expect(Number.isFinite(v)).toBe(true);
    }
  });
});
