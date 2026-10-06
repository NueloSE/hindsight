import { day, usd } from "@/lib/format";
import type { TradeRow } from "@/lib/api/payload";

/** Cumulative P&L by exit time, with a zero line. Pure SVG so it themes with the tokens. */
export function EquityCurve({ trades, height = 140 }: { trades: TradeRow[]; height?: number }) {
  const sorted = [...trades].sort((a, b) => a.exitT - b.exitT);
  if (sorted.length < 2) return null;
  const pts: { t: number; v: number }[] = [];
  for (const t of sorted) pts.push({ t: t.exitT, v: (pts.at(-1)?.v ?? 0) + t.pnl });
  const t0 = pts[0].t;
  const t1 = pts.at(-1)!.t;
  const vMin = Math.min(0, ...pts.map((p) => p.v));
  const vMax = Math.max(0, ...pts.map((p) => p.v));
  const W = 600;
  const pad = 4;
  const x = (t: number) => pad + ((t - t0) / Math.max(1, t1 - t0)) * (W - 2 * pad);
  const y = (v: number) => pad + (1 - (v - vMin) / Math.max(1, vMax - vMin)) * (height - 2 * pad);
  const path = pts.map((p, i) => `${i ? "L" : "M"}${x(p.t).toFixed(1)},${y(p.v).toFixed(1)}`).join(" ");
  const last = pts.at(-1)!;

  return (
    <figure>
      <svg viewBox={`0 0 ${W} ${height}`} className="h-auto w-full" role="img" aria-label={`Cumulative profit and loss, ending at ${usd(last.v)}`}>
        <line x1={pad} x2={W - pad} y1={y(0)} y2={y(0)} stroke="var(--rule)" strokeWidth="1" />
        <path d={path} fill="none" stroke="var(--ink)" strokeWidth="1.5" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
        <circle cx={x(last.t)} cy={y(last.v)} r="3" fill={last.v >= 0 ? "var(--gain)" : "var(--loss)"} />
      </svg>
      <figcaption className="mt-1 flex justify-between text-xs text-muted">
        <span>{day(t0)}</span>
        <span>
          Peak <span className="num">{usd(vMax)}</span> · low <span className="num">{usd(vMin)}</span>
        </span>
        <span>{day(t1)}</span>
      </figcaption>
    </figure>
  );
}
