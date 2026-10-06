"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import Link from "next/link";
import { Fragment, useMemo, useState, type ReactNode } from "react";
import { useDataset } from "@/components/dataset";
import { checkGrounding } from "@/lib/ai/grounding";

const SUGGESTIONS = [
  "Which habit has cost me the most?",
  "Show me my worst trades while the US market was closed",
  "Why do my earnings trades go badly?",
  "How accurate is Hindsight?",
  "Should I buy rNVDA right now?",
];

const TOOL_LABEL: Record<string, string> = {
  get_overview: "Read your review",
  get_habit: "Looked up a habit's evidence",
  list_trades: "Searched your trades",
  get_trade: "Opened a trade",
  get_accuracy: "Read the blind-test results",
  check_trade_idea: "Checked the idea against your rules",
};

/** #12 → link to trade 12; **bold**; keeps everything else as text. */
function inline(text: string, key: string): ReactNode[] {
  return text.split(/(#\d+|\*\*[^*]+\*\*)/g).map((part, i) => {
    const k = `${key}-${i}`;
    if (/^#\d+$/.test(part)) {
      return (
        <Link key={k} href={`/review/trades/${part.slice(1)}`} className="mark num rounded-sm px-0.5">
          {part}
        </Link>
      );
    }
    if (/^\*\*[^*]+\*\*$/.test(part)) return <strong key={k}>{part.slice(2, -2)}</strong>;
    return <Fragment key={k}>{part}</Fragment>;
  });
}

function Prose({ text }: { text: string }) {
  const blocks = text.trim().split(/\n{2,}/);
  return (
    <div className="space-y-3 leading-relaxed">
      {blocks.map((b, i) => {
        const lines = b.split("\n");
        if (lines.every((l) => /^\s*([-*]|\d+\.)\s/.test(l))) {
          return (
            <ul key={i} className="list-disc space-y-1 pl-5">
              {lines.map((l, j) => (
                <li key={j}>{inline(l.replace(/^\s*([-*]|\d+\.)\s/, ""), `${i}-${j}`)}</li>
              ))}
            </ul>
          );
        }
        return <p key={i}>{inline(b, String(i))}</p>;
      })}
    </div>
  );
}

function AssistantMessage({ m, done }: { m: UIMessage; done: boolean }) {
  const text = m.parts.map((p) => (p.type === "text" ? p.text : "")).join("");
  const tools = m.parts.filter((p) => p.type.startsWith("tool-")) as { type: string; state?: string; output?: unknown }[];
  const grounding = useMemo(() => {
    if (!done || !text) return null;
    const outputs = tools.map((t) => t.output).filter(Boolean);
    return checkGrounding(text, outputs);
  }, [done, text, tools]);

  return (
    <div>
      {tools.length > 0 && (
        <ul className="mb-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted">
          {tools.map((t, i) => (
            <li key={i}>
              {t.state === "output-available" ? "✓" : "…"} {TOOL_LABEL[t.type.slice(5)] ?? t.type.slice(5)}
            </li>
          ))}
        </ul>
      )}
      {text ? <Prose text={text} /> : !done && <p className="h-5 w-40 animate-pulse rounded-sm bg-rule" />}
      {grounding && grounding.checked > 0 && (
        <p className="mt-2 text-xs text-muted">
          {grounding.ok
            ? `All ${grounding.checked} numbers checked against Hindsight's computed data`
            : `Couldn't verify: ${grounding.unsupported.join(", ")}. Treat those with care.`}
        </p>
      )}
    </div>
  );
}

export function CoachView() {
  const { wire, dataset } = useDataset();
  const [input, setInput] = useState("");
  const { messages, sendMessage, status, error, stop } = useChat({ transport: new DefaultChatTransport({ api: "/api/chat" }) });
  const busy = status === "submitted" || status === "streaming";

  const ask = (q: string) => {
    if (!q.trim() || busy) return;
    sendMessage({ text: q }, { body: { dataset: wire } });
    setInput("");
  };

  return (
    <div className="mx-auto flex max-w-3xl flex-col px-4 py-10 pb-16">
      <h1 className="font-serif text-4xl font-medium tracking-tight sm:text-5xl">Ask the coach</h1>
      <p className="mt-3 text-muted">
        Questions about {dataset.kind === "sample" ? "Tolu's" : "your"} trades, answered from the review. The coach looks things up before it
        answers, cites trades by number, and every number it writes is checked.
      </p>

      <div className="mt-8 space-y-8" aria-live="polite">
        {messages.map((m, i) =>
          m.role === "user" ? (
            <div key={m.id} className="ml-auto max-w-[85%] rounded-md bg-sheet px-4 py-2.5 shadow-[0_0_0_1px_var(--rule)]">
              {m.parts.map((p, j) => (p.type === "text" ? <p key={j}>{p.text}</p> : null))}
            </div>
          ) : (
            <AssistantMessage key={m.id} m={m} done={!busy || i < messages.length - 1} />
          ),
        )}
        {status === "submitted" && messages.at(-1)?.role === "user" && <p className="h-5 w-48 animate-pulse rounded-sm bg-rule" aria-label="Thinking" />}
        {error && (
          <p className="rounded-md border border-rule bg-sheet p-4 text-sm">
            {error.message.includes("configured") ? "The AI coach isn't switched on for this deployment yet. The review, rules and checks all work without it." : "The coach couldn't answer that. Try again in a moment."}
          </p>
        )}
      </div>

      {messages.length === 0 && (
        <ul className="mt-6 flex flex-wrap gap-2">
          {SUGGESTIONS.map((s) => (
            <li key={s}>
              <button type="button" onClick={() => ask(s)} className="rounded-sm border border-rule px-3 py-1.5 text-left text-sm transition-colors duration-150 hover:border-ink">
                {s}
              </button>
            </li>
          ))}
        </ul>
      )}

      <form
        className="sticky bottom-4 mt-10 flex gap-2 rounded-md border border-rule bg-sheet p-2"
        onSubmit={(e) => {
          e.preventDefault();
          ask(input);
        }}
      >
        <label htmlFor="q" className="sr-only">
          Ask about your trades
        </label>
        <input
          id="q"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about your trades…"
          autoComplete="off"
          className="flex-1 bg-transparent px-2 py-1.5 outline-none placeholder:text-muted/70"
        />
        {busy ? (
          <button type="button" onClick={stop} className="rounded-sm px-3 py-1.5 text-sm text-muted hover:text-ink">
            Stop
          </button>
        ) : (
          <button type="submit" disabled={!input.trim()} className="rounded-sm bg-accent px-4 py-1.5 text-sm font-medium text-accent-ink transition-opacity duration-150 hover:opacity-90 disabled:opacity-50">
            Ask
          </button>
        )}
      </form>
      <p className="mt-3 text-center text-xs text-muted">The coach explains your history. It doesn&apos;t give financial advice or place trades.</p>
    </div>
  );
}
