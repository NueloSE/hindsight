import { HOUR } from "../market/sessions";
import { marketData } from "../market/data";
import { between } from "../market/series";
import { CHASE_MOVE, PANIC_MOVE, type HabitId } from "../sim/generate";
import { marketGrid, type MarketGrid } from "../sim/grid";
import type { TradeFacts } from "./replay";
import { binomialUpperTail, mannWhitneyGreater, mean, median, poissonUpperTail, sum } from "./stats";

/**
 * Habit detectors. Each one tests a specific behaviour against what chance alone would produce,
 * reports nothing unless the evidence is clear, and measures the habit's cost separately.
 */

export const ALPHA = 0.01;
export const STRONG = 0.001;
/** Suggestive but not conclusive: shown as "watching", never counted as a detection. */
export const WATCH = 0.05;
export const REVENGE_WINDOW_HOURS = 12;

export type HabitStatus = "detected" | "not-detected" | "insufficient-data";

export interface HabitFinding {
  id: HabitId;
  title: string;
  status: HabitStatus;
  confidence: "strong" | "clear" | null;
  /** Not detected, but the evidence leans that way (p < WATCH). Shown as a pattern to keep an eye on. */
  watching: boolean;
  /** One-sided p-value of the behaviour test (the larger one when two tests must agree). */
  pValue: number;
  /** Trades that show the behaviour (the evidence), newest first. */
  evidence: string[];
  /** Numbers the UI and the AI may cite. Fractions unless the key says otherwise. */
  metrics: Record<string, number>;
  /** Money and returns of the evidence trades vs the trader's other trades. */
  cost: { pnl: number; avgReturn: number; otherAvgReturn: number; trades: number } | null;
  /** Deterministic plain-English summary built only from `metrics`. */
  summary: string;
}

export const HABIT_TITLES: Record<HabitId, string> = {
  "closed-chasing": "Chasing moves while Wall Street sleeps",
  "closed-panic": "Panic selling while Wall Street sleeps",
  "earnings-roulette": "Holding through earnings",
  "cutting-winners": "Cutting winners, holding losers",
  revenge: "Revenge trading",
};

