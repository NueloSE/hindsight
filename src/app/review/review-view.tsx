"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useDataset, useReview } from "@/components/dataset";
import { EquityCurve } from "@/components/equity-curve";
import { HabitBoard } from "@/components/habit-board";
import { TradeTable } from "@/components/trade-table";
import { day, pct, tone, usd } from "@/lib/format";

export function ReviewView() {
  const { data, error, loading } = useReview();
  const { dataset } = useDataset();
  const habit = useSearchParams().get("habit");

  if (error) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-16">
        <p className="font-serif text-2xl">We couldn&apos;t review these trades.</p>
        <p className="mt-2 text-muted">{error}</p>
        <Link href="/import" className="mt-6 inline-block text-accent underline-offset-2 hover:underline">
          Try another file
        </Link>
      </div>
    );
  }
  if (loading || !data) return <ReviewSkeleton />;

  const s = data.summary;
  const detected = data.findings.filter((f) => f.status === "detected");
  const others = data.findings.filter((f) => f.status !== "detected");
  const beforeFees = s.pnl + s.fees;
  const datasetKey = dataset.kind === "sample" ? "sample" : `fills:${dataset.fileName}`;
  const name = data.dataset === "sample" ? `${data.traderName}'s` : "Your";

  if (!s.trades) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-16">
        <p className="font-serif text-2xl">No completed round trips yet.</p>
        <p className="mt-2 text-muted">
          Hindsight reviews trades from first buy to last sell. {s.openPositions ? `${s.openPositions} position(s) are still open.` : ""}
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 pb-20">
      <header className="grid grid-cols-1 gap-8 py-10 md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] md:items-end">
        <div>
          <p className="text-sm text-muted">
            {data.dataset === "sample" ? "Demo trader" : `Your trades · ${dataset.kind === "fills" ? dataset.fileName : ""}`}
          </p>
          <h1 className="mt-2 font-serif text-4xl font-medium tracking-tight sm:text-5xl">{name} review</h1>
          <p className="mt-3 text-muted">
            <span className="num">{s.trades}</span> round trips in r{s.tickers.join(", r")}, {day(s.from)} – {day(s.to)}.
          </p>
          <dl className="mt-6 grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-4">
            <div>
              <dt className="text-xs text-muted">Net P&amp;L</dt>
              <dd className={`num mt-0.5 text-xl ${tone(s.pnl)}`}>{usd(s.pnl, { sign: true })}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted">Win rate</dt>
              <dd className="num mt-0.5 text-xl">{pct(s.winRate, { digits: 0 })}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted">Avg return</dt>
              <dd className={`num mt-0.5 text-xl ${tone(s.avgReturn)}`}>{pct(s.avgReturn, { sign: true, digits: 2 })}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted">Fees paid</dt>
              <dd className="num mt-0.5 text-xl">{usd(s.fees)}</dd>
            </div>
          </dl>
          {beforeFees > 0 && s.pnl < 0 && (
            <p className="mt-4 max-w-xl text-sm leading-relaxed">
              <span className="mark">
                Before fees, these trades made <span className="num">{usd(beforeFees)}</span>.
              </span>{" "}
              Fees of <span className="num">{usd(s.fees)}</span> turned that into a loss: trading less often is itself worth considering.
            </p>
          )}
        </div>
        <EquityCurve trades={data.trades} />
      </header>

      <section aria-labelledby="habits-heading">
        <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-ink pb-2">
          <h2 id="habits-heading" className="font-serif text-2xl font-medium">
            {detected.length ? `${detected.length} habit${detected.length > 1 ? "s" : ""} found` : "No costly habits found"}
          </h2>
          <p className="text-sm text-muted">
            {others.length ? `${others.length} more checked · ` : ""}
            <Link href="/accuracy" className="text-accent underline-offset-2 hover:underline">
              how reliable is this?
            </Link>
          </p>
        </div>
        <div className="mt-5">
          <HabitBoard findings={data.findings} rules={data.rules} datasetKey={datasetKey} />
        </div>
      </section>

      <section aria-labelledby="trades-heading" className="pt-6">
        <h2 id="trades-heading" className="border-b border-ink pb-2 font-serif text-2xl font-medium">
          Every trade
        </h2>
        <div className="mt-4">
          <TradeTable trades={data.trades} findings={data.findings} initialHabit={habit} />
        </div>
      </section>

      <aside className="mt-12 flex flex-wrap items-center gap-4 rounded-md border border-rule bg-sheet p-5">
        <p className="flex-1">
          <span className="font-medium">About to trade?</span> <span className="text-muted">Check the idea against these rules first.</span>
        </p>
        <Link href="/check" className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-ink transition-opacity duration-150 hover:opacity-90">
          Check a trade
        </Link>
      </aside>
    </div>
  );
}

function ReviewSkeleton() {
  return (
    <div className="mx-auto max-w-6xl animate-pulse px-4 py-10" aria-busy="true" aria-label="Reviewing trades">
      <div className="h-4 w-48 rounded-sm bg-rule" />
      <div className="mt-4 h-12 w-80 rounded-sm bg-rule" />
      <div className="mt-8 grid grid-cols-4 gap-6">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-12 rounded-sm bg-rule/70" />
        ))}
      </div>
      <div className="mt-12 space-y-6">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-40 rounded-md bg-rule/50" />
        ))}
      </div>
    </div>
  );
}
