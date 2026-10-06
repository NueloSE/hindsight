import { simulateTrader } from "../sim/generate";
import { TOLU } from "../sim/personas";
import { matchFills } from "../trades/match";
import type { Fill, TradeBook } from "../trades/types";
import { findHabits, type Review } from "./patterns";
import { replayTrades, type TradeFacts } from "./replay";
import { buildRules, type Rule } from "./rules";

/** Where a trade history came from. Uploaded fills travel with each request; nothing is stored server-side. */
export type Dataset = { kind: "sample" } | { kind: "fills"; fills: Fill[] };

export interface Analysis {
  dataset: "sample" | "upload";
  traderName: string;
  book: TradeBook;
  facts: TradeFacts[];
  review: Review;
  rules: Rule[];
}

let sampleCache: Analysis | null = null;

function build(book: TradeBook, dataset: Analysis["dataset"], traderName: string): Analysis {
  const facts = replayTrades(book.trades);
  const review = findHabits(facts);
  return { dataset, traderName, book, facts, review, rules: buildRules(review, facts) };
}

export function analyze(ds: Dataset): Analysis {
  if (ds.kind === "sample") {
    sampleCache ??= build(simulateTrader(TOLU).book, "sample", TOLU.name);
    return sampleCache;
  }
  return build(matchFills(ds.fills), "upload", "You");
}

export function factsById(a: Analysis): Map<string, TradeFacts> {
  return new Map(a.facts.map((f) => [f.trade.id, f]));
}
