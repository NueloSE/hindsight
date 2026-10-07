# Hindsight roadmap

**Hindsight** is an AI post-trade review coach for 24/7 tokenized US stock (rToken) traders. It replays every trade, finds losing habits with evidence, turns them into personal rules, and checks the next trade against them.

**Principle:** code calculates, the AI explains. Every number comes from real data and deterministic code; the LLM only names, explains and discusses.

**Target:** Bitget AI Base Camp Hackathon S2, Track 3 (AI Trading Desk), sub-theme *Review & Self-Evolution*.
**Deadline:** end of Oct 7, 2026 UTC+8 (17:00 WAT). Plan to submit by 15:00 WAT. Go/no-go check at 10:00 WAT on Oct 7.
If we miss it, the full scope carries to Season 3.

Status key: `[ ]` todo · `[~]` in progress · `[x]` done

---

## S2 sprint (milestone 1)

### Block A: Foundations and market data (Oct 6, 07:30–10:00)
- [x] Next.js 16 app scaffolded in `hindsight/`, Node 22 pinned
- [x] Product spec and target user (`docs/SPEC.md`)
- [x] Bitget public REST client: rToken spot candles, stock perps candles, funding
- [x] Yahoo client: underlying stock daily/hourly history incl. extended hours
- [x] Bitget MCP data client (news, earnings, fear & greed), fails gracefully
- [x] US market session tagging (regular / pre / post / overnight / weekend / holiday)
- [x] rToken vs underlying gap calculation
- [x] Snapshot cache for ~10 stocks so the demo works offline
- [x] Deployed live on Vercel: https://hindsight-puce.vercel.app

**Block A notes**
- Bitget data MCP returned 503 all morning (Oct 6). Client degrades gracefully; earnings come from Nasdaq's public calendar instead.
- 11 instruments snapshotted: rToken 1h from 2026-03-02, 1d from 2025-06; stock 1h incl. pre/post, 1d; 27 earnings events.
- rToken weekend liquidity is ~1000x thinner than regular hours; illiquid names (SPY, PLTR) skip many weekend hours entirely.
- rToken premium vs underlying: ~±1% (p5–p95) overnight/weekend, ~±0.1% after-hours.

### Block B: Trades (10:00–13:00)
- [x] Trade data model; fills matched into round trips (scale-ins/outs, fees, partial fills, mid-position history)
- [x] Sample trader "Tolu" (114 trades, Apr–Sep 2026, real prices, 4 habits planted; panic selling deliberately absent)
- [x] CSV import (Bitget-style export with header aliases, UTC offsets, rToken/BGB fees; Hindsight template)

**Block B notes**
- Habit 5 changed from "premium paying" to **closed-market panic selling**: premium while closed equals the move since close, so it overlapped chasing. See docs/SPEC.md.
- Closed-market habits cover overnight + weekend + holiday, not just weekends: COIN/MSTR move with BTC all weekend.
- Simulator: seeded, ~4 ms per trader; records which habits drove each trade (ground truth for the blind test).
- Tolu: 61% win rate but winners held 39h for +1.7% avg vs losers 109h for −3.7%: the disposition habit shows in real-price outcomes.

### Block C: The maths (13:00–17:00)
- [x] Replay engine: per-trade fact sheet (P&L, MFE/MAE, exit efficiency, session, weekend hold and Monday gap, premium at entry, earnings/news proximity, mood, relative size, sequence)
- [x] Pattern finder for 5 habits with statistical guardrails (min sample, confidence, luck check, "watching" state)
- [x] **Blind accuracy test:** 200 simulated traders with random hidden habits; report detection rate and false-alarm rate

**Block C notes**
- Blind test, held-out seeds 1001–1200 (dev seeds 1–200 used for tuning; final run once): 200 traders, 23,942 trades on real rToken prices.
  **70.6% of hidden habits detected (82.2% of strong ones), 0.2% false-alarm rate (1/588), 99.7% precision, 0/16 habit-free traders accused.**
  Per habit: chasing 84.9%, panic 65.4%, earnings 37.3%, disposition 65.9%, revenge 95.3%. Results in data/blind-test/results.json.
