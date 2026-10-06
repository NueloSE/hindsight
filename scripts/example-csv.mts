/**
 * Writes public/example-bitget-export.csv: a simulated trader exported in a Bitget-style format
 * (UTC+8 times, "rNVDA/USDT" pairs, some fees charged in the rToken) to exercise and demo the importer.
 * The seed was picked so its planted habits come through (most seeds do; 777 didn't detect panic selling).
 * Detection is never guaranteed; the published accuracy comes from scripts/blind-test.mts.
 */
import { writeFileSync } from "node:fs";
import { simulateTrader, type TraderProfile } from "../src/lib/sim/generate.ts";

const profile: TraderProfile = {
  name: "Example export",
  seed: 700,
  from: Date.UTC(2026, 3, 1),
  to: Date.UTC(2026, 8, 30, 23),
  tickers: [
    { ticker: "TSLA", weight: 0.35 },
    { ticker: "PLTR", weight: 0.25 },
    { ticker: "COIN", weight: 0.2 },
    { ticker: "SPY", weight: 0.2 },
  ],
  tradesPerWeek: 4.5,
  baseSize: 900,
  sizeSigma: 0.3,
  holdMedianHours: 20,
  holdSigma: 0.9,
  sessionBias: { regular: 1, pre: 0.5, post: 0.7, overnight: 1.1, weekend: 1, holiday: 1 },
  maxOpen: 3,
  feeRate: 0.001,
  habits: { "closed-panic": 0.9, revenge: 0.6 },
};

const sim = simulateTrader(profile);
const pad = (n: number) => String(n).padStart(2, "0");
const utc8 = (ms: number) => {
  const d = new Date(ms + 8 * 3_600_000);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`;
};
const rows = ["Date(UTC+8),Trading pair,Direction,Price,Amount,Total,Fee,Fee coin,Order ID"];
sim.fills.forEach((f, i) => {
  const total = f.qty * f.price;
  // Buys pay the fee in the rToken, sells in USDT, as spot exchanges commonly do.
  const fee = f.side === "buy" ? `${(f.fee / f.price).toFixed(8)},r${f.ticker}` : `${f.fee.toFixed(6)},USDT`;
  rows.push(`${utc8(f.t)},r${f.ticker}/USDT,${f.side === "buy" ? "Buy" : "Sell"},${f.price.toFixed(4)},${f.qty.toFixed(6)},"${total.toFixed(2)}",${fee},${100000 + i}`);
});
writeFileSync("public/example-bitget-export.csv", rows.join("\n") + "\n");
console.log(`wrote ${sim.fills.length} fills, ${sim.book.trades.length} trades; planted: ${Object.keys(profile.habits).join(", ")}`);
