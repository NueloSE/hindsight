import { generateText, Output } from "ai";
import { z } from "zod";
import { UNIVERSE } from "../market/universe";
import type { CheckResult } from "../review/check";
import type { HabitFinding } from "../review/patterns";
import type { Rule } from "../review/rules";
import { checkGrounding } from "./grounding";
import { aiConfigured, coachModel, fastModel } from "./models";

/**
 * The AI's jobs: turn a sentence into a trade idea, and explain computed results in a coach's voice.
 * It never computes. Every explanation is grounding-checked; if it cites a number the code didn't
 * produce, it gets one retry with the offending numbers named, then falls back to the deterministic text.
 */

export const COACH_VOICE = `You are Hindsight, a calm, direct trading coach for retail traders of Bitget rTokens
(tokenized US stocks that trade 24/7). You explain what the trader's own history shows. Rules:
- Use ONLY numbers that appear in the FACTS JSON. Never compute, estimate or round to a new precision.
  Percentages in FACTS are fractions (0.034 = 3.4%).
- Say "you" to the trader. Plain English, no jargon, no hype, no emojis.
- Be honest: if a habit or rule did not cost or save money, say so.
- Never tell the trader what to buy or sell. They decide. This is not financial advice.`;

export interface Explanation {
  text: string;
  source: "ai" | "computed";
  /** Numbers the model wrote that no fact supports (only when the AI attempt was rejected). */
  rejected?: string[];
}

async function grounded(prompt: string, facts: unknown, fallback: string, maxChars = 700): Promise<Explanation> {
  if (!aiConfigured()) return { text: fallback, source: "computed" };
  let feedback = "";
  let lastRejected: string[] = [];
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const { text } = await generateText({
        model: coachModel(),
        instructions: COACH_VOICE,
        prompt: `${prompt}\n\nFACTS:\n${JSON.stringify(facts)}${feedback}`,
        maxOutputTokens: 400,
      });
      const clean = text.trim().slice(0, maxChars);
      const check = checkGrounding(clean, facts);
      if (check.ok) return { text: clean, source: "ai" };
      lastRejected = check.unsupported;
      feedback = `\n\nYour previous answer used numbers not in FACTS: ${check.unsupported.join(", ")}. Rewrite using only numbers from FACTS, or no numbers.`;
    } catch {
      break;
    }
  }
  return { text: fallback, source: "computed", rejected: lastRejected };
}

export function explainHabit(finding: HabitFinding, rule: Rule | undefined): Promise<Explanation> {
  const facts = {
    habit: finding.title,
    status: finding.status,
    confidence: finding.confidence,
    metrics: finding.metrics,
    cost: finding.cost,
    rule: rule ? { title: rule.title, text: rule.text, whatIf: rule.whatIf } : null,
    computedSummary: finding.summary,
  };
  return grounded(
    `Explain this finding about the trader's habit in 2–3 short sentences: what they do, what it has (or hasn't) cost them,
and, if there is a rule, the honest trade-off of following it (money and risk).`,
    facts,
    finding.summary,
  );
}

export function explainCheck(result: CheckResult): Promise<Explanation> {
  const c = result.context;
  const facts = {
    idea: result.idea,
    verdict: result.verdict,
    marketClosed: c.marketClosed,
    session: c.session,
    moveSinceClose: c.moveSinceClose,
    price: c.price,
    hoursToEarnings: c.hoursToEarnings,
    sizeVsNormal: result.sizeVsNormal,
    normalSize: result.normalSize,
    hits: result.hits.map((h) => ({ rule: h.rule.title, kind: h.kind, reason: h.reason, history: h.history })),
    similarTrades: result.similarStats,
  };
  const fallback =
    result.verdict === "clear"
      ? "This idea doesn't match any of your costly habits. Your reminder still applies: decide your exit before you enter."
      : result.verdict === "caution"
        ? "No rule is broken, but this trade is much bigger than your usual size. Size is the one thing you fully control."
        : "This idea runs into a rule built from your own history. Below is what happened the last times you did this. The decision is yours.";
  return grounded(
    `The trader is about to place this trade. In 2–4 short sentences, tell them which of their own rules it matches (if any)
and what their history in similar situations shows. End by reminding them the decision is theirs.`,
    facts,
    fallback,
  );
}

const IdeaSchema = z.object({
  ticker: z.enum(UNIVERSE.map((i) => i.ticker) as [string, ...string[]]).nullable(),
  side: z.enum(["buy", "sell"]).nullable(),
  usd: z.number().positive().nullable(),
});
export type ParsedIdea = z.infer<typeof IdeaSchema>;

/** Plain-language trade idea → fields. Falls back to simple pattern matching without a model. */
export async function parseIdea(text: string): Promise<ParsedIdea> {
  if (aiConfigured()) {
    try {
      const { output } = await generateText({
        model: fastModel(),
        output: Output.object({ schema: IdeaSchema }),
        instructions: `Extract a trade idea. Tickers: ${UNIVERSE.map((i) => `${i.ticker} (${i.name}, rToken r${i.ticker})`).join(", ")}.
Map company names and rToken names to the ticker. usd is the dollar/USDT amount if stated, else null. Use null when unsure.`,
        prompt: text,
      });
      return output;
    } catch {
      // fall through to the rule-based parser
    }
  }
  return parseIdeaLocally(text);
}

export function parseIdeaLocally(text: string): ParsedIdea {
  const t = text.toUpperCase();
  const inst = UNIVERSE.find((i) => new RegExp(`\\bR?${i.ticker}\\b`).test(t) || t.includes(i.name.toUpperCase().split(" ")[0]));
  const side = /\b(SELL|DUMP|EXIT|CLOSE|SHORT)\w*/.test(t) ? "sell" : /\b(BUY|BOUGHT|GRAB|ADD|LONG|ENTER|GET|PICK UP)\w*/.test(t) ? "buy" : null;
  const amount = t.match(/\$?\s?(\d[\d,]*(?:\.\d+)?)\s?(K)?\s?(USDT|USD|DOLLARS|BUCKS)?/);
  let usd: number | null = null;
  if (amount && (amount[3] || t.includes("$") || amount[2])) usd = Number(amount[1].replace(/,/g, "")) * (amount[2] ? 1000 : 1);
  return { ticker: inst?.ticker ?? null, side, usd };
}
