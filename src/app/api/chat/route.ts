import { convertToModelMessages, createUIMessageStreamResponse, isStepCount, streamText, toUIMessageStream, type UIMessage } from "ai";
import { aiConfigured, coachModel } from "@/lib/ai/models";
import { coachTools, INSTRUCTIONS } from "@/lib/ai/tools";
import { badRequest, parseDataset } from "@/lib/api/dataset";
import { toPayload } from "@/lib/api/payload";
import { analyze } from "@/lib/review/analyze";

export const maxDuration = 60;

export async function POST(req: Request) {
  if (!aiConfigured()) return badRequest("The AI coach isn't configured on this deployment yet.", 503);
  const body = await req.json().catch(() => null);
  if (!body?.messages) return badRequest("Expected { messages, dataset }.");
  const messages = body.messages as UIMessage[];
  const analysis = analyze(parseDataset(body.dataset));

  const result = streamText({
    model: coachModel(),
    instructions: INSTRUCTIONS,
    messages: await convertToModelMessages(messages),
    stopWhen: isStepCount(6),
    tools: coachTools(analysis, toPayload(analysis)),
  });

  return createUIMessageStreamResponse({
    stream: toUIMessageStream({ stream: result.stream, originalMessages: messages }),
  });
}
