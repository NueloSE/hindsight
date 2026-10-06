import { fetchJson } from "./http";
import type { Candle, FundingRate, Interval, Series } from "./types";

const BASE = "https://api.bitget.com";
const PAGE = 200;

interface BitgetResponse<T> {
  code: string;
  msg: string;
  data: T;
}

async function get<T>(path: string, params: Record<string, string | number>): Promise<T> {
  const qs = new URLSearchParams(Object.entries(params).map(([k, v]) => [k, String(v)]));
  const res = await fetchJson<BitgetResponse<T>>(`${BASE}${path}?${qs}`);
  if (res.code !== "00000") throw new Error(`Bitget ${path}: ${res.code} ${res.msg}`);
  return res.data;
}

const SPOT_GRANULARITY: Record<Interval, string> = { "1h": "1h", "1d": "1day" };
const PERP_GRANULARITY: Record<Interval, string> = { "1h": "1H", "1d": "1D" };
const INTERVAL_MS: Record<Interval, number> = { "1h": 3_600_000, "1d": 86_400_000 };

/** Spot rows: [ts, open, high, low, close, baseVol, usdtVol, quoteVol]. Perp rows: [ts, o, h, l, c, baseVol, quoteVol]. */
function toCandle(row: string[]): Candle {
  return { t: Number(row[0]), o: +row[1], h: +row[2], l: +row[3], c: +row[4], v: +row[6] };
}

/**
 * Pages backwards from `endMs` until `startMs`, 200 bars per request.
 * Returns ascending, de-duplicated candles in [startMs, endMs).
 */
async function pageCandles(
  path: string,
  base: Record<string, string>,
  interval: Interval,
  startMs: number,
  endMs: number,
): Promise<Candle[]> {
  const byTime = new Map<number, Candle>();
  let cursor = endMs;

  while (cursor > startMs) {
    const rows = await get<string[][]>(path, { ...base, endTime: cursor, limit: PAGE });
    if (!rows.length) break;
    for (const row of rows) {
      const c = toCandle(row);
      if (c.t >= startMs && c.t < endMs) byTime.set(c.t, c);
    }
    const oldest = Number(rows[0][0]);
    if (oldest >= cursor) break; // no progress; avoid looping forever
    cursor = oldest;
    // Fewer than a full page and short of the window start means history ran out.
    if (rows.length < PAGE && oldest - INTERVAL_MS[interval] > startMs) break;
  }
  return [...byTime.values()].sort((a, b) => a.t - b.t);
}

/** rToken (tokenized US stock) spot candles, e.g. symbol RNVDAUSDT. Trades 24/7. */
export async function spotCandles(symbol: string, interval: Interval, startMs: number, endMs = Date.now()): Promise<Series> {
  const candles = await pageCandles(
    "/api/v2/spot/market/history-candles",
    { symbol, granularity: SPOT_GRANULARITY[interval] },
    interval,
    startMs,
    endMs,
  );
  return { source: "bitget-spot", symbol, interval, candles, fetchedAt: Date.now() };
}

/** US stock USDT perpetual candles, e.g. symbol NVDAUSDT. */
export async function perpCandles(symbol: string, interval: Interval, startMs: number, endMs = Date.now()): Promise<Series> {
  const candles = await pageCandles(
    "/api/v2/mix/market/history-candles",
    { symbol, productType: "USDT-FUTURES", granularity: PERP_GRANULARITY[interval] },
    interval,
    startMs,
    endMs,
  );
  return { source: "bitget-perp", symbol, interval, candles, fetchedAt: Date.now() };
}

/** Funding rate history for a stock perpetual, ascending. */
export async function fundingHistory(symbol: string, pages = 5): Promise<FundingRate[]> {
  const out: FundingRate[] = [];
  for (let pageNo = 1; pageNo <= pages; pageNo++) {
    const rows = await get<{ fundingRate: string; fundingTime: string }[]>("/api/v2/mix/market/history-fund-rate", {
      symbol,
      productType: "USDT-FUTURES",
      pageSize: 100,
      pageNo,
    });
    out.push(...rows.map((r) => ({ t: Number(r.fundingTime), rate: Number(r.fundingRate) })));
    if (rows.length < 100) break;
  }
  return out.sort((a, b) => a.t - b.t);
}

/** Latest price for a spot symbol. */
export async function spotTicker(symbol: string): Promise<{ price: number; t: number }> {
  const rows = await get<{ lastPr: string; ts: string }[]>("/api/v2/spot/market/tickers", { symbol });
  if (!rows.length) throw new Error(`No ticker for ${symbol}`);
  return { price: Number(rows[0].lastPr), t: Number(rows[0].ts) };
}
