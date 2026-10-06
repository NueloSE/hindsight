import type { EarningsEvent } from "./earnings";
import { GapCalculator } from "./gap";
import { readJson, readSeries } from "./store";
import type { Candle } from "./types";
import { instrument, UNIVERSE, type Instrument } from "./universe";

/** Everything Hindsight knows about one instrument, loaded from snapshots. */
export interface MarketData {
  instrument: Instrument;
  rToken1h: Candle[];
  rToken1d: Candle[];
  stock1h: Candle[];
  stock1d: Candle[];
  gap: GapCalculator;
  earnings: EarningsEvent[];
}

const loaded = new Map<string, MarketData>();
let earningsCache: EarningsEvent[] | null = null;

export function allEarnings(): EarningsEvent[] {
  earningsCache ??= readJson<{ events: EarningsEvent[] }>("earnings.json")?.events ?? [];
  return earningsCache;
}

export function marketData(ticker: string): MarketData {
  const inst = instrument(ticker);
  const hit = loaded.get(inst.ticker);
  if (hit) return hit;

  const need = (series: ReturnType<typeof readSeries>, what: string): Candle[] => {
    if (!series) throw new Error(`Missing snapshot: ${what}. Run \`pnpm snapshot ${inst.ticker}\`.`);
    return series.candles;
  };
  const rToken1h = need(readSeries("bitget-spot", inst.rToken, "1h"), `${inst.rToken} 1h`);
  const rToken1d = need(readSeries("bitget-spot", inst.rToken, "1d"), `${inst.rToken} 1d`);
  const stock1h = need(readSeries("yahoo", inst.yahoo, "1h"), `${inst.yahoo} 1h`);
  const stock1d = need(readSeries("yahoo", inst.yahoo, "1d"), `${inst.yahoo} 1d`);

  const data: MarketData = {
    instrument: inst,
    rToken1h,
    rToken1d,
    stock1h,
    stock1d,
    gap: new GapCalculator(rToken1h, stock1h, stock1d),
    earnings: allEarnings().filter((e) => e.ticker === inst.ticker),
  };
  loaded.set(inst.ticker, data);
  return data;
}

export function allMarketData(): MarketData[] {
  return UNIVERSE.map((i) => marketData(i.ticker));
}

/** Time range covered by hourly rToken data across the whole universe. */
export function hourlyCoverage(): { from: number; to: number } {
  const all = allMarketData();
  return {
    from: Math.max(...all.map((m) => m.rToken1h[0].t)),
    to: Math.min(...all.map((m) => m.rToken1h.at(-1)!.t)),
  };
}
