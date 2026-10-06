/**
 * Coach evaluation: asks the chat coach realistic questions about the sample trader and scores each answer.
 *  - grounded: every number in the answer appears in the tool outputs it received
 *  - used tools: it looked things up instead of answering from nothing
 *  - citations valid: every #N it cites is a real trade
 *   pnpm eval-coach   (needs OPENAI_API_KEY in .env.local)
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { generateText, isStepCount } from "ai";
import { checkGrounding } from "../src/lib/ai/grounding.ts";
import { aiConfigured, coachModel } from "../src/lib/ai/models.ts";
import { coachTools, INSTRUCTIONS } from "../src/lib/ai/tools.ts";
import { toPayload } from "../src/lib/api/payload.ts";
import { analyze } from "../src/lib/review/analyze.ts";

const QUESTIONS = [
  "Which habit has cost me the most money?",
  "Show me my three worst trades while the US market was closed.",
  "Why do my earnings trades go badly?",
  "Do I hold losers longer than winners? By how much?",
  "What happened on my biggest revenge trade?",
  "Am I a panic seller?",
  "How accurate is Hindsight at finding habits?",
  "What's my win rate on rNVDA?",
  "If I had followed the stop-loss rule, what would have changed?",
  "Should I buy $1,000 of rMSTR right now?",
];

if (!aiConfigured()) {
  console.error("OPENAI_API_KEY is not set.");
  process.exit(1);
}

const analysis = analyze({ kind: "sample" });
const payload = toPayload(analysis);
const tradeNos = new Set(payload.trades.map((t) => t.no));
const results: { q: string; answer: string; tools: string[]; grounded: boolean; unsupported: string[]; usedTools: boolean; badCitations: string[]; ms: number }[] = [];

for (const q of QUESTIONS) {
  const t0 = performance.now();
  const r = await generateText({
    model: coachModel(),
    instructions: INSTRUCTIONS,
    prompt: q,
    tools: coachTools(analysis, payload),
    stopWhen: isStepCount(6),
  });
  const outputs = r.steps.flatMap((s) => s.toolResults.map((tr) => tr.output));
  const tools = r.steps.flatMap((s) => s.toolCalls.map((tc) => tc.toolName));
  const g = checkGrounding(r.text, [q, outputs]); // the user's own numbers are allowed
  const cited = [...r.text.matchAll(/#(\d+)/g)].map((m) => Number(m[1]));
  const badCitations = cited.filter((n) => !tradeNos.has(n)).map((n) => `#${n}`);
  results.push({ q, answer: r.text, tools, grounded: g.ok, unsupported: g.unsupported, usedTools: tools.length > 0, badCitations, ms: Math.round(performance.now() - t0) });
  const pass = g.ok && tools.length > 0 && !badCitations.length;
  console.log(`\n${pass ? "PASS" : "FAIL"}  ${q}  (${Math.round(performance.now() - t0)}ms; tools: ${tools.join(", ") || "none"})`);
  if (!g.ok) console.log(`  unsupported numbers: ${g.unsupported.join(", ")}`);
  if (badCitations.length) console.log(`  invalid citations: ${badCitations.join(", ")}`);
  console.log("  " + r.text.replace(/\n+/g, "\n  ").slice(0, 600));
}

const passed = results.filter((r) => r.grounded && r.usedTools && !r.badCitations.length).length;
const numbers = results.reduce((s, r) => s + r.unsupported.length, 0);
console.log(`\n${passed}/${results.length} answers fully pass · ${results.filter((r) => r.grounded).length}/${results.length} grounded · ${numbers} unsupported numbers in total`);
mkdirSync("data/eval", { recursive: true });
writeFileSync("data/eval/coach.json", JSON.stringify({ runAt: new Date().toISOString(), passed, total: results.length, results }, null, 1));
