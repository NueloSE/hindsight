# Hindsight: S2 submission drafts

Form: https://forms.gle/GyWZCMCPocgJdJon6 · Track: **AI Trading Desk** → sub-theme **Review & Self-Evolution**
Deadline: treat as end of **Oct 7, 2026 UTC+8** (17:00 WAT). Submit by 15:00 WAT.

Fields marked `[FILL]` need information only you have, or results from usability testing.

---

## Project name
Hindsight

## One-line pitch
An AI post-trade coach for 24/7 rToken traders: it replays every trade against real market data, finds the habits that cost you money, proves them with your own trades, and checks your next trade against rules built from them.

---

## Project description (paste into the single "Project Description" field)

**1 · Thesis**
Tokenized US stocks trade 24/7, but the underlying market doesn't. That creates new ways to make the same old mistakes: buying an rToken on a Sunday after it has already run, panic-selling into a thin overnight drop, holding through earnings, cutting winners while letting losers run, sizing up right after a loss. Traders repeat these because nobody shows them the pattern *with evidence*. Existing tools either show P&L (what happened, not why) or give generic AI commentary (confident, uncheckable). Our hypothesis: a review tool that tests a trader's behaviour against what chance alone would produce, and only speaks when the evidence is clear, can change behaviour where generic advice doesn't.

How it works: every round trip is replayed hour by hour against real Bitget rToken prices and the underlying stock (session, move since the US close, rToken vs stock gap, best/worst point, earnings crossed, what happened after the exit, size vs normal, the previous trade). Five habit detectors run one-sided statistical tests against chance baselines built from the trader's own stocks and holding times, with minimum samples and effect-size floors. Each detected habit becomes a personal rule with a machine-checkable condition and an honest what-if replayed on the trader's history, reporting both P&L and risk (worst trade, max drawdown). Before the next trade, a plain-language idea ("buy $1,500 of rMSTR") is checked against those rules and the trader's most similar past trades. The trader decides; the decision is logged.

Design principle: **code calculates, the AI explains.** No number shown to the user comes from the model. The LLM writes the coaching and answers questions through read-only tools; a grounding check rejects any AI sentence containing a number not present in the computed facts.

**2 · Target user and product value**
Retail rToken traders on Bitget with roughly $1k–$50k in their account, trading a handful of large US names and index ETFs (NVDA, TSLA, COIN, MSTR, SPY, QQQ) several times a week, often outside US market hours when rTokens are the only venue open. Moderate-to-high risk appetite, mobile-first, no trading journal (or one they never review). They need this because 24/7 access removes the natural pause of a closed market: the habits that cost money cluster exactly in the hours when there's nobody to check them. Hindsight is the review they don't have time to do, plus a check at the moment they're about to repeat a mistake.

**3 · Validation data and key metrics**
*Detection accuracy (observed, blind test).* We generated 400 simulated traders on real Bitget rToken and US stock prices (Apr–Sep 2026), each secretly assigned 0–5 habits at random strength. Hindsight saw only the trades. Detectors were tuned on 200 development traders; the 200 held-out traders were run once:
- **70.6% of hidden habits detected (82.2% of strong ones)**
- **0.2% false-alarm rate (1 in 588 habit-absent cases); 99.7% precision**
- **0 of 16 habit-free traders wrongly accused**
- Per habit: closed-market chasing 84.9%, closed-market panic selling 65.4%, earnings 37.3% (data-limited: ~2 reports per stock in 6 months), disposition 65.9%, revenge trading 95.3%.
Full method and limits: /accuracy. Reproducible: `pnpm blind-test --final`.

*Rule what-ifs (observed, sample trader on real prices).* Tolu's 106 trades: 63% win rate, −$55 net, but +$290 before $344 of fees. On real 2026 prices the rules trade a little return for lower risk, and Hindsight says so: e.g. a −3% stop would have cost $543 but cut the worst trade from −17.9% to −3.2% and max drawdown from $1,084 to $969.

*AI grounding (observed).* 10 realistic questions to the chat coach (e.g. "Which habit has cost me the most?", "Should I buy $1,000 of rMSTR right now?"): **10/10 answers had every number traceable to tool outputs, 10/10 looked data up first, 0 invalid trade citations.** Reproducible: `pnpm eval-coach`.

*Usability (observed).* [FILL after testing: N testers, task completion rate for (1) find the costliest habit (2) accept a rule (3) check a trade idea; median time to first insight; 1–2 quotes.]

*Distribution targets (targets, not yet observed).* 50 traders importing their own Bitget history in month one via the Bitget AI community and X build-in-public posts; ≥40% of them accepting at least one rule; ≥25% running a pre-trade check in their second week.

**4 · Progress**
Built and live: market data layer (Bitget public REST for 2,808 rTokens and stock perps, Yahoo Finance for the underlying incl. pre/post market, Nasdaq earnings calendar, Bitget data MCP client with graceful fallback, NYSE session calendar with holidays and early closes, committed snapshots for 11 instruments so the demo runs offline); trade matching and CSV import (Bitget-style export with UTC offsets and rToken-denominated fees); replay engine; five detectors; rulebook with P&L and risk what-ifs; pre-trade check with live and historical context; AI coaching with grounding check; tool-calling chat; review, trade detail, check, coach, import and accuracy pages. 41 automated tests.
Problems and fixes: the Bitget data MCP backend returned 503 throughout development, so earnings come from Nasdaq and every data path falls back to snapshots. We dropped a planned "premium paying" habit after finding it was statistically the same signal as closed-market chasing. Our first disposition detector required two tests to agree and missed most real cases; we kept the drift protection but relaxed the confirming test, raising detection from 35% to 66% with no new false alarms.
Also built: read-only Bitget API-key import (handles both Unified and Classic accounts; keys are used per request and never stored).
Next: outcome feedback so logged decisions update the rules, weekly review reports, a study with real traders' histories.
Stack: Next.js 16, TypeScript, Vercel; AI SDK 7.

