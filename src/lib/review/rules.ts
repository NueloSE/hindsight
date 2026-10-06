import { marketData } from "../market/data";
import { HOUR } from "../market/sessions";
import { indexAtOrBefore } from "../market/series";
import { CHASE_MOVE, PANIC_MOVE, type HabitId } from "../sim/generate";
import type { HabitFinding, Review } from "./patterns";
import { REVENGE_WINDOW_HOURS } from "./patterns";
import type { TradeFacts } from "./replay";
import { median, sum } from "./stats";

/**
 * Personal rules. Each detected habit becomes a rule with a machine-checkable condition and a
 * "what if you'd followed it" figure replayed on the trader's own history.
 * A positive `whatIf.usd` means the rule would have made (or saved) money; negative means it would have cost money.
 */
export interface Rule {
  id: HabitId;
  title: string;
  text: string;
  params: Record<string, number>;
  whatIf: {
    usd: number;
    tradesAffected: number;
    /** How the counterfactual was computed, in plain English. */
    method: string;
    /** Risk before and after: worst single trade return and deepest drawdown of the P&L curve (USD, positive). */
    risk: { worstTradeBefore: number; worstTradeAfter: number; maxDrawdownBefore: number; maxDrawdownAfter: number };
  };
}

/** Per-trade alternative outcome under a rule: a new P&L, or null when the trade would not have been taken. */
type Alternative = Map<string, { pnl: number; ret: number } | null>;

/** Deepest peak-to-trough fall of cumulative P&L, trades ordered by exit. */
function maxDrawdown(points: { t: number; pnl: number }[]): number {
  let equity = 0;
  let peak = 0;
  let worst = 0;
  for (const p of [...points].sort((a, b) => a.t - b.t)) {
    equity += p.pnl;
    peak = Math.max(peak, equity);
    worst = Math.max(worst, peak - equity);
  }
  return worst;
}

function evaluate(facts: TradeFacts[], alt: Alternative, method: string): Rule["whatIf"] {
  const before = facts.map((f) => ({ t: f.trade.exitT, pnl: f.trade.pnl, ret: f.trade.ret }));
  const after = facts.flatMap((f) => {
    if (!alt.has(f.trade.id)) return [{ t: f.trade.exitT, pnl: f.trade.pnl, ret: f.trade.ret }];
    const a = alt.get(f.trade.id);
    return a ? [{ t: f.trade.exitT, pnl: a.pnl, ret: a.ret }] : [];
  });
  const total = (xs: { pnl: number }[]) => sum(xs.map((x) => x.pnl));
  return {
    usd: total(after) - total(before),
    tradesAffected: alt.size,
    method,
    risk: {
      worstTradeBefore: Math.min(0, ...before.map((x) => x.ret)),
      worstTradeAfter: Math.min(0, ...after.map((x) => x.ret)),
      maxDrawdownBefore: maxDrawdown(before),
      maxDrawdownAfter: maxDrawdown(after),
    },
  };
}

const STOP_LOSS = 0.03;
const REVENGE_SIZE_CAP = 1.2;

const pct = (x: number) => `${(Math.abs(x) * 100).toFixed(1)}%`;

/** Price of the last rToken bar that opened before `t`. */
function priceBefore(ticker: string, t: number): number | null {
  const bars = marketData(ticker).rToken1h;
  const i = indexAtOrBefore(bars, t - HOUR);
  return i >= 0 ? bars[i].c : null;
}

function chasingRule(f: HabitFinding, facts: TradeFacts[]): Rule {
  const ids = new Set(f.evidence);
  const alt: Alternative = new Map(facts.filter((x) => ids.has(x.trade.id)).map((x) => [x.trade.id, null]));
  return {
    id: "closed-chasing",
    title: "Don't chase while Wall Street sleeps",
    text: `While the US market is closed, don't buy an rToken that is already up ${pct(CHASE_MOVE)} or more since the last close. Wait for the open.`,
    params: { maxMoveSinceClose: CHASE_MOVE },
    whatIf: evaluate(facts, alt, "Skips every closed-market buy that came after a move at or above the threshold."),
  };
}

