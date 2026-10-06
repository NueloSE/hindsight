export class HttpError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "HttpError";
  }
}

interface FetchJsonOptions extends RequestInit {
  timeoutMs?: number;
  retries?: number;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * fetch + JSON parse with a timeout and exponential backoff on network errors,
 * 429 and 5xx. Other 4xx responses fail immediately.
 */
export async function fetchJson<T>(url: string, opts: FetchJsonOptions = {}): Promise<T> {
  const { timeoutMs = 15_000, retries = 3, ...init } = opts;
  let lastError: unknown;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) });
      if (res.ok) return (await res.json()) as T;
      const retryable = res.status === 429 || res.status >= 500;
      lastError = new HttpError(`${res.status} ${res.statusText} for ${url}`, res.status);
      if (!retryable) throw lastError;
    } catch (err) {
      if (err instanceof HttpError && err.status && err.status < 500 && err.status !== 429) throw err;
      lastError = err;
    }
    if (attempt < retries) await sleep(500 * 2 ** attempt);
  }
  throw lastError;
}
