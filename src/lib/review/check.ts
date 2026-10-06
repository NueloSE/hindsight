import { marketData } from "../market/data";
import type { EarningsEvent } from "../market/earnings";
import { HOUR, isUnderlyingClosed, type Session } from "../market/sessions";
import { CHASE_MOVE, PANIC_MOVE } from "../sim/generate";
import { REVENGE_WINDOW_HOURS } from "./patterns";
import type { TradeFacts } from "./replay";
import { REVENGE_SIZE_CAP, STOP_LOSS, type Rule } from "./rules";
import { mean, median, sum } from "./stats";

/**
 * Pre-trade check. Everything here is deterministic: the AI only parses the idea beforehand and
 * explains the result afterwards. Hindsight never places the trade; the trader decides.
 */

export interface TradeIdea {
  ticker: string;
  side: "buy" | "sell";
  /** Intended size in USDT, if the trader said. */
  usd: number | null;
  /** When the trade would happen (epoch ms). */
  at: number;
}

export interface IdeaContext {
  at: number;
  session: Session;
  marketClosed: boolean;
  price: number | null;
  lastClose: number | null;
  moveSinceClose: number | null;
  premium: number | null;
  nextEarnings: EarningsEvent | null;
  hoursToEarnings: number | null;
  source: "snapshot" | "live";
}

export interface RuleHit {
  rule: Rule;
  kind: "violation" | "reminder";
  reason: string;
  /** The trader's own past trades that match this situation. */
  evidence: string[];
  history: { trades: number; winRate: number; avgReturn: number; pnl: number } | null;
}

export interface SimilarTrade {
  id: string;
  ticker: string;
  entryT: number;
  ret: number;
  pnl: number;
  score: number;
}

export interface CheckResult {
  idea: TradeIdea;
  context: IdeaContext;
  verdict: "clear" | "caution" | "matches-habit";
  hits: RuleHit[];
  /** Size compared with the trader's median trade, when a size was given. */
  sizeVsNormal: number | null;
  normalSize: number;
  similar: SimilarTrade[];
  similarStats: { trades: number; winRate: number; avgReturn: number } | null;
}

/** Market context at a moment covered by the stored snapshots. */
export function snapshotContext(ticker: string, at: number): IdeaContext {
  const m = marketData(ticker);
  const g = m.gap.at(at);
  const next = m.earnings.find((e) => e.reactionAt > at) ?? null;
  return {
    at,
    session: g.session,
    marketClosed: isUnderlyingClosed(g.session),
    price: g.rTokenPrice,
    lastClose: g.lastClose,
    moveSinceClose: g.moveSinceClose,
    premium: g.premium,
    nextEarnings: next,
    hoursToEarnings: next ? (next.reactionAt - at) / HOUR : null,
    source: "snapshot",
  };
}

function historyOf(facts: TradeFacts[]): RuleHit["history"] {
  if (!facts.length) return null;
  return {
    trades: facts.length,
    winRate: facts.filter((f) => f.trade.pnl > 0).length / facts.length,
    avgReturn: mean(facts.map((f) => f.trade.ret)),
    pnl: sum(facts.map((f) => f.trade.pnl)),
  };
}

const ids = (fs: TradeFacts[]) => [...fs].sort((a, b) => b.trade.entryT - a.trade.entryT).map((f) => f.trade.id);
const pct = (x: number) => `${x >= 0 ? "+" : "−"}${(Math.abs(x) * 100).toFixed(1)}%`;

