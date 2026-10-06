import { badRequest, parseDataset } from "@/lib/api/dataset";
import { toPayload } from "@/lib/api/payload";
import { analyze } from "@/lib/review/analyze";

export async function POST(req: Request) {
  let body: { dataset?: unknown };
  try {
    body = await req.json();
  } catch {
    return badRequest("Body must be JSON.");
  }
  try {
    return Response.json(toPayload(analyze(parseDataset(body.dataset))));
  } catch (err) {
    return badRequest(err instanceof Error ? err.message : "Could not analyse these trades.");
  }
}
