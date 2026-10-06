import { readFileSync } from "node:fs";
import { join } from "node:path";
import Link from "next/link";
import { pct } from "@/lib/format";
import { HABIT_TITLES } from "@/lib/review/patterns";
import { HABITS } from "@/lib/sim/generate";

export const metadata = { title: "Accuracy · Hindsight" };

interface Cell {
  tp: number;
  fn: number;
  fp: number;
  tn: number;
  detectionRate: number;
  falseAlarmRate: number;
  precision: number;
}
interface Results {
  runAt: string;
  seeds: [number, number];
  window: [string, string];
  traders: number;
  trades: number;
  overall: Cell;
  perHabit: Record<string, Cell>;
  byStrength: { band: string; detected: number; planted: number; detectionRate: number }[];
  cleanTraders: { total: number; wronglyAccused: number };
}

export default function AccuracyPage() {
  const r = JSON.parse(readFileSync(join(process.cwd(), "data", "blind-test", "results.json"), "utf8")) as Results;
  const o = r.overall;

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 pb-20">
      <div className="grid gap-10 md:grid-cols-[1.3fr_1fr]">
        <div>
          <p className="text-sm text-muted">Blind accuracy test</p>
          <h1 className="mt-2 font-serif text-4xl font-medium tracking-tight sm:text-5xl">How we know it works</h1>
          <p className="mt-4 max-w-2xl text-lg leading-relaxed text-muted">
            A coach that accuses you of habits you don&apos;t have is worse than no coach. So before trusting Hindsight with anyone&apos;s trades,
            we tested it on traders whose habits we knew, without telling it.
          </p>
        </div>
        <dl className="grid grid-cols-2 gap-6 self-end border-t border-ink pt-4">
          <div>
            <dt className="text-xs text-muted">Hidden habits found</dt>
            <dd className="num mt-1 text-3xl">{pct(o.detectionRate, { digits: 1 })}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted">False-alarm rate</dt>
            <dd className="num mt-1 text-3xl">{pct(o.falseAlarmRate, { digits: 1 })}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted">When it names a habit, it&apos;s real</dt>
            <dd className="num mt-1 text-3xl">{pct(o.precision, { digits: 1 })}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted">Habit-free traders wrongly accused</dt>
            <dd className="num mt-1 text-3xl">
              {r.cleanTraders.wronglyAccused}/{r.cleanTraders.total}
            </dd>
          </div>
        </dl>
      </div>

      <section className="mt-14 grid gap-10 md:grid-cols-[1fr_2fr]">
        <h2 className="font-serif text-2xl font-medium">The method</h2>
        <ol className="divide-y divide-rule border-y border-rule">
          {[
            `We generated ${r.traders} traders with different stocks, trade frequency, sizes, holding times and session habits, trading on real Bitget rToken and US stock prices from ${r.window[0].slice(0, 10)} to ${r.window[1].slice(0, 10)}: ${r.trades.toLocaleString("en-US")} trades in total.`,
            "Each of the five habits was secretly given to each trader with a 40% chance, at a random strength between 0.3 (faint) and 1 (strong). Some traders got none.",
            "Hindsight saw only the trades, exactly as it would see yours, and reported what it found.",
            "We tuned the detectors on a separate development set of 200 traders, then ran this held-out set once, untouched. These are those numbers.",
          ].map((t, i) => (
            <li key={i} className="grid grid-cols-[2rem_1fr] gap-3 py-4 leading-relaxed">
              <span className="num text-sm text-muted">0{i + 1}</span>
              <span>{t}</span>
            </li>
          ))}
        </ol>
      </section>

      <section className="mt-14">
        <h2 className="border-b border-ink pb-2 font-serif text-2xl font-medium">Results by habit</h2>
        <div className="overflow-x-auto">
          <table className="mt-2 w-full min-w-[40rem] text-sm">
            <thead className="text-xs text-muted">
              <tr className="border-b border-rule">
                <th scope="col" className="py-2 text-left font-normal">
                  Habit
                </th>
                <th scope="col" className="py-2 text-right font-normal">
                  Found when present
                </th>
                <th scope="col" className="py-2 text-right font-normal">
                  False alarms when absent
                </th>
                <th scope="col" className="py-2 text-right font-normal">
                  Precision
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-rule">
              {HABITS.map((h) => {
                const c = r.perHabit[h];
                return (
                  <tr key={h}>
                    <td className="py-3">{HABIT_TITLES[h]}</td>
                    <td className="num py-3 text-right">
                      {pct(c.detectionRate, { digits: 1 })} <span className="text-muted">({c.tp}/{c.tp + c.fn})</span>
                    </td>
                    <td className="num py-3 text-right">
                      {pct(c.falseAlarmRate, { digits: 1 })} <span className="text-muted">({c.fp}/{c.fp + c.tn})</span>
                    </td>
                    <td className="num py-3 text-right">{pct(c.precision, { digits: 1 })}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <h3 className="mt-10 text-sm text-muted">Found, by how strong the habit was</h3>
        <ul className="mt-3 space-y-3">
          {r.byStrength.map((b) => (
            <li key={b.band} className="grid grid-cols-[9rem_1fr_8.5rem] sm:grid-cols-[11rem_1fr_8.5rem] items-center gap-4 text-sm">
              <span className="capitalize">{b.band}</span>
              <span className="h-2 rounded-full bg-rule">
                <span className="block h-2 rounded-full bg-ink" style={{ width: `${b.detectionRate * 100}%` }} />
              </span>
              <span className="num text-right">
                {pct(b.detectionRate, { digits: 0 })} <span className="text-muted">({b.detected}/{b.planted})</span>
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-14 grid gap-10 md:grid-cols-[1fr_2fr]">
        <h2 className="font-serif text-2xl font-medium">What this does and doesn&apos;t show</h2>
        <div className="space-y-4 leading-relaxed">
          <p>
            <span className="mark">Hindsight is built to stay quiet when unsure.</span> It would rather miss a faint habit than accuse you of
            one you don&apos;t have. Faint habits are often missed; strong ones are usually caught.
          </p>
          <p>
            <span className="font-medium">Earnings habits are the hardest to prove.</span> Six months holds only about two earnings reports per
            company, so even a real habit leaves few traces. Hindsight shows these as &quot;watching&quot; until the evidence is enough.
          </p>
          <p>
            <span className="font-medium">These are simulated traders.</span> The prices are real but the behaviour is generated, so this
            measures whether the statistics work, not how common these habits are among real traders. Testing on real traders&apos; histories
            is next.
          </p>
          <p className="text-sm text-muted">
            Reproduce it: <code className="num rounded-sm bg-sheet px-1">pnpm blind-test --final</code> (seeds {r.seeds[0]}–{r.seeds[1]}, run{" "}
            {r.runAt.slice(0, 10)}).{" "}
            <Link href="/review" className="text-accent underline-offset-2 hover:underline">
              See a review
            </Link>
          </p>
        </div>
      </section>
    </div>
  );
}
