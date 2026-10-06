/** One OHLCV bar. `t` is the bar open time in epoch milliseconds (UTC). */
export interface Candle {
  t: number;
  o: number;
  h: number;
  l: number;
  c: number;
  /** Traded value in USD (quote volume). */
  v: number;
}

export type Interval = "1h" | "1d";

/** Where a series came from. */
export type Source = "bitget-spot" | "bitget-perp" | "yahoo";

export interface Series {
  source: Source;
  /** Venue symbol, e.g. RNVDAUSDT (Bitget) or NVDA (Yahoo). */
  symbol: string;
  interval: Interval;
  candles: Candle[];
  fetchedAt: number;
}

export interface FundingRate {
  t: number;
  rate: number;
}
