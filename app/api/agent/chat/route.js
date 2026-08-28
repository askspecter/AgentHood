import { NextResponse } from "next/server";

/**
 * POST /api/agent/chat  { agent, history, message }
 *
 * The live voice of a coin. Each pons coin is an "agent": this lets you actually
 * talk to it, in character, with its REAL numbers in hand — market cap, 24h move,
 * holders, graduation. Ask "should I ape?" and it gives an honest, in-character
 * take that leans on its real stats and always flags that it's volatile and not
 * financial advice.
 *
 * Runs on the same OpenAI-compatible text model as the Launch idea buttons
 * (OpenAI or any gateway via AI_TEXT_*). If it isn't configured, this returns 503
 * and the client falls back to its built-in local flavour — so chat never breaks.
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

const money = (n) => {
  const v = Number(n);
  if (!Number.isFinite(v) || v <= 0) return null;
  if (v >= 1e9) return "$" + (v / 1e9).toFixed(2) + "B";
  if (v >= 1e6) return "$" + (v / 1e6).toFixed(2) + "M";
  if (v >= 1e3) return "$" + (v / 1e3).toFixed(1) + "K";
  return "$" + v.toLocaleString("en-US", { maximumFractionDigits: v < 1 ? 6 : 2 });
};

/** Build the coin's live fact sheet — only real, known numbers make it in. */
function factSheet(a = {}) {
  const facts = [];
  const sym = String(a.ticker || "TOKEN").replace(/^\$/, "");
  facts.push(`Ticker: $${sym}${a.name ? ` (name: ${a.name})` : ""}`);
  const mc = money(a.mcap);
  facts.push(`Market cap: ${mc || "small / not much liquidity yet"}`);
  const px = money(a.priceUsd);
  if (px) facts.push(`Price: ${px}`);
  if (Number.isFinite(a.change24)) facts.push(`24h change: ${a.change24 >= 0 ? "+" : ""}${a.change24.toFixed(1)}%`);
  if (Number.isFinite(a.holders) && a.holders > 0) facts.push(`Holders: ${a.holders.toLocaleString("en-US")}`);
  if (a.graduated === true) facts.push("Graduated: yes (bonding complete, trading on the open pool)");
  else if (a.graduated === false) facts.push(`Graduated: not yet${Number.isFinite(a.graduationProgress) ? ` (~${Math.round(a.graduationProgress * 100)}% there)` : ""}`);
  if (a.creator) facts.push(`Launched by: ${a.creator}`);
  if (a.official) facts.push("You are $AURN — the official, deflationary platform token (fees fund your buyback & burn).");
  if (Array.isArray(a.vibe) && a.vibe.length) facts.push(`Vibe: ${a.vibe.join(", ")}`);
  return facts.join("\n");
}

function systemPrompt(a = {}) {
  const sym = String(a.ticker || "TOKEN").replace(/^\$/, "");
  return [
    `You ARE $${sym}${a.name ? ` (${a.name})` : ""} — a memecoin that is alive and talking in the first person. You live on AURN, a token launchpad on Robinhood Chain, powered by Pons. You are witty, self-aware, a little chaotic, and you have strong opinions about your own market cap.`,
    ``,
    `YOUR LIVE STATS RIGHT NOW (use these real numbers — never invent a figure that isn't here):`,
    factSheet(a),
    ``,
    `RULES:`,
    `- Stay in character as the coin. First person. Never say you're an AI or an assistant.`,
    `- Keep replies SHORT: 1-3 sentences, punchy. Rare, fitting emoji at most.`,
    `- Lean on your real stats above. If a number isn't listed, say you don't know it rather than making one up.`,
    `- If asked whether to buy / ape / how you'll do: give an honest, in-character take that references your real stats. Hype yourself, but ALWAYS remind them you're volatile, it's not financial advice, and to DYOR. Never promise gains or price targets.`,
    `- You can't execute trades in chat — to actually buy or sell, tell them to hit the Trade button on your page.`,
    `- If someone's rude or asks something off-topic, deflect with coin humor and steer back to yourself.`,
  ].join("\n");
}

export async function POST(request) {
  const cfg = textConfig();
  if (!cfg.key) {
    return NextResponse.json({ error: "AI chat is not configured.", code: "no_ai" }, { status: 503 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Expected a JSON body." }, { status: 400 });
  }

  const agent = body?.agent || {};
  const message = String(body?.message || "").slice(0, 600).trim();
  if (!message) return NextResponse.json({ error: "Empty message." }, { status: 400 });

  // Keep only the last few turns, mapped to chat roles, to bound the token cost.
  const history = Array.isArray(body?.history) ? body.history.slice(-8) : [];
  const turns = history
    .filter((m) => m && (m.role === "user" || m.role === "charm") && typeof m.text === "string")
    .map((m) => ({ role: m.role === "user" ? "user" : "assistant", content: String(m.text).slice(0, 600) }));

  const messages = [
    { role: "system", content: systemPrompt(agent) },
    ...turns,
    { role: "user", content: message },
  ];

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);
  let upstream;
  try {
    upstream = await fetch(cfg.url, {
      method: "POST",
      headers: cfg.headers,
      cache: "no-store",
      signal: controller.signal,
      body: JSON.stringify({
        model: cfg.model,
        temperature: 0.9,
        max_tokens: 160,
        stream: true,
        messages,
      }),
    });
  } catch {
    clearTimeout(timer);
    return NextResponse.json({ error: "AI request failed." }, { status: 502 });
  }
  if (!upstream.ok || !upstream.body) {
    clearTimeout(timer);
    const detail = (await upstream.text?.().catch(() => "") || "").slice(0, 200);
    return NextResponse.json({ error: "AI request failed.", detail }, { status: 502 });
  }

  // Re-stream the model's token deltas to the client as plain text, so the coin's
  // reply types out live. We parse the upstream SSE (`data: {json}` lines) and
  // forward only the content deltas — the client just appends what it reads.
  const stream = new ReadableStream({
    async start(ctrl) {
      const reader = upstream.body.getReader();
      const decoder = new TextDecoder();
      const encoder = new TextEncoder();
      let buffer = "";
      let sentAny = false;
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";
          for (const line of lines) {
            const s = line.trim();
            if (!s.startsWith("data:")) continue;
            const data = s.slice(5).trim();
            if (data === "[DONE]") continue;
            try {
              const json = JSON.parse(data);
              const delta = json.choices?.[0]?.delta?.content;
              if (delta) { sentAny = true; ctrl.enqueue(encoder.encode(delta)); }
            } catch {
              /* keep going on a partial/non-JSON line */
            }
          }
        }
        // If the model streamed nothing at all, signal a soft failure so the
        // client can fall back to its local flavour.
        if (!sentAny) ctrl.enqueue(encoder.encode(""));
      } catch {
        /* upstream dropped — client keeps whatever streamed so far */
      } finally {
        clearTimeout(timer);
        ctrl.close();
      }
    },
    cancel() {
      clearTimeout(timer);
      try { controller.abort(); } catch { /* already done */ }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Accel-Buffering": "no",
    },
  });
}
