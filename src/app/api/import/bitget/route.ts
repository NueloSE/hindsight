import { z } from "zod";
import { BitgetAuthError, importFromBitget } from "@/lib/bitget/private";

export const maxDuration = 60;

const Body = z.object({
  apiKey: z.string().trim().min(10).max(200),
  secret: z.string().trim().min(10).max(200),
  passphrase: z.string().trim().min(1).max(200),
});

/**
 * Fetches the caller's last 90 days of spot fills with their read-only Bitget key.
 * The key is used for this request only: it is never stored, logged or returned.
 */
export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Enter the API key, secret key and passphrase." }, { status: 400 });
  try {
    const r = await importFromBitget(parsed.data);
    return Response.json(r, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    const message = err instanceof BitgetAuthError ? err.message : "Couldn't reach Bitget. Try again in a minute.";
    return Response.json({ error: message }, { status: err instanceof BitgetAuthError ? 400 : 502, headers: { "Cache-Control": "no-store" } });
  }
}
