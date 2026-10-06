/**
 * Pre-generates grounded coaching for the sample trader's habits and the Check-a-trade demo scenarios.
 *   pnpm coach-cache   (needs OPENAI_API_KEY in .env.local)
 * Only AI text that passed the grounding check is stored; re-run after changing detectors or data.
 */
import { checkFacts, explainCheck, explainHabit, habitFacts } from "../src/lib/ai/coach.ts";
import { checkKey, habitKey, writeCache } from "../src/lib/ai/cache.ts";
import { aiConfigured } from "../src/lib/ai/models.ts";
import { analyze } from "../src/lib/review/analyze.ts";
import { checkIdea, snapshotContext } from "../src/lib/review/check.ts";

// Must match SCENARIOS in src/app/check/check-view.tsx.
const SCENARIOS = [
  { ticker: "MSTR", side: "buy" as const, usd: 1500, at: Date.parse("2026-10-04T04:00:00Z") },
  { ticker: "NVDA", side: "buy" as const, usd: 1200, at: Date.parse("2026-08-25T15:00:00Z") },
  { ticker: "TSLA", side: "buy" as const, usd: 1000, at: Date.parse("2026-09-09T17:00:00Z") },
];

if (!aiConfigured()) {
  console.error("OPENAI_API_KEY is not set.");
  process.exit(1);
}

const a = analyze({ kind: "sample" });
const entries: Parameters<typeof writeCache>[0] = {};

for (const f of a.review.findings.filter((x) => x.status === "detected")) {
  const rule = a.rules.find((r) => r.id === f.id);
  const explanation = await explainHabit(f, rule);
  console.log(`habit ${f.id}: ${explanation.source}${explanation.rejected?.length ? ` (rejected ${explanation.rejected.join(", ")})` : ""}`);
  if (explanation.source === "ai") entries[habitKey(f.id)] = { facts: habitFacts(f, rule), explanation };
}

for (const s of SCENARIOS) {
  const result = checkIdea(s, snapshotContext(s.ticker, s.at), a.rules, a.facts);
  const explanation = await explainCheck(result);
  console.log(`check ${s.ticker} ${new Date(s.at).toISOString()}: ${explanation.source}`);
  if (explanation.source === "ai") entries[checkKey(s.ticker, s.side, s.usd, s.at)] = { facts: checkFacts(result), explanation };
}

writeCache(entries);
console.log(`stored ${Object.keys(entries).length} grounded explanations in data/coaching/sample.json`);
