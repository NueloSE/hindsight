import { fetchJson } from "./http";
import type { Candle, Interval, Series } from "./types";

interface ChartResponse {
  chart: {
    result: {
      timestamp?: number[];
      indicators: {
        quote: { open: (number | null)[]; high: (number | null)[]; low: (number | null)[]; close: (number | null)[]; volume: (number | null)[] }[];
      };
    }[] | null;
    error: { code: string; description: string } | null;
  };
}

/**
 * Underlying US stock candles from Yahoo Finance. Hourly bars include pre/post market.
 * Yahoo serves hourly data for the last ~730 days only.
 */
export async function stockCandles(symbol: string, interval: Interval, startMs: number, endMs = Date.now()): Promise<Series> {
  const qs = new URLSearchParams({
    period1: String(Math.floor(startMs / 1000)),
    period2: String(Math.floor(endMs / 1000)),
    interval: interval === "1h" ? "1h" : "1d",
    includePrePost: interval === "1h" ? "true" : "false",
    events: "div,splits",
  });
  const res = await fetchJson<ChartResponse>(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?${qs}`, {
    headers: { "User-Agent": "Mozilla/5.0 (Hindsight research)" },
  });
  if (res.chart.error || !res.chart.result?.length) {
    throw new Error(`Yahoo ${symbol}: ${res.chart.error?.description ?? "no result"}`);
  }

  const r = res.chart.result[0];
  const q = r.indicators.quote[0];
  const candles: Candle[] = [];
  (r.timestamp ?? []).forEach((ts, i) => {
    const [o, h, l, c] = [q.open[i], q.high[i], q.low[i], q.close[i]];
    if (o == null || h == null || l == null || c == null) return; // Yahoo pads gaps with nulls
    candles.push({ t: ts * 1000, o, h, l, c, v: (q.volume[i] ?? 0) * c });
  });
  return { source: "yahoo", symbol, interval, candles, fetchedAt: Date.now() };
}
