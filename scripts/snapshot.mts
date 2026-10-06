/**
 * Downloads market data into data/snapshots/ so Hindsight runs offline.
 *   pnpm snapshot            # everything
 *   pnpm snapshot NVDA TSLA  # selected tickers (earnings always refreshed)
 */
import { spotCandles } from "../src/lib/market/bitget.ts";
import { earningsOn, toEvent, type EarningsEvent } from "../src/lib/market/earnings.ts";
import { isTradingDay } from "../src/lib/market/sessions.ts";
import { writeJson, writeSeries } from "../src/lib/market/store.ts";
import { UNIVERSE } from "../src/lib/market/universe.ts";
import { stockCandles } from "../src/lib/market/yahoo.ts";

const HOURLY_FROM = Date.UTC(2026, 2, 1); // 2026-03-01
const DAILY_FROM = Date.UTC(2025, 5, 1); // 2025-06-01
const EARNINGS_TO = Date.UTC(2026, 11, 31); // includes upcoming reports for pre-trade checks

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const wanted = process.argv.slice(2).map((s) => s.toUpperCase());
const instruments = wanted.length ? UNIVERSE.filter((i) => wanted.includes(i.ticker)) : UNIVERSE;

async function step<T>(label: string, fn: () => Promise<T>): Promise<T | null> {
  try {
    const out = await fn();
    return out;
  } catch (err) {
    console.error(`  ✗ ${label}: ${err instanceof Error ? err.message : err}`);
    return null;
  }
}

for (const inst of instruments) {
  console.log(`${inst.ticker}`);
  for (const [label, fetcher] of [
    ["rToken 1h", () => spotCandles(inst.rToken, "1h", HOURLY_FROM)],
    ["rToken 1d", () => spotCandles(inst.rToken, "1d", DAILY_FROM)],
    ["stock 1h", () => stockCandles(inst.yahoo, "1h", HOURLY_FROM)],
    ["stock 1d", () => stockCandles(inst.yahoo, "1d", DAILY_FROM)],
  ] as const) {
    const series = await step(label, fetcher);
    if (!series) continue;
    writeSeries(series);
    const first = series.candles[0] ? new Date(series.candles[0].t).toISOString().slice(0, 10) : "-";
    console.log(`  ✓ ${label}: ${series.candles.length} bars from ${first}`);
    await sleep(150);
  }
}

console.log("earnings");
const tickers = new Set(UNIVERSE.filter((i) => i.kind === "stock").map((i) => i.ticker));
const events: EarningsEvent[] = [];
for (let t = HOURLY_FROM; t <= EARNINGS_TO; t += 86_400_000) {
  const date = new Date(t).toISOString().slice(0, 10);
  if (!isTradingDay(date)) continue;
  const symbols = await step(`earnings ${date}`, () => earningsOn(date));
  for (const s of symbols ?? []) if (tickers.has(s)) events.push(toEvent(s, date));
  await sleep(120);
}
writeJson("earnings.json", { fetchedAt: Date.now(), events });
console.log(`  ✓ ${events.length} earnings events`);