const pctText = (x: number, digits = 1) => `${x >= 0 ? "+" : ""}${(x * 100).toFixed(digits)}%`;
const money = (x: number) => `${x < 0 ? "−" : ""}$${Math.abs(x).toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
const madeOrLost = (x: number) => (x < 0 ? `lost ${money(-x)}` : `made ${money(x)}`);

function verdict(p: number, enoughData: boolean, effectOk: boolean): Pick<HabitFinding, "status" | "confidence" | "watching"> {
  if (!enoughData) return { status: "insufficient-data", confidence: null, watching: false };
  if (p < ALPHA && effectOk) return { status: "detected", confidence: p < STRONG ? "strong" : "clear", watching: false };
  return { status: "not-detected", confidence: null, watching: p < WATCH };
}

function costOf(evidence: TradeFacts[], all: TradeFacts[]): HabitFinding["cost"] {
  if (!evidence.length) return null;
  const ids = new Set(evidence.map((f) => f.trade.id));
  const others = all.filter((f) => !ids.has(f.trade.id));
  return {
    pnl: sum(evidence.map((f) => f.trade.pnl)),
    avgReturn: mean(evidence.map((f) => f.trade.ret)),
    otherAvgReturn: others.length ? mean(others.map((f) => f.trade.ret)) : NaN,
    trades: evidence.length,
  };
}

const newestFirst = (fs: TradeFacts[]) => [...fs].sort((a, b) => b.trade.entryT - a.trade.entryT).map((f) => f.trade.id);

/**
 * Share of closed-market hours (with trading) in which a ticker's rToken was beyond `threshold`
 * since the last close, over [from, to]. This is how often the trader *could* have hit such a moment by chance.
 */
function closedMoveRate(grid: MarketGrid, ticker: string, from: number, to: number, threshold: number): number {
  const g = grid.byTicker.get(ticker);
  if (!g) return 0;
  let n = 0;
  let k = 0;
  for (let i = 0; i < grid.hours.length; i++) {
    const t = grid.hours[i];
    if (t < from || t > to) continue;
    const s = grid.sessions[i];
    if (s !== "overnight" && s !== "weekend" && s !== "holiday") continue;
    const mv = g.moveSinceClose[i];
    if (Number.isNaN(mv)) continue;
    n++;
    if (threshold > 0 ? mv >= threshold : mv <= threshold) k++;
  }
  return n ? k / n : 0;
}

/** Base rate weighted by how often the trader acted on each ticker. */
function weightedBaseRate(grid: MarketGrid, sample: TradeFacts[], from: number, to: number, threshold: number): number {
  const counts = new Map<string, number>();
  for (const f of sample) counts.set(f.trade.ticker, (counts.get(f.trade.ticker) ?? 0) + 1);
  let total = 0;
  let acc = 0;
  for (const [ticker, c] of counts) {
    acc += c * closedMoveRate(grid, ticker, from, to, threshold);
    total += c;
  }
  return total ? acc / total : 0;
}

function detectChasing(facts: TradeFacts[], grid: MarketGrid, from: number, to: number): HabitFinding {
  const closedEntries = facts.filter((f) => f.entryClosed && f.entryMove != null);
  const chases = closedEntries.filter((f) => f.entryMove! >= CHASE_MOVE);
  const n = closedEntries.length;
  const k = chases.length;
  const base = weightedBaseRate(grid, closedEntries, from, to, CHASE_MOVE);
  const p = binomialUpperTail(k, n, base);
  const rate = n ? k / n : 0;
  const v = verdict(p, n >= 5, k >= 4 && rate >= 2 * base);
  const cost = costOf(chases, facts);
  const metrics = {
    closedEntries: n,
    chaseEntries: k,
    chaseRate: rate,
    chanceRate: base,
    avgMoveAtEntry: chases.length ? mean(chases.map((f) => f.entryMove!)) : 0,
    thresholdMove: CHASE_MOVE,
  };
  const summary =
    v.status === "detected"
      ? `${k} of your ${n} buys while the US market was closed came after the rToken had already jumped ${pctText(CHASE_MOVE)} or more since the close (on average ${pctText(metrics.avgMoveAtEntry)}). By chance you'd expect about ${(base * 100).toFixed(0)}% of buys to land in moments like that; yours was ${(rate * 100).toFixed(0)}%.`
      : v.status === "insufficient-data"
        ? `Only ${n} buys while the market was closed: not enough to judge.`
        : `No sign of chasing: ${k} of ${n} closed-market buys came after a big move, about what chance would give.`;
  return { id: "closed-chasing", title: HABIT_TITLES["closed-chasing"], ...v, pValue: p, evidence: newestFirst(chases), metrics, cost, summary };
}

function detectPanic(facts: TradeFacts[], grid: MarketGrid, from: number, to: number): HabitFinding {
  const closedExits = facts.filter((f) => f.exitClosed && f.exitMove != null);
  const panics = closedExits.filter((f) => f.exitMove! <= PANIC_MOVE);
  const n = closedExits.length;
  const k = panics.length;
  const base = weightedBaseRate(grid, closedExits, from, to, PANIC_MOVE);
  const p = binomialUpperTail(k, n, base);
  const rate = n ? k / n : 0;
  const v = verdict(p, n >= 5, k >= 4 && rate >= 2 * base);
  const reopen = panics.filter((f) => f.afterToOpen != null);
  const missed = sum(reopen.map((f) => f.afterToOpen! * f.trade.proceeds));
  const metrics = {
    closedExits: n,
    panicExits: k,
    panicRate: rate,
    chanceRate: base,
    avgMoveAtExit: panics.length ? mean(panics.map((f) => f.exitMove!)) : 0,
    avgMoveToNextOpen: reopen.length ? mean(reopen.map((f) => f.afterToOpen!)) : 0,
    usdChangeByNextOpen: missed,
    thresholdMove: PANIC_MOVE,
  };
  const summary =
    v.status === "detected"
      ? `${k} of your ${n} sells while the US market was closed came after the rToken had dropped ${pctText(PANIC_MOVE)} or more since the close. Chance would explain about ${(base * 100).toFixed(0)}%; yours was ${(rate * 100).toFixed(0)}%. By the next US open those rTokens had moved ${pctText(metrics.avgMoveToNextOpen)} on average (${money(missed)} on what you sold).`
      : v.status === "insufficient-data"
        ? `Only ${n} sells while the market was closed: not enough to judge.`
        : `No sign of panic selling: ${k} of ${n} closed-market sells came after a big drop, about what chance would give.`;
  return { id: "closed-panic", title: HABIT_TITLES["closed-panic"], ...v, pValue: p, evidence: newestFirst(panics), metrics, cost: costOf(panics, facts), summary };
}

