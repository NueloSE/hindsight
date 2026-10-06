import { describe, expect, it } from "vitest";
import { binomialUpperTail, mannWhitneyGreater, median, normalUpperTail, poissonUpperTail } from "./stats";

describe("stats", () => {
  it("binomial upper tail matches known values", () => {
    expect(binomialUpperTail(0, 10, 0.3)).toBe(1);
    expect(binomialUpperTail(10, 10, 0.5)).toBeCloseTo(1 / 1024, 8);
    expect(binomialUpperTail(8, 10, 0.5)).toBeCloseTo(56 / 1024, 8); // C(10,8)+C(10,9)+C(10,10) = 45+10+1
    expect(binomialUpperTail(11, 10, 0.5)).toBe(0);
  });

  it("poisson upper tail matches known values", () => {
    expect(poissonUpperTail(1, 2)).toBeCloseTo(1 - Math.exp(-2), 8);
    expect(poissonUpperTail(3, 1)).toBeCloseTo(1 - Math.exp(-1) * (1 + 1 + 0.5), 8);
  });

  it("normal tail is accurate", () => {
    expect(normalUpperTail(0)).toBeCloseTo(0.5, 6);
    expect(normalUpperTail(1.96)).toBeCloseTo(0.025, 3);
    expect(normalUpperTail(-1.96)).toBeCloseTo(0.975, 3);
  });

  it("mann-whitney detects a shift and not its absence", () => {
    const low = Array.from({ length: 30 }, (_, i) => i);
    const high = low.map((v) => v + 15);
    expect(mannWhitneyGreater(high, low)).toBeLessThan(0.001);
    expect(mannWhitneyGreater(low, high)).toBeGreaterThan(0.99);
    expect(mannWhitneyGreater(low, [...low])).toBeGreaterThan(0.4);
  });

  it("median handles odd and even lengths", () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 2, 3])).toBe(2.5);
  });
});
