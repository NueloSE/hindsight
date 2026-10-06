import { describe, expect, it } from "vitest";
import { parseIdeaLocally } from "./coach";
import { checkGrounding, extractNumbers } from "./grounding";

const facts = {
  chaseEntries: 25,
  closedEntries: 74,
  chaseRate: 0.3378,
  avgMoveAtEntry: 0.0287,
  pnl: -335.42,
  normalSize: 1409.3,
  sizeRatio: 1.83,
  reactionAt: Date.UTC(2026, 7, 27, 13, 30),
  label: "NVDA reports on Aug 27",
};

describe("extractNumbers", () => {
  it("reads money, percentages, multipliers and thousands separators", () => {
    expect(extractNumbers("Lost $1,409 (−3.6%) at 1.8× size").map((m) => [m.value, m.percent])).toEqual([
      [1409, false],
      [3.6, true],
      [1.8, false],
    ]);
  });

  it("ignores digits inside words and tickers", () => {
    expect(extractNumbers("S2 track, rNVDA, P&L")).toEqual([]);
  });
});

describe("checkGrounding", () => {
  it("accepts numbers that come from the facts, in normal written forms", () => {
    const text = "25 of your 74 closed-market buys (34%) chased a move averaging +2.9%. They lost $335 at 1.8× your $1,409 normal size, before the Aug 27 report.";
    const r = checkGrounding(text, facts);
    expect(r.unsupported).toEqual([]);
    expect(r.ok).toBe(true);
  });

  it("rejects invented numbers", () => {
    const r = checkGrounding("This habit cost you $2,000 and a 12.5% drawdown.", facts);
    expect(r.ok).toBe(false);
    expect(r.unsupported).toEqual(["$2,000", "12.5%"]);
  });

  it("rejects numbers stated at a precision the facts don't support", () => {
    expect(checkGrounding("Your chase rate was 35%.", facts).ok).toBe(false);
    expect(checkGrounding("Your chase rate was 33.8%.", facts).ok).toBe(true);
  });
});


describe("parseIdeaLocally", () => {
  it("parses common phrasings without a model", () => {
    expect(parseIdeaLocally("buy $1,500 of rMSTR")).toEqual({ ticker: "MSTR", side: "buy", usd: 1500 });
    expect(parseIdeaLocally("thinking of grabbing 800 bucks of tesla tonight")).toEqual({ ticker: "TSLA", side: "buy", usd: 800 });
    expect(parseIdeaLocally("sell my NVDA")).toEqual({ ticker: "NVDA", side: "sell", usd: null });
  });
});
