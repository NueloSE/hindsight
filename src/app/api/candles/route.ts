import { marketData } from "@/lib/market/data";
import { between } from "@/lib/market/series";
import { isSupported } from "@/lib/market/universe";

const MAX_SPAN = 45 * 24 * 3_600_000;

/** Hourly rToken and underlying candles from the snapshots, for charts. */
export async function GET(req: Request) {
  const u = new URL(req.url);
  const ticker = (u.searchParams.get("ticker") ?? "").toUpperCase();
  const from = Number(u.searchParams.get("from"));
  const to = Number(u.searchParams.get("to"));
  if (!isSupported(ticker) || !(from > 0) || !(to > from) || to - from > MAX_SPAN) {
    return Response.json({ error: "Expected ticker, from, to (ms), span up to 45 days." }, { status: 400 });
  }
  const m = marketData(ticker);
  const compact = (cs: ReturnType<typeof between>) => cs.map((c) => [c.t, c.o, c.h, c.l, c.c]);
  return Response.json(
    {
      ticker,
      rToken: compact(between(m.rToken1h, from, to)),
      stock: compact(between(m.stock1h, from, to)),
      earnings: m.earnings.filter((e) => e.reactionAt >= from && e.reactionAt <= to),
    },
    { headers: { "Cache-Control": "public, max-age=3600" } },
  );
}