function detectEarnings(facts: TradeFacts[], from: number, to: number): HabitFinding {
  const windowH = Math.max(1, (to - from) / HOUR);
  let expected = 0;
  for (const f of facts) {
    const reactions = marketData(f.trade.ticker).earnings.filter((e) => e.reactionAt >= from && e.reactionAt <= to).length;
    expected += Math.min(1, (reactions * f.holdHours) / windowH);
  }
  const held = facts.filter((f) => f.earnings);
  const k = held.length;
  const p = poissonUpperTail(k, expected);
  const v = verdict(p, facts.length >= 20, k >= 3 && k >= 2 * expected);
  const metrics = {
    tradesThroughEarnings: k,
    expectedByChance: expected,
    avgAbsReturn: k ? mean(held.map((f) => Math.abs(f.trade.ret))) : 0,
    otherAvgAbsReturn: mean(facts.filter((f) => !f.earnings).map((f) => Math.abs(f.trade.ret))),
    worstReturn: k ? Math.min(...held.map((f) => f.trade.ret)) : 0,
  };
  const cost = costOf(held, facts);
  const summary =
    v.status === "detected"
      ? `You held ${k} trades through an earnings report; with your usual holding times chance would give about ${expected.toFixed(1)}. Those trades swung ${pctText(metrics.avgAbsReturn).replace("+", "±")} on average vs ${pctText(metrics.otherAvgAbsReturn).replace("+", "±")} for your other trades, and ${madeOrLost(cost!.pnl)} in total.`
      : v.status === "insufficient-data"
        ? `Not enough trades to judge earnings behaviour yet.`
        : `No sign of earnings gambling: ${k} trades crossed an earnings report, about what your holding times would give by chance (${expected.toFixed(1)}).`;
  return { id: "earnings-roulette", title: HABIT_TITLES["earnings-roulette"], ...v, pValue: p, evidence: newestFirst(held), metrics, cost, summary };
}

/**
 * Disposition effect. Two tests that market drift biases in opposite directions:
 *  1. Exits happen in profit more often than the time spent in profit would predict
 *     (the primary test; it must be significant).
 *  2. Losers are held longer than winners (weaker; it must point the same way, p < 0.25).
 * Requiring the second to agree protects against a market trend masquerading as the habit.
 */
export const DISPOSITION_CONFIRM_P = 0.25;

