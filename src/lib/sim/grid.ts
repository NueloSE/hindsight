import { allMarketData } from "../market/data";
import { HOUR, lastRegularClose, nyParts, sessionAt, type Session } from "../market/sessions";

export interface TickerGrid {
  ticker: string;
  /** rToken price at each hour (bar open), NaN when no trade happened that hour. */
  price: Float64Array;
  /** rToken move since the underlying's last regular close, NaN when unknown. */
  moveSinceClose: Float64Array;
  /** Next-regular-open timestamps that react to an earnings report. */
  earningsReactions: number[];
}

/** Hour-by-hour view of the market shared by every simulated trader. */
export interface MarketGrid {
  hours: number[];
  sessions: Session[];
  tickers: TickerGrid[];
  byTicker: Map<string, TickerGrid>;
}

let cached: MarketGrid | null = null;

export function marketGrid(from?: number, to?: number): MarketGrid {
  if (cached && from === undefined && to === undefined) return cached;
  const data = allMarketData();
  const start = from ?? Math.max(...data.map((m) => m.rToken1h[0].t));
  const end = to ?? Math.min(...data.map((m) => m.rToken1h.at(-1)!.t));
  const first = Math.ceil(start / HOUR) * HOUR;

  const hours: number[] = [];
  for (let t = first; t <= end; t += HOUR) hours.push(t);
  const sessions = hours.map(sessionAt);
  // The last regular close depends only on the hour, so work it out once for every ticker.
  const closeDates = hours.map((t) => nyParts(lastRegularClose(t)).date);

  const tickers: TickerGrid[] = data.map((m) => {
    const price = new Float64Array(hours.length).fill(NaN);
    const moveSinceClose = new Float64Array(hours.length).fill(NaN);
    const bars = new Map(m.rToken1h.map((c) => [c.t, c.o]));
    hours.forEach((t, i) => {
      const p = bars.get(t);
      if (p === undefined) return;
      price[i] = p;
      const close = m.gap.closeOn(closeDates[i]);
      if (close) moveSinceClose[i] = p / close - 1;
    });
    return {
      ticker: m.instrument.ticker,
      price,
      moveSinceClose,
      earningsReactions: m.earnings.map((e) => e.reactionAt).sort((a, b) => a - b),
    };
  });

  const grid: MarketGrid = { hours, sessions, tickers, byTicker: new Map(tickers.map((g) => [g.ticker, g])) };
  if (from === undefined && to === undefined) cached = grid;
  return grid;
}

/** Index of the first hour >= t, or hours.length. */
export function hourIndex(grid: MarketGrid, t: number): number {
  const i = Math.ceil((t - grid.hours[0]) / HOUR);
  return Math.max(0, Math.min(grid.hours.length, i));
}
