import { NextResponse } from "next/server";
import { verifyKey } from "@/lib/apikey";

/**
 * The AURN MCP server - a Model Context Protocol endpoint so any AI client
 * (Claude, Cursor, …) can discover coins, get quotes, and read a portfolio on
 * aurn.fun.
 *
 * Transport: stateless Streamable HTTP. Clients POST JSON-RPC 2.0; we answer with
 * a single JSON response (no SSE session needed for a request/response server).
 *
 * ── Auth & safety ────────────────────────────────────────────────────────────
 * AURN is non-custodial, so the MCP server never touches funds or keys. Read
 * tools (list/get/quote/burned/leaderboard) are open (public on-chain data). The
 * `portfolio` tool needs a valid AURN API key in `Authorization: Bearer …`
 * (minted in Settings → AI access for a connected wallet); the key carries only
 * that wallet address and grants read access to its public balances.
 *
 * The write-shaped tools (`prepare_trade`, `prepare_launch`) don't move anything
 * either: they build the exact trade/launch and return a one-tap aurn.fun link
 * that opens the app pre-filled, where the owner signs in their OWN wallet. This
 * is how "launch & trade from your AI assistant" works while staying fully
 * non-custodial - the server prepares, the user's wallet signs.
 */

const NAME = "AURN";
const VERSION = "1.0.0";

/* ── JSON-RPC helpers ──────────────────────────────────────────────────────── */
const rpcResult = (id, result) => ({ jsonrpc: "2.0", id, result });
const rpcError = (id, code, message) => ({ jsonrpc: "2.0", id, error: { code, message } });
const asText = (x) => ({ content: [{ type: "text", text: typeof x === "string" ? x : JSON.stringify(x, null, 2) }] });
const asErr = (msg) => ({ content: [{ type: "text", text: msg }], isError: true });

async function getJson(url, cookie) {
  const r = await fetch(url, { cache: "no-store", headers: cookie ? { cookie } : {} });
  return r.json().catch(() => ({ error: `HTTP ${r.status}` }));
}
async function postJson(url, body, cookie) {
  const headers = { "Content-Type": "application/json" };
  if (cookie) headers.cookie = cookie;
  const r = await fetch(url, { method: "POST", cache: "no-store", headers, body: JSON.stringify(body) });
  return r.json().catch(() => ({ error: `HTTP ${r.status}` }));
}

/* ── Tool catalogue ────────────────────────────────────────────────────────── */
const TOOLS = [
  {
    name: "list_coins",
    description: "List the coins on AURN (launched through aurn.fun), with live market cap, price and 24h change. Public data, no key needed.",
    inputSchema: { type: "object", properties: { limit: { type: "number", description: "Max coins (1-24), default 20." } } },
  },
  {
    name: "get_coin",
    description: "Get details for one coin by its token address: name, ticker, market cap, price, 24h change, holders, graduation. Public.",
    inputSchema: { type: "object", properties: { token: { type: "string", description: "The coin's token contract address (0x…)." } }, required: ["token"] },
  },
  {
    name: "quote_trade",
    description: "Price a buy or sell WITHOUT executing it. Returns how much you'd spend and receive. Public, no key needed.",
    inputSchema: {
      type: "object",
      properties: {
        token: { type: "string", description: "Token address to trade." },
        side: { type: "string", enum: ["buy", "sell"], description: "buy spends ETH; sell spends the token." },
        amount: { type: "string", description: "Amount of the input asset (ETH for buy, tokens for sell), e.g. \"0.1\"." },
      },
      required: ["token", "side", "amount"],
    },
  },
  {
    name: "aurn_burned",
    description: "The live total of $AURN bought back and burned on-chain (deflationary). Public.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "leaderboard",
    description: "AURN leaderboards. board=creator (market cap created), volume (WETH traded), or referral (friends invited). Public.",
    inputSchema: { type: "object", properties: { board: { type: "string", enum: ["creator", "volume", "referral"] } } },
  },
  {
    name: "portfolio",
    description: "Read-only: your connected wallet's address, ETH balance, and (optionally) one token's balance. Requires your AURN API key. Public on-chain data - it can't move funds.",
    inputSchema: { type: "object", properties: { token: { type: "string", description: "Optional token address to also read your balance of (0x…)." } } },
  },
  {
    name: "prepare_trade",
    description: "Prepare a buy or sell and return a one-tap link that opens aurn.fun with the swap pre-filled, for the user to sign in their OWN wallet (non-custodial - AURN never holds funds or keys). Also returns a live price quote. Hand the returned `link` to the user to execute the trade.",
    inputSchema: {
      type: "object",
      properties: {
        token: { type: "string", description: "Token address to trade (0x…)." },
        side: { type: "string", enum: ["buy", "sell"], description: "buy spends ETH; sell spends the token." },
        amount: { type: "string", description: "Amount of the input asset (ETH for buy, tokens for sell), e.g. \"0.1\"." },
      },
      required: ["token", "side", "amount"],
    },
  },
  {
    name: "prepare_launch",
    description: "Prepare a new coin launch on AURN and return a one-tap link that opens the launch flow on aurn.fun pre-filled and ready to review + sign in the user's OWN wallet (non-custodial). Supply as much as you like; only `name` is required. Hand the returned `link` to the user to deploy.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Coin / agent name (required), up to 24 chars." },
        ticker: { type: "string", description: "Ticker symbol, up to 6 letters/digits. Defaults to the name if omitted." },
        description: { type: "string", description: "Short description of the coin, up to 500 chars." },
        version: { type: "string", enum: ["v1", "v2"], description: "v1 = instant Uniswap V3 pool; v2 = bonding curve that graduates to V4. Default v1." },
        style: { type: "string", description: "Art style for the AI-generated logo, e.g. anime, pixel, cyberpunk, realistic, ghibli, mascot." },
        look: { type: "string", description: "Free-text description of how the coin should look (feeds logo generation)." },
        firstBuy: { type: "string", description: "Optional first buy in ETH, e.g. \"0.05\"." },
        creatorTax: { type: "string", description: "v2 only: creator's cut of the 1% trading fee, 0-10 (percent)." },
        twitter: { type: "string", description: "Optional X/Twitter handle or link." },
        telegram: { type: "string", description: "Optional Telegram handle or link." },
      },
      required: ["name"],
    },
  },
];

