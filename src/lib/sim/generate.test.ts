import { describe, expect, it } from "vitest";
import { HABITS, randomProfile, simulateTrader } from "./generate";
import { TOLU } from "./personas";

const FROM = Date.UTC(2026, 3, 1);
const TO = Date.UTC(2026, 8, 30);

describe("simulateTrader", () => {
  it("is deterministic for a given seed", () => {
    const a = simulateTrader(TOLU);
    const b = simulateTrader(TOLU);
    expect(a.fills).toEqual(b.fills);
  });

  it("produces clean round trips inside the requested window", () => {
    const { book } = simulateTrader(TOLU);
    expect(book.rejected).toEqual([]);
    expect(book.trades.length).toBeGreaterThan(80);
    for (const t of book.trades) {
      expect(t.entryT).toBeGreaterThanOrEqual(TOLU.from);
      expect(t.exitT).toBeGreaterThan(t.entryT);
      expect(t.cost).toBeGreaterThan(0);
    }
  });

  it("only tags habits that were planted", () => {
    for (let seed = 1; seed <= 20; seed++) {
      const profile = randomProfile(seed, FROM, TO);
      const sim = simulateTrader(profile);
      const tagged = new Set(Object.values(sim.tradeTags).flat());
      for (const h of tagged) expect(profile.habits[h]).toBeGreaterThan(0);
    }
  });

  it("a habit-free trader has no tagged trades", () => {
    const profile = { ...randomProfile(99, FROM, TO), habits: {} };
    expect(Object.keys(simulateTrader(profile).tradeTags)).toEqual([]);
  });

  it("random profiles cover every habit across a population", () => {
    const seen = new Set<string>();
    for (let seed = 1; seed <= 30; seed++) Object.keys(randomProfile(seed, FROM, TO).habits).forEach((h) => seen.add(h));
    expect([...seen].sort()).toEqual([...HABITS].sort());
  });
});
