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
 *
 * If OPENAI_API_KEY isn't set, this returns 503 and the client falls back to its
 * built-in suggestions, so the buttons always work.
 */

const OPENAI_URL = "https://api.openai.com/v1/chat/completions";

const SPECS = {
  name: (c) => ({
    system:
      "You name crypto coins that double as characters. Output cool, punchy, brandable TWO-WORD names like 'Velvet Kicks', 'Neon Oracle', 'Iron Halo', 'Static Bloom'. No profanity, no hashtags, no numbers, no explanations. Return ONLY a JSON array of exactly 2 names.",
    user: `Give 2 cool two-word names${c.hint ? ` themed around: ${c.hint}` : ""}.`,
    max_tokens: 40,
    list: true,
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
  const key = process.env.OPENAI_API_KEY;
  if (!key) {
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
    const res = await fetch(OPENAI_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      cache: "no-store",
      signal: controller.signal,
      body: JSON.stringify({
        model: "gpt-4o-mini",
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