/* ── Tool dispatch ─────────────────────────────────────────────────────────── */
async function callTool(params, ctx) {
  const name = params?.name;
  const args = params?.arguments || {};
  const origin = ctx.origin;
  const net = "robinhood";

  // The one tool that needs a key: read-only portfolio, scoped to the wallet the
  // key was minted for. Everything else is public on-chain data.
  const needsKey = name === "portfolio";
  let user = null;
  if (needsKey) {
    user = ctx.key ? verifyKey(ctx.key) : null;
    if (!user) return asErr("This tool needs your AURN API key. Generate one in Settings → AI access on aurn.fun and send it as `Authorization: Bearer aurn_mcp_…`.");
  }

  try {
    switch (name) {
      case "list_coins": {
        const limit = Math.min(Math.max(Number(args.limit) || 20, 1), 24);
        const j = await getJson(`${origin}/api/launches?network=${net}&limit=${limit}`);
        const coins = (j.launches || []).map((l) => ({
          token: l.token, symbol: l.symbol, name: l.name,
          marketCapUsd: l.marketCapWeth && j.ethUsd ? Math.round(l.marketCapWeth * j.ethUsd) : (l.explorerMcapUsd || null),
          change24h: l.change24 ?? null, holders: l.holders ?? null, official: !!l.official,
        }));
        return asText({ count: coins.length, coins });
      }
      case "get_coin": {
        if (!args.token) return asErr("Provide a token address.");
        const j = await getJson(`${origin}/api/launches?network=${net}&limit=24`);
        const key = String(args.token).toLowerCase();
        const l = (j.launches || []).find((c) => String(c.token).toLowerCase() === key);
        if (!l) return asErr("That token isn't in the AURN feed. Only coins launched on aurn.fun are listed.");
        return asText({
          token: l.token, symbol: l.symbol, name: l.name,
          marketCapUsd: l.marketCapWeth && j.ethUsd ? Math.round(l.marketCapWeth * j.ethUsd) : (l.explorerMcapUsd || null),
          priceUsd: l.priceInWeth && j.ethUsd ? l.priceInWeth * j.ethUsd : (l.explorerPriceUsd || null),
          change24h: l.change24 ?? null, holders: l.holders ?? null,
          graduated: l.graduated ?? null, official: !!l.official, creator: l.xUsername ? "@" + l.xUsername : null,
        });
      }
      case "quote_trade": {
        const q = await postJson(`${origin}/api/quote`, { token: args.token, side: args.side, amount: args.amount, network: net });
        if (q.error) return asErr(`Couldn't quote: ${q.error}`);
        return asText({ side: args.side, spend: q.amountInLabel, receive: q.amountOutLabel, amountInRaw: q.amountInRaw, amountOutRaw: q.amountOutRaw });
      }
      case "aurn_burned": {
        const j = await getJson(`${origin}/api/aurn/burned?network=${net}`);
        if (j.error) return asErr(j.error);
        return asText({ symbol: j.symbol || "AURN", burned: j.burned });
      }
      case "leaderboard": {
        const board = ["creator", "volume", "referral"].includes(args.board) ? args.board : "creator";
        const j = await getJson(`${origin}/api/leaderboard?board=${board}&network=${net}`);
        return asText({ board, rows: j.rows || [] });
      }
      case "portfolio": {
        const q = args.token ? `&token=${encodeURIComponent(args.token)}` : "";
        const w = await getJson(`${origin}/api/wallet?network=${net}&address=${user.address}${q}`);
        if (w.error) return asErr(w.error);
        return asText({
          address: w.address || user.address,
          eth: w?.balance?.formatted ?? null,
          token: w.token || null,
          note: "Read-only. To trade or launch, sign in your own wallet on aurn.fun.",
        });
      }
      case "prepare_trade": {
        if (!/^0x[a-fA-F0-9]{40}$/.test(String(args.token || ""))) return asErr("Provide a valid token address (0x…).");
        const side = args.side === "sell" ? "sell" : "buy";
        const amount = String(args.amount || "").replace(/[^0-9.]/g, "");
        if (!amount || Number(amount) <= 0) return asErr("Provide a positive amount.");
        // Live quote for the human summary (non-fatal if the venue can't price yet).
        const q = await postJson(`${origin}/api/quote`, { token: args.token, side, amount, network: net });
        const link = `${origin}/c/${args.token}?action=trade&side=${side}&amount=${encodeURIComponent(amount)}`;
        return asText({
          action: `${side} ${side === "buy" ? "with " + amount + " ETH" : amount + " tokens"}`,
          token: args.token,
          quote: q.error ? { note: `Couldn't price yet: ${q.error}` } : { spend: q.amountInLabel, receive: q.amountOutLabel },
          link,
          note: "Open this link to review and sign in your own wallet. AURN is non-custodial - it cannot execute the trade for you.",
        });
      }
      case "prepare_launch": {
        const name = String(args.name || "").trim().slice(0, 24);
        if (!name) return asErr("A coin name is required.");
        const p = new URLSearchParams();
        p.set("name", name);
        if (args.ticker) p.set("ticker", String(args.ticker).toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6));
        if (args.description) p.set("description", String(args.description).slice(0, 500));
        if (args.version === "v2" || args.version === "v1") p.set("version", args.version);
        if (args.style) p.set("style", String(args.style).toLowerCase());
        if (args.look) p.set("look", String(args.look).slice(0, 240));
        if (args.firstBuy) p.set("firstBuy", String(args.firstBuy).replace(/[^0-9.]/g, ""));
        if (args.creatorTax) p.set("creatorTax", String(args.creatorTax).replace(/[^0-9.]/g, ""));
        if (args.twitter) p.set("twitter", String(args.twitter));
        if (args.telegram) p.set("telegram", String(args.telegram));
        p.set("to", "review");
        const link = `${origin}/launch?${p.toString()}`;
        return asText({
          launch: {
            name,
            ticker: p.get("ticker") || name.replace(/[^A-Za-z0-9]/g, "").slice(0, 5).toUpperCase(),
            version: p.get("version") || "v1",
            style: p.get("style") || null,
          },
          link,
          note: "Open this link to review and sign the launch in your own wallet. Supply is fixed at 1,000,000,000. AURN is non-custodial - it cannot deploy for you.",
        });
      }
      default:
        return asErr(`Unknown tool: ${name}`);
    }
  } catch (error) {
    return asErr(`Tool failed: ${error?.message || "unexpected error"}`);
  }
}

