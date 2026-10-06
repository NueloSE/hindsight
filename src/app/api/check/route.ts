import { z } from "zod";
import { explainCheck, parseIdea } from "@/lib/ai/coach";
import { badRequest, parseDataset } from "@/lib/api/dataset";
import { isSupported, UNIVERSE } from "@/lib/market/universe";
import { analyze } from "@/lib/review/analyze";
import { checkIdea } from "@/lib/review/check";
import { contextAt } from "@/lib/review/live";

export const maxDuration = 60;

const Body = z.object({
  dataset: z.unknown(),
  text: z.string().max(500).optional(),
  ticker: z.string().max(10).optional(),
  side: z.enum(["buy", "sell"]).optional(),
  usd: z.number().positive().max(10_000_000).nullable().optional(),
  /** Epoch ms; defaults to now. Demo scenarios replay a past moment. */
  at: z.number().int().positive().optional(),
});

export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return badRequest("Expected { dataset, text } or { dataset, ticker, side }.");
  const b = parsed.data;

  const fromText = b.text ? await parseIdea(b.text) : null;
  const ticker = (b.ticker ?? fromText?.ticker ?? "").toUpperCase();
  const side = b.side ?? fromText?.side ?? "buy";
  const usd = b.usd ?? fromText?.usd ?? null;
  if (!ticker || !isSupported(ticker)) {
    return badRequest(`Which stock? Hindsight supports: ${UNIVERSE.map((i) => i.ticker).join(", ")}.`, 422);
  }

  const at = b.at ?? Date.now();
  const a = analyze(parseDataset(b.dataset));
  const context = await contextAt(ticker, at);
  const result = checkIdea({ ticker, side, usd, at }, context, a.rules, a.facts);
  const explanation = await explainCheck(result);
  const noById = new Map(a.facts.map((f, i) => [f.trade.id, i + 1]));

  return Response.json({
    parsed: fromText,
    result: {
      ...result,
      hits: result.hits.map((h) => ({ ...h, evidenceNos: h.evidence.map((id) => noById.get(id)).filter(Boolean) })),
      similar: result.similar.map((s) => ({ ...s, no: noById.get(s.id) })),
    },
    note: "note" in context ? context.note : undefined,
    explanation,
  });
}