function detectDisposition(facts: TradeFacts[]): HabitFinding {
  const winners = facts.filter((f) => f.trade.ret > 0);
  const losers = facts.filter((f) => f.trade.ret <= 0);
  const pHold = mannWhitneyGreater(losers.map((f) => f.holdHours), winners.map((f) => f.holdHours));
  const ratio = median(losers.map((f) => f.holdHours)) / Math.max(1, median(winners.map((f) => f.holdHours)));

  let upHours = 0;
  let totalHours = 0;
  for (const f of facts) {
    const bars = between(marketData(f.trade.ticker).rToken1h, f.trade.entryT + HOUR, f.trade.exitT);
    for (const b of bars) {
      totalHours++;
      if (b.c > f.trade.entryPrice) upHours++;
    }
  }
  const q = totalHours ? upHours / totalHours : 0.5;
  const pExit = binomialUpperTail(winners.length, facts.length, Math.min(0.999, Math.max(0.001, q)));
  const p = pExit;
  const v = verdict(p, winners.length >= 8 && losers.length >= 8, pHold < DISPOSITION_CONFIRM_P && ratio >= 1.2);

  const after = winners.filter((f) => f.after24h != null);
  const metrics = {
    winners: winners.length,
    losers: losers.length,
    medianWinnerHoldHours: median(winners.map((f) => f.holdHours)),
    medianLoserHoldHours: median(losers.map((f) => f.holdHours)),
    holdRatio: ratio,
    holdTestP: pHold,
    avgWin: mean(winners.map((f) => f.trade.ret)),
    avgLoss: mean(losers.map((f) => f.trade.ret)),
    timeInProfitShare: q,
    exitsInProfitShare: facts.length ? winners.length / facts.length : 0,
    winnerAvgMove24hAfterExit: after.length ? mean(after.map((f) => f.after24h!)) : 0,
    usdLeftOnTable24h: sum(after.map((f) => f.after24h! * f.trade.proceeds)),
  };
  const evidence = [...winners.filter((f) => f.holdHours <= metrics.medianWinnerHoldHours), ...losers.filter((f) => f.holdHours >= metrics.medianLoserHoldHours)];
  const summary =
    v.status === "detected"
      ? `You hold losing trades ${ratio.toFixed(1)}× longer than winning ones (median ${metrics.medianLoserHoldHours.toFixed(0)}h vs ${metrics.medianWinnerHoldHours.toFixed(0)}h). Your open positions spent only ${(q * 100).toFixed(0)}% of their time in profit, yet ${(metrics.exitsInProfitShare * 100).toFixed(0)}% of your exits were winners: you take gains fast (avg ${pctText(metrics.avgWin)}) and let losses run (avg ${pctText(metrics.avgLoss)}).`
      : v.status === "insufficient-data"
        ? `Need at least 8 winning and 8 losing trades to judge how you exit.`
        : `Your exits look balanced: winners and losers are held for similar lengths of time.`;
  return { id: "cutting-winners", title: HABIT_TITLES["cutting-winners"], ...v, pValue: p, evidence: newestFirst(evidence), metrics, cost: null, summary };
}

function detectRevenge(facts: TradeFacts[]): HabitFinding {
  const afterLoss = facts.filter((f) => f.prev && f.prev.pnl < 0 && f.prev.hoursSinceExit <= REVENGE_WINDOW_HOURS);
  const ids = new Set(afterLoss.map((f) => f.trade.id));
  const others = facts.filter((f) => !ids.has(f.trade.id));
  const p = mannWhitneyGreater(afterLoss.map((f) => f.relSize), others.map((f) => f.relSize));
  const ratio = median(afterLoss.map((f) => f.relSize)) / median(others.map((f) => f.relSize));
  const v = verdict(p, afterLoss.length >= 4 && others.length >= 10, ratio >= 1.3);
  const big = afterLoss.filter((f) => f.relSize >= 1.3);
  const cost = costOf(afterLoss, facts);
  const metrics = {
    tradesSoonAfterLoss: afterLoss.length,
    sizeRatio: ratio,
    medianSizeAfterLoss: median(afterLoss.map((f) => f.trade.cost)),
    medianSizeOtherwise: median(others.map((f) => f.trade.cost)),
    windowHours: REVENGE_WINDOW_HOURS,
  };
  const summary =
    v.status === "detected"
      ? `${afterLoss.length} times you opened a new trade within ${REVENGE_WINDOW_HOURS}h of closing a loss, and those trades were ${ratio.toFixed(1)}× your usual size (median ${money(metrics.medianSizeAfterLoss)} vs ${money(metrics.medianSizeOtherwise)}). Together they ${madeOrLost(cost!.pnl)}.`
      : v.status === "insufficient-data"
        ? `Not enough trades right after a loss to judge.`
        : `No sign of revenge trading: trades right after a loss are your normal size.`;
  return { id: "revenge", title: HABIT_TITLES.revenge, ...v, pValue: p, evidence: newestFirst(big.length ? big : afterLoss), metrics, cost, summary };
}

export interface Review {
  from: number;
  to: number;
  findings: HabitFinding[];
}

export function findHabits(facts: TradeFacts[], grid: MarketGrid = marketGrid()): Review {
  if (!facts.length) return { from: 0, to: 0, findings: [] };
  const from = Math.min(...facts.map((f) => f.trade.entryT));
  const to = Math.max(...facts.map((f) => f.trade.exitT));
  const findings = [
    detectChasing(facts, grid, from, to),
    detectPanic(facts, grid, from, to),
    detectEarnings(facts, from, to),
    detectDisposition(facts),
    detectRevenge(facts),
  ];
  return { from, to, findings };
}
