import { describe, expect, it } from "vitest";
import { matchFills } from "./match";
import type { Fill } from "./types";

let n = 0;
const f = (t: number, side: Fill["side"], qty: number, price: number, fee = 0, ticker = "NVDA"): Fill => ({
  id: `f${++n}`,
  t,
  ticker,
  side,
  qty,
  price,
  fee,
});

describe("matchFills", () => {
  it("matches a simple round trip with fees", () => {
    const { trades, open, rejected } = matchFills([f(1, "buy", 10, 100, 1), f(2, "sell", 10, 110, 1.1)]);
    expect(open).toEqual([]);
    expect(rejected).toEqual([]);
    expect(trades).toHaveLength(1);
    const t = trades[0];
    expect(t.cost).toBe(1000);
    expect(t.proceeds).toBe(1100);
    expect(t.fees).toBeCloseTo(2.1);
    expect(t.pnl).toBeCloseTo(97.9);
    expect(t.ret).toBeCloseTo(0.0979);
    expect(t.entryT).toBe(1);
    expect(t.exitT).toBe(2);
  });

  it("keeps scale-ins and partial exits inside one trade with weighted prices", () => {
    const { trades } = matchFills([
      f(1, "buy", 10, 100),
      f(2, "buy", 10, 120), // avg entry 110
      f(3, "sell", 5, 130),
      f(4, "sell", 15, 90), // avg exit (650 + 1350) / 20 = 100
    ]);
    expect(trades).toHaveLength(1);
    expect(trades[0].entryPrice).toBeCloseTo(110);
    expect(trades[0].exitPrice).toBeCloseTo(100);
    expect(trades[0].pnl).toBeCloseTo(-200);
    expect(trades[0].exitT).toBe(4);
  });

  it("splits separate round trips and tracks tickers independently", () => {
    const { trades } = matchFills([
      f(1, "buy", 1, 100),
      f(2, "buy", 2, 50, 0, "TSLA"),
      f(3, "sell", 1, 105),
      f(4, "buy", 1, 104),
      f(5, "sell", 2, 40, 0, "TSLA"),
      f(6, "sell", 1, 100),
    ]);
    expect(trades.map((t) => [t.ticker, t.entryT, t.exitT])).toEqual([
      ["NVDA", 1, 3],
      ["TSLA", 2, 5],
      ["NVDA", 4, 6],
    ]);
  });

  it("reports positions still open at the end", () => {
    const { trades, open } = matchFills([f(1, "buy", 4, 100), f(2, "sell", 1, 110)]);
    expect(trades).toEqual([]);
    expect(open).toHaveLength(1);
    expect(open[0].qty).toBeCloseTo(3);
    expect(open[0].avgPrice).toBe(100);
  });

  it("rejects sells with no position and caps oversized sells", () => {
    const { trades, rejected } = matchFills([f(1, "sell", 1, 100), f(2, "buy", 2, 100), f(3, "sell", 3, 110, 3)]);
    expect(trades).toHaveLength(1);
    expect(trades[0].qty).toBe(2);
    expect(trades[0].fees).toBeCloseTo(2); // fee pro-rated to the matched 2 of 3 units
    expect(rejected).toHaveLength(2);
    expect(rejected[1].fill.qty).toBeCloseTo(1);
  });

  it("treats rounding dust as flat", () => {
    const { trades, open } = matchFills([f(1, "buy", 0.3, 100), f(2, "sell", 0.1 + 0.2 - 1e-12, 100)]);
    expect(trades).toHaveLength(1);
    expect(open).toEqual([]);
  });

  it("rejects malformed fills", () => {
    const { rejected } = matchFills([f(1, "buy", 0, 100), f(2, "buy", 1, -5)]);
    expect(rejected).toHaveLength(2);
  });
});
