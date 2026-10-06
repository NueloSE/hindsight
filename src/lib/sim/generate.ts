import { HOUR, isUnderlyingClosed, nextRegularOpen, type Session } from "../market/sessions";
import { matchFills } from "../trades/match";
import type { Fill, TradeBook } from "../trades/types";
import { hourIndex, marketGrid, type MarketGrid } from "./grid";
import { Rng } from "./random";

/**
 * Simulated traders on real market data. Each trader has neutral baseline behaviour plus optional
 * habits with a strength in (0, 1]. Used for the sample trader and for the blind accuracy test:
 * the generator records which habits were planted so the detector can be scored.
 */

export const HABITS = ["closed-chasing", "closed-panic", "earnings-roulette", "cutting-winners", "revenge"] as const;
export type HabitId = (typeof HABITS)[number];

export interface TraderProfile {
  name: string;
  seed: number;
  from: number;
  to: number;
  tickers: { ticker: string; weight: number }[];
  /** Baseline (habit-free) entries per week. */
  tradesPerWeek: number;
  /** Typical position size in USDT. */
  baseSize: number;
  sizeSigma: number;
  holdMedianHours: number;
  holdSigma: number;
  /** Relative preference for entering in each session. */
  sessionBias: Record<Session, number>;
  maxOpen: number;
  feeRate: number;
  habits: Partial<Record<HabitId, number>>;
}

export interface SimulatedTrader {
  profile: TraderProfile;
  fills: Fill[];
  book: TradeBook;
  /** Habits that drove each trade, keyed by trade id (`TICKER-entryT`). */
  tradeTags: Record<string, HabitId[]>;
}

/** Move thresholds (fraction) that trigger the closed-market habits. */
export const CHASE_MOVE = 0.015;
export const PANIC_MOVE = -0.015;

interface Position {
  ticker: string;
  entryIdx: number;
  entryT: number;
  qty: number;
  cost: number;
  plannedExitIdx: number;
  takeProfit: number;
  extended: boolean;
  tags: Set<HabitId>;
}

interface PendingEntry {
  atIdx: number;
  deadlineIdx: number;
  ticker: string | null;
  sizeMult: number;
  tag: HabitId;
  /** Hold at least until this time (ms). */
  holdUntil?: number;
}