- Earnings detection is data-limited: ~2 reports per stock in 6 months. Kept strict; added a "watching" state (p < 0.05) instead.
- Disposition uses two drift-opposed tests: exits-in-profit vs time-in-profit (primary, p < 0.01) and losers-held-longer (must agree, p < 0.25).
- Not yet in the fact sheet: market mood (Bitget data MCP down). Revisit if it recovers.

### Block D: The AI layer (17:00–21:00)
- [x] Habit explanations with cited evidence trades
- [x] Rulebook: accept/reject, "if you'd followed this rule" what-if
- [x] Pre-trade check: plain-language idea → verdict + evidence → human decides (logged)
- [x] Chat with tools over trades and market data
- [x] Grounding check: AI never states a number the code didn't compute. Coach eval (scripts/eval-coach.mts, 10 questions): **10/10 grounded, 10/10 used tools, 0 invalid citations**. Sample coaching pre-generated and fingerprinted (data/coaching).

### Block E: Product polish (21:00–01:00)
- [x] Landing, import, dashboard, trade detail chart, patterns, rules, check, chat
- [x] Empty / loading / error states, mobile (checked at 500px; dark mode checked)
- [x] Demo mode runs entirely from snapshots

**Block D/E notes**
- AI Gateway needs a card on file; user chose their own OpenAI key instead (gpt-6.1-sol coach, gpt-6-luna parser). One-line switch back to Qwen in src/lib/ai/models.ts. Qwen use does not affect S2 judging.
- Every AI path falls back to computed text without a key; the product works fully offline from snapshots.
- On real prices Tolu's rules mostly cost a little return but cut risk (drawdown $1,084 → $969–$1,039; stop-loss worst trade −17.9% → −3.2%). Rule cards report both honestly.
- Design: editorial "case file" direction, docs/BRAND.md.

### Block F: Usability testing (Oct 7, 07:00–10:00)
- [ ] 5–10 testers, 3 tasks each; completion rate, time to first insight, quotes
- [ ] Fix what confused them
- [ ] **10:00 go/no-go**

### Block G: Submission (10:00–15:00)
- [ ] Demo video (2–3 min); script in docs/SUBMISSION.md
- [~] 6-part project description + "Role of the LLM" (drafted in docs/SUBMISSION.md; usability numbers to fill)
- [x] README with architecture diagram
- [ ] X post: #BitgetHackathon + @Bitget_AI, quoting https://x.com/Bitget_AI/status/2100519318824055159
- [ ] Google Form submitted: https://forms.gle/GyWZCMCPocgJdJon6

---

**Oct 7 changes (from user review)**
- Landing is general ("Try the live demo" / "Review my trades"); the dataset pill and a demo banner appear only inside the app.
- Import page has a step-by-step Bitget CSV export guide (web only, Orders → Spot → Order history → Download → CSV; link expires in 7 days).
- Read-only API-key import built and tested with a real key (Classic account, 0 trades): v3 UTA `/api/v3/trade/fills` with fallback to v2 `/api/v2/spot/trade/fills` on 40084. Both APIs only reach the last 90 days. Fill parsing follows Bitget's documented shapes (via ccxt); not yet tested on an account with real rToken fills.

## After S2 (toward Season 3)
- [x] Read-only Bitget API-key import (beta; keys used per request, never stored)
- [ ] Verify API and CSV parsing against an account with real rToken trades
- [ ] 2–3 sample traders; full habit library (9+)
- [ ] Rule editing and version history
- [ ] Outcome feedback loop: logged decisions update rules
- [ ] Weekly / monthly review reports, shareable
- [ ] Full ~30-question AI evaluation set
- [ ] Study with 5–10 real traders on their own histories
- [ ] On-chain tokenized-stock wallets as real-world case studies
- [ ] Security checklist, rate limits, AI cost cap, monitoring