export function checkIdea(idea: TradeIdea, ctx: IdeaContext, rules: Rule[], allFacts: TradeFacts[]): CheckResult {
  // Only trades already closed at the moment of the idea count as history (no peeking at the future).
  const facts = allFacts.filter((f) => f.trade.exitT <= idea.at);
  const normalSize = median(facts.map((f) => f.trade.cost)) || 0;
  const medianHold = median(facts.map((f) => f.holdHours)) || 24;
  const sizeVsNormal = idea.usd && normalSize ? idea.usd / normalSize : null;
  const move = ctx.moveSinceClose;
  const hits: RuleHit[] = [];

  const lastExit = [...facts].sort((a, b) => b.trade.exitT - a.trade.exitT)[0];

  for (const rule of rules) {
    switch (rule.id) {
      case "closed-chasing": {
        if (idea.side === "buy" && ctx.marketClosed && move != null && move >= CHASE_MOVE) {
          const past = facts.filter((f) => f.entryClosed && (f.entryMove ?? 0) >= CHASE_MOVE);
          hits.push({
            rule,
            kind: "violation",
            reason: `The US market is closed and ${idea.ticker} is already ${pct(move)} since the last close.`,
            evidence: ids(past),
            history: historyOf(past),
          });
        }
        break;
      }
      case "closed-panic": {
        if (idea.side === "sell" && ctx.marketClosed && move != null && move <= PANIC_MOVE) {
          const past = facts.filter((f) => f.exitClosed && (f.exitMove ?? 0) <= PANIC_MOVE);
          hits.push({
            rule,
            kind: "violation",
            reason: `The US market is closed and ${idea.ticker} is ${pct(move)} since the last close; liquidity is thin until the open.`,
            evidence: ids(past),
            history: historyOf(past),
          });
        }
        break;
      }
      case "earnings-roulette": {
        if (idea.side === "buy" && ctx.nextEarnings && ctx.hoursToEarnings != null && ctx.hoursToEarnings <= medianHold * 1.5) {
          const past = facts.filter((f) => f.earnings);
          hits.push({
            rule,
            kind: "violation",
            reason: `${idea.ticker} reports earnings (reaction ${new Date(ctx.nextEarnings.reactionAt).toUTCString().slice(0, 16)}), inside your typical holding time of ${medianHold.toFixed(0)}h.`,
            evidence: ids(past),
            history: historyOf(past),
          });
        }
        break;
      }
      case "revenge": {
        const sinceLoss = lastExit && lastExit.trade.pnl < 0 ? (idea.at - lastExit.trade.exitT) / HOUR : null;
        if (idea.side === "buy" && sinceLoss != null && sinceLoss <= REVENGE_WINDOW_HOURS) {
          const oversized = sizeVsNormal != null && sizeVsNormal > REVENGE_SIZE_CAP;
          const past = facts.filter((f) => f.prev && f.prev.pnl < 0 && f.prev.hoursSinceExit <= REVENGE_WINDOW_HOURS);
          hits.push({
            rule,
            kind: oversized ? "violation" : "reminder",
            reason: oversized
              ? `You closed a loss ${sinceLoss.toFixed(0)}h ago and this trade is ${sizeVsNormal!.toFixed(1)}× your normal size.`
              : `You closed a loss ${sinceLoss.toFixed(0)}h ago. Keep this one at or below ${REVENGE_SIZE_CAP}× your normal size.`,
            evidence: ids(past),
            history: historyOf(past),
          });
        }
        break;
      }
      case "cutting-winners": {
        if (idea.side === "buy") {
          hits.push({
            rule,
            kind: "reminder",
            reason: `Decide your exit now: a stop at −${(STOP_LOSS * 100).toFixed(1)}%${ctx.price ? ` (about ${(ctx.price * (1 - STOP_LOSS)).toFixed(2)})` : ""}, and give a winner as long as you'd give a loser.`,
            evidence: [],
            history: null,
          });
        }
        break;
      }
    }
  }

  // Similar past trades: same stock, same market state, similar move, earnings nearby.
  const bucket = (x: number | null) => (x == null ? 0 : x >= CHASE_MOVE ? 1 : x <= PANIC_MOVE ? -1 : 0);
  const nearEarnings = ctx.hoursToEarnings != null && ctx.hoursToEarnings <= medianHold * 1.5;
  const scored = facts
    .map((f) => ({
      f,
      score:
        (f.trade.ticker === idea.ticker ? 2 : 0) +
        (f.entryClosed === ctx.marketClosed ? 1 : 0) +
        (bucket(f.entryMove) === bucket(move) ? 1 : 0) +
        ((f.earnings != null) === nearEarnings ? 1 : 0),
    }))
    .filter((x) => x.score >= 4)
    .sort((a, b) => b.score - a.score || b.f.trade.entryT - a.f.trade.entryT);
  const similar = scored.slice(0, 6).map(({ f, score }) => ({ id: f.trade.id, ticker: f.trade.ticker, entryT: f.trade.entryT, ret: f.trade.ret, pnl: f.trade.pnl, score }));
  const all = scored.map((x) => x.f);

  const violations = hits.filter((h) => h.kind === "violation").length;
  const verdict = violations ? "matches-habit" : sizeVsNormal != null && sizeVsNormal > 1.5 ? "caution" : "clear";

  return {
    idea,
    context: ctx,
    verdict,
    hits,
    sizeVsNormal,
    normalSize,
    similar,
    similarStats: all.length
      ? { trades: all.length, winRate: all.filter((f) => f.trade.pnl > 0).length / all.length, avgReturn: mean(all.map((f) => f.trade.ret)) }
      : null,
  };
}