export function simulateTrader(profile: TraderProfile, grid: MarketGrid = marketGrid()): SimulatedTrader {
  const rng = new Rng(profile.seed);
  const h = profile.habits;
  const fills: Fill[] = [];
  const tradeTags: Record<string, HabitId[]> = {};
  const open = new Map<string, Position>();
  const pending: PendingEntry[] = [];
  const lastChase = new Map<string, number>();
  const plannedEarnings = new Set<string>();
  let fillNo = 0;

  const tickers = profile.tickers.filter((t) => grid.byTicker.has(t.ticker));
  const weightOf = new Map(tickers.map((t) => [t.ticker, t.weight]));
  const biasMean = (["regular", "pre", "post", "overnight", "weekend"] as const).reduce((s, k) => s + profile.sessionBias[k], 0) / 5;
  const baseRatePerHour = profile.tradesPerWeek / 168;

  const start = hourIndex(grid, profile.from);
  const end = Math.min(hourIndex(grid, profile.to), grid.hours.length - 1);
  const priceAt = (ticker: string, i: number) => grid.byTicker.get(ticker)!.price[i];

  const addFill = (i: number, ticker: string, side: Fill["side"], qty: number, price: number, fee: number) => {
    fills.push({ id: `${profile.seed}-${++fillNo}`, t: grid.hours[i], ticker, side, qty, price, fee });
  };

  const holdHours = () => Math.max(1, Math.round(rng.logNormal(profile.holdMedianHours, profile.holdSigma)));
  const size = (mult = 1) => profile.baseSize * mult * Math.exp(rng.normal(0, profile.sizeSigma));

  function openPosition(i: number, ticker: string, sizeMult: number, tags: HabitId[], plannedExitIdx?: number): boolean {
    const p = priceAt(ticker, i);
    if (Number.isNaN(p) || open.has(ticker)) return false;
    const fillPrice = p * (1 + rng.uniform(0, 0.0005));
    const notional = size(sizeMult);
    const qty = notional / fillPrice;
    addFill(i, ticker, "buy", qty, fillPrice, notional * profile.feeRate);

    const pos: Position = {
      ticker,
      entryIdx: i,
      entryT: grid.hours[i],
      qty,
      cost: notional,
      plannedExitIdx: plannedExitIdx ?? i + holdHours(),
      takeProfit: rng.uniform(0.008, 0.025),
      extended: false,
      tags: new Set(tags),
    };

    // Earnings roulette: stretch the hold across an upcoming earnings reaction.
    const s = h["earnings-roulette"] ?? 0;
    if (s > 0) {
      const reaction = grid.byTicker.get(ticker)!.earningsReactions.find((r) => r > pos.entryT && r - pos.entryT <= 10 * 24 * HOUR);
      if (reaction && grid.hours[pos.plannedExitIdx] < reaction && rng.chance(s)) {
        pos.plannedExitIdx = hourIndex(grid, reaction + rng.uniform(2, 48) * HOUR);
        pos.tags.add("earnings-roulette");
      }
    }
    open.set(ticker, pos);
    return true;
  }

  function closePosition(i: number, pos: Position, reason?: HabitId) {
    const p = priceAt(pos.ticker, i);
    const fillPrice = p * (1 - rng.uniform(0, 0.0005));
    const proceeds = pos.qty * fillPrice;
    addFill(i, pos.ticker, "sell", pos.qty, fillPrice, proceeds * profile.feeRate);
    if (reason) pos.tags.add(reason);
    if (pos.tags.size) tradeTags[`${pos.ticker}-${pos.entryT}`] = [...pos.tags];
    open.delete(pos.ticker);

    const pnl = proceeds * (1 - profile.feeRate) - pos.cost * (1 + profile.feeRate);
    const s = h.revenge ?? 0;
    if (pnl < 0 && s > 0 && rng.chance(s)) {
      const atIdx = i + rng.int(1, 6);
      pending.push({
        atIdx,
        deadlineIdx: atIdx + 6,
        ticker: rng.chance(0.5) ? pos.ticker : null,
        sizeMult: rng.uniform(1.6, 2.6),
        tag: "revenge",
      });
    }
  }

  for (let i = start; i <= end; i++) {
    const t = grid.hours[i];
    const session = grid.sessions[i];
    const closed = isUnderlyingClosed(session);

    // 1. Exits
    for (const pos of [...open.values()]) {
      const p = priceAt(pos.ticker, i);
      if (Number.isNaN(p)) continue; // nobody traded this hour; can't exit
      const unrealized = p / (pos.cost / pos.qty) - 1;
      const move = grid.byTicker.get(pos.ticker)!.moveSinceClose[i];

      const cw = h["cutting-winners"] ?? 0;
      if (cw > 0 && unrealized >= pos.takeProfit && rng.chance(cw * 0.35)) {
        closePosition(i, pos, "cutting-winners");
        continue;
      }
      const pn = h["closed-panic"] ?? 0;
      if (pn > 0 && closed && move <= PANIC_MOVE && unrealized < 0 && rng.chance(pn * 0.6)) {
        closePosition(i, pos, "closed-panic");
        continue;
      }
      if (i >= pos.plannedExitIdx) {
        if (cw > 0 && unrealized < 0 && !pos.extended && rng.chance(cw)) {
          // Disposition effect: refuse to realise the loss, hold longer.
          pos.extended = true;
          pos.plannedExitIdx = i + Math.round(holdHours() * (1 + 2 * cw));
          pos.tags.add("cutting-winners");
          continue;
        }
        closePosition(i, pos);
      }
    }

    // 2. Scheduled (revenge) entries
    for (let k = pending.length - 1; k >= 0; k--) {
      const e = pending[k];
      if (i < e.atIdx) continue;
      const candidates = e.ticker ? [e.ticker] : tickers.map((x) => x.ticker);
      const ticker = rng.weighted(
        candidates.filter((c) => !open.has(c) && !Number.isNaN(priceAt(c, i))),
        (c) => weightOf.get(c) ?? 1,
      );
      const exitIdx = e.holdUntil ? hourIndex(grid, e.holdUntil) : undefined;
      if (ticker && openPosition(i, ticker, e.sizeMult, [e.tag], exitIdx)) pending.splice(k, 1);
      else if (i >= e.deadlineIdx) pending.splice(k, 1);
    }

    // 3. Closed-market chasing
    const ch = h["closed-chasing"] ?? 0;
    if (ch > 0 && closed && open.size < profile.maxOpen) {
      for (const { ticker } of tickers) {
        const move = grid.byTicker.get(ticker)!.moveSinceClose[i];
        if (!(move >= CHASE_MOVE) || open.has(ticker)) continue;
        if (t - (lastChase.get(ticker) ?? -Infinity) < 72 * HOUR) continue;
        if (!rng.chance(ch * 0.12)) continue;
        // Chasers ride the move into the reopen.
        const exitAt = nextRegularOpen(t) + rng.uniform(1, 30) * HOUR;
        if (openPosition(i, ticker, 1, ["closed-chasing"], hourIndex(grid, exitAt))) lastChase.set(ticker, t);
      }
    }

    // 4. Pre-earnings entries for traders who like to gamble on reports
    const er = h["earnings-roulette"] ?? 0;
    if (er > 0 && open.size < profile.maxOpen) {
      for (const { ticker } of tickers) {
        const reaction = grid.byTicker.get(ticker)!.earningsReactions.find((r) => r > t && r - t <= 3 * 24 * HOUR);
        if (!reaction || open.has(ticker)) continue;
        const key = `${ticker}-${reaction}`;
        if (plannedEarnings.has(key)) continue;
        plannedEarnings.add(key);
        if (!rng.chance(er * 0.6)) continue;
        const enterIdx = i + rng.int(0, 24);
        if (grid.hours[enterIdx] >= reaction) continue;
        pending.push({
          atIdx: enterIdx,
          deadlineIdx: enterIdx + 4,
          ticker,
          sizeMult: 1,
          tag: "earnings-roulette",
          holdUntil: reaction + rng.uniform(2, 48) * HOUR,
        });
      }
    }

    // 5. Baseline entries
    const rate = (baseRatePerHour * profile.sessionBias[session]) / biasMean;
    if (open.size < profile.maxOpen && rng.chance(rate)) {
      const ticker = rng.weighted(
        tickers.map((x) => x.ticker).filter((c) => !open.has(c) && !Number.isNaN(priceAt(c, i))),
        (c) => weightOf.get(c) ?? 1,
      );
      if (ticker) openPosition(i, ticker, 1, []);
    }
  }

  return { profile, fills, book: matchFills(fills), tradeTags };
}

