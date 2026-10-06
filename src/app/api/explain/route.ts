import { z } from "zod";
import { explainHabit, type Explanation } from "@/lib/ai/coach";
import { badRequest, parseDataset } from "@/lib/api/dataset";
import { analyze } from "@/lib/review/analyze";
import { HABITS } from "@/lib/sim/generate";

export const maxDuration = 60;

const Body = z.object({ dataset: z.unknown(), habit: z.enum(HABITS) });

/** Coaching text for the sample trader is cached per server instance; uploads are explained per request. */
const sampleCache = new Map<string, Explanation>();

export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return badRequest("Expected { dataset, habit }.");
  const dataset = parseDataset(parsed.data.dataset);
  const a = analyze(dataset);
  const finding = a.review.findings.find((f) => f.id === parsed.data.habit);
  if (!finding) return badRequest("Unknown habit.", 404);

  const key = parsed.data.habit;
  if (dataset.kind === "sample" && sampleCache.has(key)) return Response.json(sampleCache.get(key));
  const explanation = await explainHabit(finding, a.rules.find((r) => r.id === finding.id));
  if (dataset.kind === "sample" && explanation.source === "ai") sampleCache.set(key, explanation);
  return Response.json(explanation);
}