**5 · Deliverables (all in "Submission Materials Link")**
- Live demo: https://hindsight-puce.vercel.app (no login; sample trader preloaded)
- Demo video: [FILL link]
- Code: https://github.com/NueloSE/hindsight
- Blind accuracy test, method and results: https://hindsight-puce.vercel.app/accuracy
- Example Bitget-style export to try the importer: https://hindsight-puce.vercel.app/example-bitget-export.csv
- Complete research task (question → actionable insight): "Should I buy $1,500 of rMSTR early on Sunday after it's up 2.4%?" → Hindsight flags the closed-market chasing rule, shows the trader's 25 previous chases (64% win rate, +0.04% average, +$45 total), the 15 most similar trades, and a stop-loss reminder; the trader chooses skip / smaller / take it, and the decision is logged.

**6 · Our take on AI trading (optional)**
The most useful thing an LLM can do for a retail trader isn't to predict prices, it's to make the trader's own evidence legible at the moment it matters, and to stay quiet when the evidence isn't there. We think trading copilots should be held to a measurable standard: publish a false-alarm rate, show the trades behind every claim, and make it structurally impossible for the model to invent a number.

---

## Role of the LLM in your project (separate field)
The LLM never computes. All statistics, prices and what-ifs come from deterministic, tested code. The model does three jobs:
1. **Parsing:** turns a plain-language trade idea ("thinking of grabbing $800 of tesla tonight") into a ticker, side and size, using structured output (GPT-6 Luna). A rule-based parser takes over if the model is unavailable.
2. **Coaching:** writes the explanation for each detected habit and each pre-trade check from a JSON of computed facts (GPT-6.1 Sol). Every response passes a grounding check: any number not present in the facts (allowing normal formatting such as percentages and rounding) gets the answer rejected, retried once with the offending numbers named, then replaced by the deterministic summary.
3. **Chat:** answers questions about the trader's history using read-only tools (overview, habit evidence, filtered trade lists, single trades, blind-test results, live pre-trade check), citing trades by number. The UI verifies each answer's numbers against the tool outputs and says so.
Qwen: we didn't receive Qwen credits; the model layer is one config file, so switching to Qwen through the Vercel AI Gateway is a one-line change.

---

## X posts

**Teaser (post today; quote https://x.com/Bitget_AI/status/2100519318824055159)**
> Building Hindsight for #BitgetHackathon S2 (AI Trading Desk).
>
> rTokens trade 24/7, so do your mistakes. Hindsight replays every trade against real market data and finds the habits that cost you money: chasing Sunday moves, panic-selling thin overnight drops, revenge trades.
>
> It only speaks when the stats say so. @Bitget_AI

**Final (post with the submission; quote the same post; attach a screenshot of a habit + rule card)**
> Hindsight is live for #BitgetHackathon S2.
>
> An AI coach for @Bitget_AI rToken traders. It replays every trade against real rToken + stock prices, finds your costly habits, proves each one with your own trades, and checks your next trade against rules built from them.
>
> Blind test on 200 simulated traders: 71% of hidden habits found, 0.2% false alarms.
>
> Code calculates, the AI explains: every number the AI writes is checked.
>
> Try it (no login): https://hindsight-puce.vercel.app

---

## Demo video script (2:30)
1. **0:00 Hook (15s).** Landing page. "rTokens trade 24/7. So do your mistakes. Hindsight is the review you never do."
2. **0:15 The review (45s).** Open Tolu's review. Summary: profitable before fees, fees turned it into a loss. Scroll to "Chasing moves while Wall Street sleeps": 37% vs 9% by chance. Click an evidence chip → trade chart with the shaded closed-market hours.
3. **1:00 Honest rules (30s).** Rule card: the stop-loss costs $543 but cuts the worst trade from −17.9% to −3.2%. "It tells you the trade-off, not a sales pitch." Click "Add to my rules".
4. **1:30 The research task (40s).** Check a trade → "Early Sunday, rMSTR up 2.4%". Verdict, past chases, similar trades, reminder. Click "Take it smaller": logged.
5. **2:10 Trust (20s).** Accuracy page: 71% found, 0.2% false alarms, 0/16 wrongly accused. "Code calculates, the AI explains." Ask the coach one question; show the "numbers checked" line.
6. **2:30 End.** URL on screen.

---

## Form checklist
- [ ] Bitget UID [FILL]
- [ ] Track: AI Trading Desk → Review & Self-Evolution
- [ ] Project description (above), with the usability numbers filled in
- [ ] Role of the LLM (above)
- [ ] Submission materials link: demo + video + code + accuracy page
- [ ] X post link (includes #BitgetHackathon and @Bitget_AI, quotes the official post)
- [ ] University name, if you're a student [FILL]
- [ ] Apply for Demo Day: Yes
- [ ] Apply for K3 Token Subsidy: Yes
- [ ] S1 participant: No