/** A random trader for the blind test. Each habit is present with probability `habitRate`. */
export function randomProfile(seed: number, from: number, to: number, habitRate = 0.4): TraderProfile {
  const rng = new Rng(seed * 7919 + 17);
  const all = ["NVDA", "TSLA", "AAPL", "MSFT", "META", "AMZN", "COIN", "MSTR", "PLTR", "SPY", "QQQ"];
  const tickers = rng.shuffle([...all]).slice(0, rng.int(3, 7)).map((ticker) => ({ ticker, weight: rng.uniform(0.3, 1) }));
  const weekend = rng.uniform(0, 1.5);
  const habits: Partial<Record<HabitId, number>> = {};
  for (const id of HABITS) if (rng.chance(habitRate)) habits[id] = Math.round(rng.uniform(0.3, 1) * 100) / 100;

  return {
    name: `Trader ${seed}`,
    seed,
    from,
    to,
    tickers,
    tradesPerWeek: rng.uniform(2.5, 8),
    baseSize: Math.min(50_000, Math.max(100, rng.logNormal(1500, 0.8))),
    sizeSigma: rng.uniform(0.1, 0.4),
    holdMedianHours: Math.min(120, Math.max(3, rng.logNormal(24, 0.6))),
    holdSigma: rng.uniform(0.6, 1.2),
    sessionBias: {
      regular: rng.uniform(0.5, 2),
      pre: rng.uniform(0.2, 1.2),
      post: rng.uniform(0.2, 1.2),
      overnight: rng.uniform(0.1, 1.5),
      weekend,
      holiday: weekend,
    },
    maxOpen: rng.int(2, 4),
    feeRate: 0.001,
    habits,
  };
}