function panicRule(f: HabitFinding, facts: TradeFacts[]): Rule {
  const ids = new Set(f.evidence);
  const alt: Alternative = new Map();
  for (const x of facts) {
    if (!ids.has(x.trade.id) || x.afterToOpen == null) continue;
    const proceeds = x.trade.proceeds * (1 + x.afterToOpen);
    const pnl = proceeds - x.trade.cost - x.trade.fees;
    alt.set(x.trade.id, { pnl, ret: pnl / x.trade.cost });
  }
  return {
    id: "closed-panic",
    title: "Don't panic-sell a closed market",
    text: `While the US market is closed, don't sell into a drop of ${pct(PANIC_MOVE)} or more since the close. Decide at the next US open, when real liquidity is back.`,
    params: { maxDropSinceClose: PANIC_MOVE },
    whatIf: evaluate(facts, alt, "Moves each of those sells to the rToken price at the next regular US open."),
  };
}

function earningsRule(_f: HabitFinding, facts: TradeFacts[]): Rule {
  const alt: Alternative = new Map();
  for (const x of facts) {
    if (!x.earnings) continue;
    const p = priceBefore(x.trade.ticker, x.earnings.reactionAt);
    if (!p) continue;
    const pnl = x.trade.qty * p - x.trade.cost - x.trade.fees;
    alt.set(x.trade.id, { pnl, ret: pnl / x.trade.cost });
  }
  return {
    id: "earnings-roulette",
    title: "Be flat before earnings",
    text: "Close positions before a company reports earnings. If you want exposure, re-enter after the report.",
    params: {},
    whatIf: evaluate(facts, alt, "Exits each trade that crossed an earnings report at the last rToken price before the report's first regular session."),
  };
}

function stopLossRule(_f: HabitFinding, facts: TradeFacts[]): Rule {
  // Trades whose path touched the stop would have been closed at the stop, winners included.
  const alt: Alternative = new Map();
  for (const x of facts) {
    if (x.mae > -STOP_LOSS) continue;
    const pnl = x.trade.cost * -STOP_LOSS - x.trade.fees;
    alt.set(x.trade.id, { pnl, ret: pnl / x.trade.cost });
  }
  return {
    id: "cutting-winners",
    title: `Cut losers at −${pct(STOP_LOSS)}`,
    text: `Set a stop at −${pct(STOP_LOSS)} when you open a trade and don't move it. Give winners the same patience you give losers.`,
    params: { stopLoss: -STOP_LOSS },
    whatIf: evaluate(
      facts,
      alt,
      `Closes every trade at −${pct(STOP_LOSS)} the first time hourly prices touched that level, including trades that later recovered. Assumes the stop filled at its level.`,
    ),
  };
}

function revengeRule(_f: HabitFinding, facts: TradeFacts[]): Rule {
  const normal = median(facts.map((x) => x.trade.cost));
  const alt: Alternative = new Map();
  for (const x of facts) {
    if (!(x.prev && x.prev.pnl < 0 && x.prev.hoursSinceExit <= REVENGE_WINDOW_HOURS && x.trade.cost > normal * REVENGE_SIZE_CAP)) continue;
    alt.set(x.trade.id, { pnl: x.trade.pnl * ((normal * REVENGE_SIZE_CAP) / x.trade.cost), ret: x.trade.ret });
  }
  return {
    id: "revenge",
    title: "No oversized trades after a loss",
    text: `For ${REVENGE_WINDOW_HOURS} hours after closing a losing trade, never size above ${REVENGE_SIZE_CAP}× your normal position ($${normal.toFixed(0)}).`,
    params: { windowHours: REVENGE_WINDOW_HOURS, sizeCap: REVENGE_SIZE_CAP, normalSize: normal },
    whatIf: evaluate(
      facts,
      alt,
      `Scales each oversized trade opened within ${REVENGE_WINDOW_HOURS}h of a loss down to ${REVENGE_SIZE_CAP}× your median size, keeping its return.`,
    ),
  };
}

const BUILDERS: Record<HabitId, (f: HabitFinding, facts: TradeFacts[]) => Rule> = {
  "closed-chasing": chasingRule,
  "closed-panic": panicRule,
  "earnings-roulette": earningsRule,
  "cutting-winners": stopLossRule,
  revenge: revengeRule,
};

/** One rule per detected habit. */
export function buildRules(review: Review, facts: TradeFacts[]): Rule[] {
  return review.findings.filter((f) => f.status === "detected").map((f) => BUILDERS[f.id](f, facts));
}

export { REVENGE_SIZE_CAP, STOP_LOSS };
