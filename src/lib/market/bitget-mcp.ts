import { fetchJson } from "./http";

/**
 * Client for Bitget's read-only data MCP server (https://agent.bitget.com/mcp).
 * It exposes two tools: `guide` (browse the data catalog) and `do_query` (run a catalog entry).
 * Time params are epoch milliseconds as integers. The backend can be unavailable, so every
 * call returns a result object instead of throwing.
 */
const ENDPOINT = "https://agent.bitget.com/mcp";
const PROTOCOL = "2025-06-18";

export type McpResult<T> = { ok: true; data: T } | { ok: false; error: string };

let sessionId: string | null = null;
let rpcId = 1;

function parseSse(body: string): unknown {
  const line = body.split("\n").find((l) => l.startsWith("data: "));
  return JSON.parse(line ? line.slice(6) : body);
}

async function rpc(method: string, params?: unknown, notify = false): Promise<{ body: unknown; headers: Headers }> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json, text/event-stream",
    "MCP-Protocol-Version": PROTOCOL,
  };
  if (sessionId) headers["mcp-session-id"] = sessionId;
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers,
    body: JSON.stringify(notify ? { jsonrpc: "2.0", method, params } : { jsonrpc: "2.0", id: rpcId++, method, params }),
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) throw new Error(`MCP ${method}: HTTP ${res.status}`);
  const text = await res.text();
  return { body: text ? parseSse(text) : null, headers: res.headers };
}

async function ensureSession(): Promise<void> {
  if (sessionId) return;
  const { headers } = await rpc("initialize", {
    protocolVersion: PROTOCOL,
    capabilities: {},
    clientInfo: { name: "hindsight", version: "0.1.0" },
  });
  sessionId = headers.get("mcp-session-id");
  await rpc("notifications/initialized", undefined, true);
}

interface ToolCallBody {
  result?: { content?: { text?: string }[]; isError?: boolean };
  error?: { message: string };
}

interface QueryEnvelope<T> {
  success: boolean;
  status_code: number | null;
  data: T;
  error: string | null;
}

/** Run a data catalog entry, e.g. query("equity_calendar", { symbol: "NVDA" }). */
export async function query<T = unknown>(entryId: string, params: Record<string, unknown> = {}): Promise<McpResult<T>> {
  try {
    await ensureSession();
    const { body } = await rpc("tools/call", { name: "do_query", arguments: { entry_id: entryId, params } });
    const b = body as ToolCallBody;
    if (b.error) return { ok: false, error: b.error.message };
    const text = b.result?.content?.[0]?.text;
    if (!text) return { ok: false, error: "empty response" };
    const env = JSON.parse(text) as QueryEnvelope<T>;
    if (!env.success) {
      return { ok: false, error: env.error ?? `upstream status ${env.status_code ?? "unknown"}` };
    }
    return { ok: true, data: env.data };
  } catch (err) {
    sessionId = null; // force a fresh session next time
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/** Is the data backend answering right now? */
export async function healthCheck(): Promise<McpResult<true>> {
  const r = await query("sentiment_market_fear_greed");
  return r.ok ? { ok: true, data: true } : r;
}

// Re-exported so callers can share the retrying fetch helper if they talk to the REST side.
export { fetchJson };
