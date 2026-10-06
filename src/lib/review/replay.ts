import { marketData } from "../market/data";
import type { EarningsEvent } from "../market/earnings";
import { HOUR, isUnderlyingClosed, nextRegularOpen, type Session } from "../market/sessions";
import { between, priceAt } from "../market/series";
import type { Trade } from "../trades/types";
import { median } from "./stats";

/** Everything Hindsight computes about one trade. All values come from market data, never from the model. */
export interface TradeFacts {
  trade: Trade;
  holdHours: number;
  entrySession: Session;
  exitSession: Session;
  /** The US market was closed (overnight / weekend / holiday) at entry. */
  entryClosed: boolean;
  exitClosed: boolean;
  /** rToken move since the underlying's last regular close, at entry (fraction). */
  entryMove: number | null;
  exitMove: number | null;
  /** rToken vs underlying reference at entry (fraction). */
  entryPremium: number | null;
  /** Best and worst unrealised move during the trade, from hourly highs and lows (fractions). */
  mfe: number;
  mae: number;
  /** Share of the best move that was kept at exit (gross), when the trade was ever in profit. */
  capture: number | null;
  /** An earnings reaction fell inside the holding period. */
  earnings: EarningsEvent | null;
  /** rToken move in the 24 hours after exit (fraction). */
  after24h: number | null;
  /** For exits while the market was closed: move from exit to the next regular open (fraction). */
  afterToOpen: number | null;
  /** Position size relative to the trader's median trade. */
  relSize: number;
  /** The trader's most recent closed trade before this entry. */
  prev: { id: string; pnl: number; hoursSinceExit: number } | null;
}

const STALE = 12 * HOUR;

export function replayTrades(trades: Trade[]): TradeFacts[] {
  const sorted = [...trades].sort((a, b) => a.entryT - b.entryT);
  const byExit = [...trades].sort((a, b) => a.exitT - b.exitT);
  const medianCost = median(trades.map((t) => t.cost));

  return sorted.map((trade) => {
    const m = marketData(trade.ticker);
    const entry = m.gap.at(trade.entryT);
    const exit = m.gap.at(trade.exitT);

    // MFE / MAE from hourly bars during the hold.
    const bars = between(m.rToken1h, Math.floor(trade.entryT / HOUR) * HOUR, trade.exitT);
    const grossRet = trade.exitPrice / trade.entryPrice - 1;
    let hi = Math.max(trade.entryPrice, trade.exitPrice);
    let lo = Math.min(trade.entryPrice, trade.exitPrice);
    for (const b of bars) {
      hi = Math.max(hi, b.h);
      lo = Math.min(lo, b.l);
    }
    const mfe = hi / trade.entryPrice - 1;
    const mae = lo / trade.entryPrice - 1;

    const reaction = m.earnings.find((e) => e.reactionAt > trade.entryT && e.reactionAt <= trade.exitT) ?? null;

    const p24 = priceAt(m.rToken1h, trade.exitT + 24 * HOUR, HOUR, STALE);
    const exitClosed = isUnderlyingClosed(exit.session);
    const pOpen = exitClosed ? priceAt(m.rToken1h, nextRegularOpen(trade.exitT), HOUR, STALE) : null;

    // Most recent trade (any ticker) that closed at or before this entry.
    let lo2 = 0;
    let hi2 = byExit.length - 1;
    let prevIdx = -1;
    while (lo2 <= hi2) {
      const mid = (lo2 + hi2) >> 1;
      if (byExit[mid].exitT <= trade.entryT) {
        prevIdx = mid;
        lo2 = mid + 1;
      } else hi2 = mid - 1;
    }
    const prevTrade = prevIdx >= 0 ? byExit[prevIdx] : null;

    return {
      trade,
      holdHours: (trade.exitT - trade.entryT) / HOUR,
      entrySession: entry.session,
      exitSession: exit.session,
      entryClosed: isUnderlyingClosed(entry.session),
      exitClosed,
      entryMove: entry.moveSinceClose,
      exitMove: exit.moveSinceClose,
      entryPremium: entry.premium,
      mfe,
      mae,
      capture: mfe > 0.001 ? grossRet / mfe : null,
      earnings: reaction,
      after24h: p24 ? p24 / trade.exitPrice - 1 : null,
      afterToOpen: pOpen ? pOpen / trade.exitPrice - 1 : null,
      relSize: medianCost > 0 ? trade.cost / medianCost : 1,
      prev: prevTrade
        ? { id: prevTrade.id, pnl: prevTrade.pnl, hoursSinceExit: (trade.entryT - prevTrade.exitT) / HOUR }
        : null,
    };
  });
}
