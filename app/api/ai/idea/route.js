import { NextResponse } from "next/server";

/**
 * POST /api/ai/idea  { kind, context }
 *
 * Text suggestions for the Launch flow's Idea / more buttons, via OpenAI
 * gpt-4o-mini. The API key stays on the server. Each `kind` shapes the prompt:
 *   - name        → 2 cool two-word names (JSON array)
 *   - look        → one image-prompt sentence for the coin's appearance
 *   - personality → 4 short trait phrases (JSON array)
 *   - tagline     → a one-line hook
 *   - description → a 2–3 sentence page description built from the agent's soul
 *
 * If OPENAI_API_KEY isn't set, this returns 503 and the client falls back to its
 * built-in suggestions, so the buttons always work.
 */

/**
 * Text model config. Works with OpenAI directly or any OpenAI-compatible gateway.
 * Switch entirely via env:
 *   AI_TEXT_BASE_URL   base, default https://api.openai.com/v1
 *   AI_TEXT_API_KEY    the key (falls back to OPENAI_API_KEY)
 *   AI_TEXT_MODEL      model id, default gpt-4o-mini
 * Auth header is chosen automatically: gateway keys (bk_…) use X-API-Key, OpenAI
 * uses Authorization: Bearer. Force it with AI_TEXT_AUTH=x-api-key|bearer.
 */
function textConfig() {
  const key = process.env.AI_TEXT_API_KEY || process.env.OPENAI_API_KEY || "";
  const base = (process.env.AI_TEXT_BASE_URL || "https://api.openai.com/v1").replace(/\/+$/, "");
  const model = process.env.AI_TEXT_MODEL || "gpt-4o-mini";
  const headers = { "Content-Type": "application/json" };
  const style = process.env.AI_TEXT_AUTH || (/^bk_/.test(key) ? "x-api-key" : "bearer");
  if (style === "x-api-key") headers["X-API-Key"] = key;
  else headers["Authorization"] = `Bearer ${key}`;
  return { key, url: `${base}/chat/completions`, model, headers };
}

const SPECS = {
  name: (c) => ({
    system:
      "You invent original names for a crypto coin that is also a character. The name must feel brand-new and coined — NOT an existing brand, company, person, place, ticker, or a common dictionary phrase. Cool, punchy, easy to say. Randomly either a single invented word (e.g. 'Zynth', 'Novaeth', 'Kryll', 'Obsyd') or two words (e.g. 'Neon Vane', 'Iron Halo', 'Velvet Dusk'). Vary the length and the vibe each time. Return ONLY the name — no quotes, no ticker, no explanation.",
    user: `Invent one original, never-before-used coin-character name${c.hint ? ` with a ${c.hint} feel` : ""}.`,
    max_tokens: 16,
  }),
  look: (c) => ({
    system:
      "You write a single vivid image-generation prompt for a coin's avatar/logo: colors, symbol, mood and details in one sentence. No preamble, no quotes, no lists.",
    user: `Describe the look of a coin-character${c.name ? ` called ${c.name}` : ""}${c.style ? ` in a ${c.style} style` : ""}. One sentence.`,
    max_tokens: 80,
  }),
  personality: (c) => ({
    system:
      "You write personality traits for a coin-character. Return ONLY a JSON array of 4 short trait phrases, each at most 8 words, punchy and specific. No numbering.",
    user: `4 personality traits${c.name ? ` for ${c.name}` : ""}${c.vibe ? ` (vibe: ${c.vibe})` : ""}.`,
    max_tokens: 120,
    list: true,
  }),
  tagline: (c) => ({
    system:
      "You write a one-line hook (tagline) for a coin-character. Punchy, memorable, under 80 characters. No quotes, no hashtags.",
    user: `A one-line tagline${c.name ? ` for ${c.name}` : ""}${c.vibe ? ` (vibe: ${c.vibe})` : ""}.`,
    max_tokens: 40,
  }),
  description: (c) => ({
    system:
      "You write the public description shown on a coin-character's page. Two or three short sentences, at most ~60 words, that capture who this character is and its vibe. Warm and vivid, written for people browsing coins. No quotes, no hashtags, no markdown, no emoji.",
    user:
      `Write the page description for a coin-character` +
      `${c.name ? ` called ${c.name}` : ""}${c.ticker ? ` ($${c.ticker})` : ""}.` +
      `${c.tagline ? ` Tagline: ${c.tagline}.` : ""}` +
      `${c.vibe ? ` Vibe: ${c.vibe}.` : ""}` +
      `${c.personality ? ` Personality: ${c.personality}.` : ""}` +
      `${c.lore ? ` Details: ${c.lore}.` : ""}` +
      `${c.look ? ` Looks like: ${c.look}.` : ""}`,
    max_tokens: 120,
  }),
};

function stripQuotes(s) {
  return String(s || "").trim().replace(/^["'“”]+|["'“”]+$/g, "").trim();
}

/** Parse a model reply into a clean array of strings, tolerating non-JSON. */
function parseList(text) {
  const t = String(text || "").trim();
  try {
    const arr = JSON.parse(t);
    if (Array.isArray(arr)) return arr.map(stripQuotes).filter(Boolean);
  } catch {
    /* not JSON — fall through to line/comma splitting */
  }
  return t
    .replace(/^\s*[\[\]]\s*$/gm, "")
    .split(/\n|,(?![^(]*\))/)
    .map((l) => stripQuotes(l.replace(/^\s*(?:\d+[.)]|[-*•])\s*/, "")))
    .filter(Boolean);
}

export async function POST(request) {
  const cfg = textConfig();
  if (!cfg.key) {
    return NextResponse.json({ error: "AI text is not configured.", code: "no_openai" }, { status: 503 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Expected a JSON body." }, { status: 400 });
  }

  const kind = body?.kind;
  const build = SPECS[kind];
  if (!build) return NextResponse.json({ error: "Unknown idea kind." }, { status: 400 });
  const spec = build(body.context || {});

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const res = await fetch(cfg.url, {
      method: "POST",
      headers: cfg.headers,
      cache: "no-store",
      signal: controller.signal,
      body: JSON.stringify({
        model: cfg.model,
        temperature: 1,
        max_tokens: spec.max_tokens,
        messages: [
          { role: "system", content: spec.system },
          { role: "user", content: spec.user },
        ],
      }),
    });
    if (!res.ok) {
      const detail = (await res.text().catch(() => "")).slice(0, 200);
      return NextResponse.json({ error: "AI request failed.", detail }, { status: 502 });
    }
    const json = await res.json();
    const text = json.choices?.[0]?.message?.content?.trim() || "";
    if (spec.list) {
      const items = parseList(text).slice(0, kind === "name" ? 2 : 4);
      return NextResponse.json({ kind, items });
    }
    return NextResponse.json({ kind, text: stripQuotes(text) });
  } catch {
    return NextResponse.json({ error: "AI request failed." }, { status: 502 });
  } finally {
    clearTimeout(timer);
  }
}