/* ── JSON-RPC transport ────────────────────────────────────────────────────── */
async function handleMessage(m, ctx) {
  const { id = null, method, params } = m || {};
  if (method === "initialize") {
    return rpcResult(id, {
      protocolVersion: params?.protocolVersion || "2025-06-18",
      capabilities: { tools: {} },
      serverInfo: { name: NAME, version: VERSION },
      instructions: "AURN MCP - discover coins, quote trades, read a portfolio, and prepare trades & launches on aurn.fun (Robinhood Chain). `prepare_trade` and `prepare_launch` return a one-tap link the user opens to sign in their OWN wallet - AURN is non-custodial, so the server prepares but never signs or moves funds. Give the user the returned `link` to finish. The `portfolio` tool needs an AURN API key (Settings → AI access).",
    });
  }
  if (typeof method === "string" && method.startsWith("notifications/")) return null; // no response
  if (method === "ping") return rpcResult(id, {});
  if (method === "tools/list") return rpcResult(id, { tools: TOOLS });
  if (method === "tools/call") return rpcResult(id, await callTool(params, ctx));
  return rpcError(id, -32601, `Method not found: ${method}`);
}

function cors(res) {
  res.headers.set("Access-Control-Allow-Origin", "*");
  res.headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization, Mcp-Session-Id, Mcp-Protocol-Version");
  return res;
}

export function OPTIONS() {
  return cors(new NextResponse(null, { status: 204 }));
}

export function GET() {
  // A friendly probe for humans; MCP clients use POST.
  return cors(NextResponse.json({ name: NAME, version: VERSION, transport: "streamable-http", tools: TOOLS.map((t) => t.name) }));
}

export async function POST(request) {
  const origin = new URL(request.url).origin;
  const authz = request.headers.get("authorization") || "";
  const key = /^bearer\s+/i.test(authz) ? authz.replace(/^bearer\s+/i, "").trim() : null;
  const ctx = { origin, key };

  let payload;
  try {
    payload = await request.json();
  } catch {
    return cors(NextResponse.json(rpcError(null, -32700, "Parse error")));
  }

  if (Array.isArray(payload)) {
    const out = [];
    for (const m of payload) {
      const r = await handleMessage(m, ctx);
      if (r) out.push(r);
    }
    return cors(out.length ? NextResponse.json(out) : new NextResponse(null, { status: 202 }));
  }

  const r = await handleMessage(payload, ctx);
  if (!r) return cors(new NextResponse(null, { status: 202 })); // a notification
  return cors(NextResponse.json(r));
}
