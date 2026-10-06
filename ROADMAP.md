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
- [ ] Product spec and target user (`docs/SPEC.md`)
- [ ] Bitget public REST client: rToken spot candles, stock perps candles, funding
- [ ] Yahoo client: underlying stock daily/hourly history incl. extended hours
- [ ] Bitget MCP data client (news, earnings, fear & greed), fails gracefully
- [ ] US market session tagging (regular / pre / post / overnight / weekend / holiday)
- [ ] rToken vs underlying gap calculation
- [ ] Snapshot cache for ~10 stocks so the demo works offline
- [ ] Deployed live on Vercel

### Block B: Trades (10:00–13:00)
- [ ] Trade data model; fills matched into round trips (FIFO, fees, partial fills)
- [ ] Sample trader "Tolu" (~120 trades over 6 months on real prices, 5 planted habits)
- [ ] CSV import (Bitget trade-history export)

### Block C: The maths (13:00–17:00)
- [ ] Replay engine: per-trade fact sheet (P&L, MFE/MAE, exit efficiency, session, weekend hold and Monday gap, premium at entry, earnings/news proximity, mood, relative size, sequence)
- [ ] Pattern finder for 5 habits with statistical guardrails (min sample, confidence, luck check)
- [ ] **Blind accuracy test:** 200 simulated traders with random hidden habits; report detection rate and false-alarm rate

### Block D: The AI layer (17:00–21:00)
- [ ] Habit explanations with cited evidence trades
- [ ] Rulebook: accept/reject, "if you'd followed this rule" what-if
- [ ] Pre-trade check: plain-language idea → verdict + evidence → human decides (logged)
- [ ] Chat with tools over trades and market data
- [ ] Grounding check: AI never states a number the code didn't compute (~10 test questions)

### Block E: Product polish (21:00–01:00)
- [ ] Landing, import, dashboard, trade detail chart, patterns, rules, check, chat
- [ ] Empty / loading / error states, mobile
- [ ] Demo mode runs entirely from snapshots

### Block F: Usability testing (Oct 7, 07:00–10:00)
- [ ] 5–10 testers, 3 tasks each; completion rate, time to first insight, quotes
- [ ] Fix what confused them
- [ ] **10:00 go/no-go**

### Block G: Submission (10:00–15:00)
- [ ] Demo video (2–3 min)
- [ ] 6-part project description + "Role of the LLM"
- [ ] README with architecture diagram
- [ ] X post: #BitgetHackathon + @Bitget_AI, quoting https://x.com/Bitget_AI/status/2100519318824055159
- [ ] Google Form submitted: https://forms.gle/GyWZCMCPocgJdJon6

---

## After S2 (toward Season 3)
- [ ] Read-only Bitget API-key import (encrypted, deletable)
- [ ] 2–3 sample traders; full habit library (9+)
- [ ] Rule editing and version history
- [ ] Outcome feedback loop: logged decisions update rules
- [ ] Weekly / monthly review reports, shareable
- [ ] Full ~30-question AI evaluation set
- [ ] Study with 5–10 real traders on their own histories
- [ ] On-chain tokenized-stock wallets as real-world case studies
- [ ] Security checklist, rate limits, AI cost cap, monitoring
