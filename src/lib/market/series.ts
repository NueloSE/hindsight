import type { Candle } from "./types";

/** Index of the last candle with open time <= ms, or -1. Candles must be ascending. */
export function indexAtOrBefore(candles: Candle[], ms: number): number {
  let lo = 0;
  let hi = candles.length - 1;
  let ans = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (candles[mid].t <= ms) {
      ans = mid;
      lo = mid + 1;
    } else hi = mid - 1;
  }
  return ans;
}

/**
 * Best known price at `ms` without looking ahead: the open of the bar containing `ms`
 * if one exists, otherwise the close of the last completed bar. `null` before the series starts
 * or when the last bar is older than `maxStaleMs`.
 */
export function priceAt(candles: Candle[], ms: number, barMs: number, maxStaleMs = Infinity): number | null {
  const i = indexAtOrBefore(candles, ms);
  if (i < 0) return null;
  const bar = candles[i];
  if (ms < bar.t + barMs) return bar.o;
  if (ms - (bar.t + barMs) > maxStaleMs) return null;
  return bar.c;
}

/** Candles whose open time falls in [fromMs, toMs). */
export function between(candles: Candle[], fromMs: number, toMs: number): Candle[] {
  const start = indexAtOrBefore(candles, fromMs - 1) + 1;
  const out: Candle[] = [];
  for (let i = start; i < candles.length && candles[i].t < toMs; i++) out.push(candles[i]);
  return out;
}

/** Percent change helper, as a fraction (0.05 = +5%). */
export const pct = (from: number, to: number) => to / from - 1;
