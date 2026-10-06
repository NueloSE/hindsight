# Hindsight: product spec

## One line
An AI post-trade review coach for people who trade tokenized US stocks (Bitget rTokens) around the clock. It replays every trade against real market data, finds the habits that cost money, proves them with the trader's own trades, turns them into personal rules, and checks the next trade idea against those rules. The trader always makes the final call.

## Target user
Retail rToken trader on Bitget:
- Account size roughly $1k–$50k, trades several times a week
- Trades a handful of large US names and index ETFs (NVDA, TSLA, SPY, QQQ, ...)
- Often trades outside US market hours (overnight, weekends), when rTokens are the only venue open
- Has no trading journal, or one they never review
- Pain: repeats the same mistakes because nobody shows them the pattern with evidence

Not for: institutional desks, high-frequency traders, people without a trade history.

## Core loop
1. **Import:** sample trader (no login), Bitget CSV export, (later) read-only API key
2. **Replay:** every round-trip trade gets a fact sheet computed from market data
3. **Patterns:** code compares groups of trades and surfaces habits that pass statistical guardrails; the AI names and explains each one, citing trade IDs
4. **Rules:** each accepted habit becomes a personal rule with a machine-checkable condition and a "what if you'd followed it" figure
5. **Check:** a new trade idea is checked against the rules and the trader's similar past trades; verdict plus evidence; the human decides; the decision is logged

## Principles
- **Code calculates, the AI explains.** No number in the UI or in an AI answer may come from the model; the model only references computed facts.
- **No false accusations.** A habit is shown only with a minimum sample, a confidence label, and a check against luck.
- **Every claim has receipts.** Each habit links to the exact trades behind it.
- **Works offline.** Demo mode runs entirely from stored market data snapshots.
- **Human decides.** Hindsight never places orders.

## Out of scope
Order placement, automated trading, backtesting engines, wallet connections, crypto-only trading review.

## Data sources
| Source | Use |
|---|---|
| Bitget public REST (`api.bitget.com/api/v2`) | rToken spot candles 24/7, stock perps candles and funding |
| Yahoo Finance chart API | Underlying stock prices incl. pre/post market, the reference price |
| Bitget data MCP (`agent.bitget.com/mcp`) | News, earnings calendar, analyst targets, fear & greed (optional; degrades gracefully) |
| Bitget `bitget-signal` skills | Crypto-side macro and sentiment context (optional) |

## Habits (S2 set)
1. **Weekend chasing:** buying rTokens after a large move while the US market is closed
2. **Earnings roulette:** holding positions through earnings
3. **Cutting winners early:** low exit efficiency on winning trades vs losers held long
4. **Revenge trading:** opening a trade soon after a loss, larger than usual
5. **Premium paying:** buying when the rToken trades well above the underlying reference price
