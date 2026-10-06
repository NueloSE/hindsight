import { z } from "zod";
import type { Dataset } from "../review/analyze";

const FillSchema = z.object({
  id: z.string().max(200),
  t: z.number().int().positive(),
  ticker: z.string().max(10),
  side: z.enum(["buy", "sell"]),
  qty: z.number().positive(),
  price: z.number().positive(),
  fee: z.number().min(0),
});

export const DatasetSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("sample") }),
  z.object({ kind: z.literal("fills"), fills: z.array(FillSchema).max(20_000) }),
]);

export function parseDataset(value: unknown): Dataset {
  return DatasetSchema.parse(value ?? { kind: "sample" });
}

export function badRequest(message: string, status = 400): Response {
  return Response.json({ error: message }, { status });
}
