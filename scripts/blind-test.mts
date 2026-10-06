/**
 * Blind accuracy test. Generates simulated traders on real market data with random hidden habits,
 * runs Hindsight's detectors without access to the ground truth, and scores the results.
 *
 *   pnpm blind-test          # development set (seeds 1–200), used while tuning
 *   pnpm blind-test --final  # held-out set (seeds 1001–1200), never used for tuning; writes the published results
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { findHabits } from "../src/lib/review/patterns.ts";
import { replayTrades } from "../src/lib/review/replay.ts";
import { HABITS, randomProfile, simulateTrader, type HabitId } from "../src/lib/sim/generate.ts";
import { marketGrid } from "../src/lib/sim/grid.ts";

const FINAL = process.argv.includes("--final");
const FIRST_SEED = FINAL ? 1001 : 1;
const N = 200;
const FROM = Date.UTC(2026, 3, 1);
const TO = Date.UTC(2026, 8, 30, 23);
const BANDS = [
  { label: "weak (0.30–0.50)", lo: 0.3, hi: 0.5 },
  { label: "moderate (0.50–0.75)", lo: 0.5, hi: 0.75 },
  { label: "strong (0.75–1.00)", lo: 0.75, hi: 1.01 },
];

type Cell = { tp: number; fn: number; fp: number; tn: number; insufficient: number };
const blank = (): Cell => ({ tp: 0, fn: 0, fp: 0, tn: 0, insufficient: 0 });
const perHabit = Object.fromEntries(HABITS.map((h) => [h, blank()])) as Record<HabitId, Cell>;
const perBand = BANDS.map(() => ({ detected: 0, planted: 0 }));
let cleanTraders = 0;
let cleanTradersAccused = 0;
let tradesTotal = 0;
const rows: { seed: number; trades: number; planted: Partial<Record<HabitId, number>>; detected: HabitId[] }[] = [];

const grid = marketGrid();
const started = performance.now();

for (let seed = FIRST_SEED; seed < FIRST_SEED + N; seed++) {
  const profile = randomProfile(seed, FROM, TO);
  const sim = simulateTrader(profile, grid);
  const facts = replayTrades(sim.book.trades);
  const review = findHabits(facts, grid); // detectors never see profile.habits or tradeTags
  tradesTotal += facts.length;

  const detected = review.findings.filter((f) => f.status === "detected").map((f) => f.id);
  const planted = profile.habits;
  rows.push({ seed, trades: facts.length, planted, detected });

  for (const f of review.findings) {
    const strength = planted[f.id] ?? 0;
    const cell = perHabit[f.id];
    if (f.status === "insufficient-data") cell.insufficient++;
    if (strength > 0) {
      if (f.status === "detected") cell.tp++;
      else cell.fn++;
      const b = BANDS.findIndex((x) => strength >= x.lo && strength < x.hi);
      perBand[b].planted++;
      if (f.status === "detected") perBand[b].detected++;
    } else if (f.status === "detected") cell.fp++;
    else cell.tn++;
  }
  if (!Object.keys(planted).length) {
    cleanTraders++;
    if (detected.length) cleanTradersAccused++;
  }
}

const tot = Object.values(perHabit).reduce((a, c) => ({ tp: a.tp + c.tp, fn: a.fn + c.fn, fp: a.fp + c.fp, tn: a.tn + c.tn, insufficient: a.insufficient + c.insufficient }), blank());
const rate = (a: number, b: number) => (b ? a / b : 0);
const pct = (x: number) => `${(x * 100).toFixed(1)}%`;

console.log(`\nBlind accuracy test: ${FINAL ? "HELD-OUT set" : "development set"} (seeds ${FIRST_SEED}–${FIRST_SEED + N - 1})`);
console.log(`${N} simulated traders, ${tradesTotal} trades, ${Math.round(performance.now() - started)} ms\n`);
console.log("habit".padEnd(20), "detection rate".padEnd(22), "false alarm rate".padEnd(22), "precision");
for (const h of HABITS) {
  const c = perHabit[h];
  console.log(
    h.padEnd(20),
    `${pct(rate(c.tp, c.tp + c.fn))} (${c.tp}/${c.tp + c.fn})`.padEnd(22),
    `${pct(rate(c.fp, c.fp + c.tn))} (${c.fp}/${c.fp + c.tn})`.padEnd(22),
    pct(rate(c.tp, c.tp + c.fp)),
  );
}
console.log(
  "ALL".padEnd(20),
  `${pct(rate(tot.tp, tot.tp + tot.fn))} (${tot.tp}/${tot.tp + tot.fn})`.padEnd(22),
  `${pct(rate(tot.fp, tot.fp + tot.tn))} (${tot.fp}/${tot.fp + tot.tn})`.padEnd(22),
  pct(rate(tot.tp, tot.tp + tot.fp)),
);
console.log("\nDetection rate by habit strength:");
BANDS.forEach((b, i) => console.log(`  ${b.label.padEnd(22)} ${pct(rate(perBand[i].detected, perBand[i].planted))} (${perBand[i].detected}/${perBand[i].planted})`));
console.log(`\nHabit-free traders wrongly accused of any habit: ${cleanTradersAccused}/${cleanTraders}`);

if (FINAL) {
  const out = join(process.cwd(), "data", "blind-test");
  mkdirSync(out, { recursive: true });
  writeFileSync(
    join(out, "results.json"),
    JSON.stringify(
      {
        runAt: new Date().toISOString(),
        seeds: [FIRST_SEED, FIRST_SEED + N - 1],
        window: [new Date(FROM).toISOString(), new Date(TO).toISOString()],
        traders: N,
        trades: tradesTotal,
        overall: { ...tot, detectionRate: rate(tot.tp, tot.tp + tot.fn), falseAlarmRate: rate(tot.fp, tot.fp + tot.tn), precision: rate(tot.tp, tot.tp + tot.fp) },
        perHabit: Object.fromEntries(
          HABITS.map((h) => {
            const c = perHabit[h];
            return [h, { ...c, detectionRate: rate(c.tp, c.tp + c.fn), falseAlarmRate: rate(c.fp, c.fp + c.tn), precision: rate(c.tp, c.tp + c.fp) }];
          }),
        ),
        byStrength: BANDS.map((b, i) => ({ band: b.label, ...perBand[i], detectionRate: rate(perBand[i].detected, perBand[i].planted) })),
        cleanTraders: { total: cleanTraders, wronglyAccused: cleanTradersAccused },
        rows,
      },
      null,
      1,
    ),
  );
  console.log(`\nWrote data/blind-test/results.json`);
}
