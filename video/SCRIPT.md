# Hindsight demo film: brief and script

## Phase 1 · Brief

| | |
|---|---|
| **Product** | Hindsight, an AI post-trade coach for Bitget rToken (tokenized US stock) traders |
| **For** | Retail rToken traders, $1k–$50k accounts, often trading nights and weekends |
| **The one problem** | Traders repeat costly habits because nobody shows them the pattern with evidence, and 24/7 trading removes the closing bell that used to make them pause |
| **What it does** | Replays every trade against real market data, finds habits with statistical tests, proves each with the trader's own trades, turns them into rules with honest what-ifs, and checks the next trade idea against them. The trader decides. |
| **Principle** | Code calculates, the AI explains |
| **Proven** | Blind test on 200 held-out simulated traders (70.6% of hidden habits found, 82.2% of strong ones, 0.2% false alarms, 0/16 habit-free traders accused); coach eval 10/10 grounded; 48 automated tests; live on Vercel; read-only Bitget API import tested on a real account |
| **Not claimed** | Results on real traders' histories (not yet tested); predicting prices; that the rules make money (on Tolu's history they mostly cut risk, not boost profit) |

**Pronunciation:** Hindsight (HINED-site) · Tolu (TOH-loo) · rToken ("R token") · rMSTR ("R, M-S-T-R")

**Target length:** about 2 min 50 s · 35 lines · ~430 words at ~155 wpm

---

## Phase 2 · Script

| id | line (written for the ear) | source |
|---|---|---|
| **Cold open: a real failure** | | |
| l01 | Between nineteen ninety-one and ninety-six, researchers followed sixty-six thousand households trading at a US broker. | Barber & Odean (2000), *Trading Is Hazardous to Your Wealth*, J. Finance 55(2) |
| l02 | The ones who traded most earned eleven point four percent a year. The market earned seventeen point nine. | same |
| l03 | It wasn't bad luck. It was habits. | same (overconfidence explains excess trading) |
| **Why the obvious fix fails** | | |
| l04 | Now tokenized stocks trade around the clock. There's no closing bell to make you stop and think. | Bitget lists 2,808 rTokens trading 24/7 (Bitget public API, snapshot Oct 6) |
| l05 | And on weekends, trading in them is over a thousand times thinner than during market hours. | Our measurement: rNVDA/rSPY weekend vs regular $ volume per hour (ROADMAP, Block A notes) |
| l06 | Generic AI advice won't help. It doesn't know your trades, and it can't show its working. | (framing) |
| **Title drop** | | |
| l07 | This is Hindsight. | |
| l08 | Your trades, reviewed. | |
| **The cast** | | |
| l09 | Meet Tolu. Tolu trades R tokens on Bitget, often at night and on weekends. | src/lib/sim/personas.ts |
| l10 | Tolu is simulated, but every price you'll see is real Bitget and stock market data from twenty twenty-six. | data/snapshots (Bitget REST, Yahoo, Nasdaq) |
| **The product** | | |
| l11 | Hindsight replays all one hundred and six of Tolu's trades, hour by hour, against the real R token and the real stock. | replay engine; review shows 106 round trips |
| **Chapter 1 · Find the habits** | | |
| l12 | Five statistical tests ask one question: is this behaviour more than chance? | src/lib/review/patterns.ts |
| l13 | For Tolu: four habits found, and one ruled out. | review findings |
| l14 | Thirty-seven percent of Tolu's buys while Wall Street slept came after the R token had already jumped. Chance would give nine. | chasing: chaseRate 37%, chanceRate 9% |
| l15 | And every claim links to the trades behind it. | evidence chips |
| l16 | The shaded hours are when the US market was closed. Here, Tolu bought on a Saturday, and held straight through earnings. | trade #81: opened Sat Aug 22, crossed NVDA earnings |
| **Chapter 2 · Honest rules** | | |
| l17 | Each habit becomes a personal rule, with an honest what-if. | rules.ts |
| l18 | A three percent stop-loss would have cost Tolu five hundred and forty-three dollars, | stop-loss what-if: −$543 |
| l19 | but cut the worst trade from minus seventeen point nine percent to minus three point two. | worst trade −17.9% → −3.2% |
| l20 | Hindsight shows the trade-off. You decide. | |
| **Chapter 3 · Check before you trade** | | |
| l21 | Early Sunday morning. R, M-S-T-R is up two point four percent since Friday's close. | check scenario, Oct 4 04:00 UTC, move +2.4% |
| l22 | Tolu types the idea, and Hindsight checks it against the rules. | /check |
| l23 | It matches the chasing habit. The last twenty-five times, Tolu won sixty-four percent, for forty-five dollars in total. | check result: 25 trades, 64% win, +$45 |
| l24 | Tolu takes it smaller. The decision is logged. | decision log |
| **Chapter 4 · Ask the coach** | | |
| l25 | Questions get answers from the data. | /coach |
| l26 | The coach looks things up before it answers, and cites the trades it used. | chat tools, trade citations |
| l27 | Every number it writes is checked against the computed facts. If a number can't be traced, it's thrown out. | grounding check (src/lib/ai/grounding.ts) |
| **Proof** | | |
| l28 | So how do we know the habits are real? | |
| l29 | We hid habits in two hundred simulated traders, and didn't tell Hindsight. | blind test, held-out seeds 1001–1200 |
| l30 | It found seventy-one percent of them, and eighty-two percent of the strong ones, | 70.6%, 82.2% |
| l31 | with a false-alarm rate of zero point two percent. No habit-free trader was ever accused. | 0.2% (1/588); 0/16 |
| l32 | Ten out of ten coach answers fully grounded. Forty-eight automated tests. | data/eval/coach.json; vitest |
| l33 | Connect a read-only Bitget key, and review your own last ninety days. | src/lib/bitget/private.ts, tested on a real Classic account |
| **Close** | | |
| l34 | Code calculates. The AI explains. | |
| l35 | Hindsight. Your trades, reviewed. | end card: hindsight-puce.vercel.app · github.com/NueloSE/hindsight |

## Storyboard (draft; finalised after word timing)

| scene | ~time | lines | what appears |
|---|---|---|---|
| Cold open | 0:00–0:20 | l01–l03 | Ledger rows tick past; "11.4%" vs "17.9%" bars; the gap highlighted with the marker |
| The 24/7 problem | 0:20–0:38 | l04–l06 | A clock face that never stops; weekend volume bar shrinking to a sliver |
| Title | 0:38–0:44 | l07–l08 | The mark draws itself, name lands on the music drop |
| Cast | 0:44–0:55 | l09–l10 | Tolu's 106 trades as dots on a timeline, nights and weekends shaded |
| Product | 0:55–1:03 | l11 | Dots fly into the real review page |
| Ch 1 | 1:03–1:32 | l12–l16 | Habit tiles, the chasing tile, evidence chip click → trade #81 chart |
| Ch 2 | 1:32–1:50 | l17–l20 | Rule card: camera on P&L −$543, then worst trade −17.9% → −3.2% |
| Ch 3 | 1:50–2:12 | l21–l24 | Check page: type the idea, verdict, history, "Take it smaller" click, log |
| Ch 4 | 2:12–2:27 | l25–l27 | Coach answer streaming, tool ticks, "numbers checked" line |
| Proof | 2:27–2:48 | l28–l33 | Accuracy page numbers; import page with API key form |
| Close | 2:48–2:55 | l34–l35 | Mark, tagline, URL and repo, credits |
