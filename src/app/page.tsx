import { readFileSync } from "node:fs";
import { join } from "node:path";
import Link from "next/link";
import { pct } from "@/lib/format";
import { analyze } from "@/lib/review/analyze";

interface BlindResults {
  traders: number;
  trades: number;
  overall: { detectionRate: number; falseAlarmRate: number; fp: number; fp_tn?: number; tn: number };
  byStrength: { band: string; detectionRate: number }[];
  cleanTraders: { total: number; wronglyAccused: number };
}

const STEPS = [
  { title: "Import", body: "Load your Bitget rToken trade history as a CSV, or start with Tolu, our sample trader." },
  {
    title: "Replay",
    body: "Every trade is replayed hour by hour against real rToken and stock prices: what session it was, how far the rToken had moved since the US close, earnings, what happened after you sold.",
  },
  {
    title: "Find habits",
    body: "Statistical tests compare your behaviour with what chance would produce. A habit is only named when the evidence is clear, and every claim links to the trades behind it.",
  },
  {
    title: "Rules and checks",
    body: "Each habit becomes a personal rule with an honest what-if: the money and the risk. Before your next trade, Hindsight checks the idea against your rules. You decide.",
  },
];

export default function Home() {
  const sample = analyze({ kind: "sample" });
  const chase = sample.review.findings.find((f) => f.id === "closed-chasing")!;
  const detected = sample.review.findings.filter((f) => f.status === "detected").length;
  const ruledOut = sample.review.findings.length - detected;
  const blind = JSON.parse(readFileSync(join(process.cwd(), "data", "blind-test", "results.json"), "utf8")) as BlindResults;
  const strong = blind.byStrength.at(-1)!;

  return (
    <>
      <section className="mx-auto grid max-w-6xl gap-12 px-4 pb-16 pt-14 md:grid-cols-[1.15fr_1fr] md:pt-20">
        <div>
          <p className="text-sm text-muted">Post-trade review for Bitget rToken traders</p>
          <h1 className="mt-4 font-serif text-5xl font-medium leading-[1.05] tracking-tight sm:text-6xl">
            Your trades,
            <br />
            <span className="italic">reviewed.</span>
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted">
            Tokenized US stocks trade around the clock, and so do your mistakes. Hindsight replays every trade against real market
            data, finds the habits that cost you money, proves them with your own trades, and turns them into rules that check your
            next one.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/review"
              className="rounded-md bg-accent px-4 py-2.5 text-sm font-medium text-accent-ink transition-opacity duration-150 hover:opacity-90"
            >
              See a sample review
            </Link>
            <Link
              href="/import"
              className="rounded-md border border-rule px-4 py-2.5 text-sm font-medium transition-colors duration-150 hover:border-ink"
            >
              Review my trades
            </Link>
          </div>
        </div>

        <figure className="self-end rounded-md border border-rule bg-sheet p-6">
          <figcaption className="flex items-baseline justify-between text-xs text-muted">
            <span>From Tolu&apos;s review</span>
            <span className="num">{sample.facts.length} trades · Apr–Sep 2026</span>
          </figcaption>
          <p className="mt-4 font-serif text-2xl leading-snug">{chase.title}</p>
          <p className="mt-3 leading-relaxed">
            <span className="mark">
              <span className="num">{chase.metrics.chaseEntries}</span> of Tolu&apos;s <span className="num">{chase.metrics.closedEntries}</span>{" "}
              buys
            </span>{" "}
            while the US market was closed came after the rToken had already jumped {pct(chase.metrics.thresholdMove, { sign: true })} or more
            since the close. Chance alone would put about <span className="num">{pct(chase.metrics.chanceRate, { digits: 0 })}</span> of buys in
            moments like that. Tolu&apos;s rate was <span className="mark num">{pct(chase.metrics.chaseRate, { digits: 0 })}</span>.
          </p>
          <p className="mt-4 border-t border-rule pt-3 text-sm text-muted">
            {detected} habits found, {ruledOut} ruled out. Each one links to the trades that prove it.
          </p>
        </figure>
      </section>

      <section className="border-y border-rule bg-sheet">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:grid-cols-3">
          <div>
            <p className="num text-3xl">{pct(blind.overall.detectionRate, { digits: 0 })}</p>
            <p className="mt-1 text-sm text-muted">
              of hidden habits found in a blind test of {blind.traders} simulated traders ({pct(strong.detectionRate, { digits: 0 })} of strong ones)
            </p>
          </div>
          <div>
            <p className="num text-3xl">{pct(blind.overall.falseAlarmRate, { digits: 1 })}</p>
            <p className="mt-1 text-sm text-muted">false-alarm rate: habits wrongly reported where none existed</p>
          </div>
          <div>
            <p className="num text-3xl">
              {blind.cleanTraders.wronglyAccused}/{blind.cleanTraders.total}
            </p>
            <p className="mt-1 text-sm text-muted">
              habit-free traders wrongly accused.{" "}
              <Link href="/accuracy" className="text-accent underline-offset-2 hover:underline">
                How we tested
              </Link>
            </p>
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl gap-10 px-4 py-16 md:grid-cols-[1fr_2fr]">
        <div>
          <h2 className="font-serif text-3xl font-medium tracking-tight">How it works</h2>
          <p className="mt-3 text-muted">
            <span className="mark">Code calculates, the AI explains.</span> Every number comes from market data and tested code. The AI
            writes the coaching, and any sentence citing a number the code didn&apos;t produce is thrown out.
          </p>
        </div>
        <ol className="divide-y divide-rule border-y border-rule">
          {STEPS.map((s, i) => (
            <li key={s.title} className="grid grid-cols-[2.5rem_1fr] gap-4 py-5">
              <span className="num pt-0.5 text-sm text-muted">0{i + 1}</span>
              <div>
                <h3 className="font-medium">{s.title}</h3>
                <p className="mt-1 leading-relaxed text-muted">{s.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-20">
        <p className="max-w-3xl text-sm leading-relaxed text-muted">
          Tolu is a simulated trader: the trades are generated, but every price is real Bitget rToken and US stock data from 2026. Your own
          CSV stays in your browser and is only sent to Hindsight&apos;s server to be analysed; nothing is stored.
        </p>
      </section>
    </>
  );
}
