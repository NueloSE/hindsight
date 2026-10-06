"use client";

import { useMemo } from "react";
import { HOUR, isUnderlyingClosed, sessionAt } from "@/lib/market/sessions";
import { day, price } from "@/lib/format";

type Bar = [t: number, o: number, h: number, l: number, c: number];

interface Props {
  rToken: Bar[];
  stock: Bar[];
  entryT: number;
  exitT: number;
  entryPrice: number;
  exitPrice: number;
  earnings: { reactionAt: number; date: string }[];
  ticker: string;
}

/**
 * rToken price around a trade. Shaded bands are hours when the US market was closed (rTokens still trade);
 * the dashed line is the real stock while it traded. Entry and exit are marked.
 */
export function TradeChart({ rToken, stock, entryT, exitT, entryPrice, exitPrice, earnings, ticker }: Props) {
  const W = 900;
  const H = 300;
  const padL = 8;
  const padR = 56;
  const padY = 16;

  const geo = useMemo(() => {
    if (rToken.length < 2) return null;
    const t0 = rToken[0][0];
    const t1 = rToken.at(-1)![0] + HOUR;
    const prices = [...rToken.flatMap((b) => [b[2], b[3]]), ...stock.map((b) => b[4]), entryPrice, exitPrice];
    const lo = Math.min(...prices);
    const hi = Math.max(...prices);
    const span = hi - lo || 1;
    const x = (t: number) => padL + ((t - t0) / (t1 - t0)) * (W - padL - padR);
    const y = (p: number) => padY + (1 - (p - (lo - span * 0.05)) / (span * 1.1)) * (H - 2 * padY);

    // Closed-market bands: merge consecutive closed hours.
    const bands: [number, number][] = [];
    for (let t = Math.floor(t0 / HOUR) * HOUR; t < t1; t += HOUR) {
      if (!isUnderlyingClosed(sessionAt(t))) continue;
      const last = bands.at(-1);
      if (last && last[1] === t) last[1] = t + HOUR;
      else bands.push([t, t + HOUR]);
    }

    const line = (bars: Bar[], gapHours: number) => {
      let d = "";
      bars.forEach((b, i) => {
        const gap = i > 0 && b[0] - bars[i - 1][0] > gapHours * HOUR;
        d += `${i === 0 || gap ? "M" : "L"}${x(b[0] + HOUR / 2).toFixed(1)},${y(b[4]).toFixed(1)}`;
      });
      return d;
    };

    const ticks = [lo, (lo + hi) / 2, hi];
    return { t0, t1, x, y, bands, rPath: line(rToken, 6), sPath: line(stock, 3), ticks };
  }, [rToken, stock, entryPrice, exitPrice]);

  if (!geo) return <p className="text-sm text-muted">Not enough price data to chart this trade.</p>;
  const { x, y } = geo;
  const won = exitPrice >= entryPrice;

  return (
    <figure>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={`r${ticker} price around the trade, entry ${price(entryPrice)}, exit ${price(exitPrice)}`}>
        {geo.bands.map(([a, b]) => (
          <rect key={a} x={x(a)} y={0} width={Math.max(0.5, x(b) - x(a))} height={H} fill="var(--rule)" opacity="0.55" />
        ))}
        <rect x={x(entryT)} y={0} width={Math.max(1, x(exitT) - x(entryT))} height={H} fill="var(--marker)" opacity="0.18" />
        {geo.ticks.map((p) => (
          <g key={p}>
            <line x1={padL} x2={W - padR} y1={y(p)} y2={y(p)} stroke="var(--rule)" strokeDasharray="2 4" />
            <text x={W - padR + 6} y={y(p) + 4} fontSize="11" fill="var(--muted)" className="num">
              {price(p)}
            </text>
          </g>
        ))}
        {earnings.map((e) => (
          <g key={e.reactionAt}>
            <line x1={x(e.reactionAt)} x2={x(e.reactionAt)} y1={0} y2={H} stroke="var(--accent)" strokeDasharray="3 3" />
            <text x={x(e.reactionAt) + 4} y={12} fontSize="11" fill="var(--accent)">
              Earnings
            </text>
          </g>
        ))}
        <path d={geo.sPath} fill="none" stroke="var(--muted)" strokeWidth="1" strokeDasharray="3 2" vectorEffect="non-scaling-stroke" />
        <path d={geo.rPath} fill="none" stroke="var(--ink)" strokeWidth="1.6" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
        <line x1={x(entryT)} x2={x(exitT)} y1={y(entryPrice)} y2={y(exitPrice)} stroke={won ? "var(--gain)" : "var(--loss)"} strokeWidth="1.5" />
        <circle cx={x(entryT)} cy={y(entryPrice)} r="5" fill="var(--sheet)" stroke="var(--ink)" strokeWidth="1.5" />
        <circle cx={x(exitT)} cy={y(exitPrice)} r="5" fill={won ? "var(--gain)" : "var(--loss)"} />
      </svg>
      <figcaption className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted">
        <span>
          <span className="mr-1.5 inline-block h-0.5 w-4 bg-ink align-middle" />r{ticker} (24/7)
        </span>
        <span>
          <span className="mr-1.5 inline-block w-4 border-t border-dashed border-muted align-middle" />
          {ticker} stock
        </span>
        <span>
          <span className="mr-1.5 inline-block h-3 w-4 bg-rule align-middle" />
          US market closed
        </span>
        <span>
          <span className="mr-1.5 inline-block h-3 w-4 bg-marker/40 align-middle" />
          Your holding period
        </span>
        <span className="ml-auto">
          {day(geo.t0)} – {day(geo.t1)}
        </span>
      </figcaption>
    </figure>
  );
}
