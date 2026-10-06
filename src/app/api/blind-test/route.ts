import { readFileSync } from "node:fs";
import { join } from "node:path";

export const dynamic = "force-static";

export async function GET() {
  const raw = JSON.parse(readFileSync(join(process.cwd(), "data", "blind-test", "results.json"), "utf8"));
  // The per-trader rows are large and only useful offline.
  delete raw.rows;
  return Response.json(raw);
}
