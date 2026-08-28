import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { sign } from "@/lib/session";
import { verifyKey } from "@/lib/apikey";

/**
 * The AURN MCP server — a Model Context Protocol endpoint so any AI client
 * (Claude, Cursor, …) can discover, quote, launch and trade coins on aurn.fun.
 *
 * Transport: stateless Streamable HTTP. Clients POST JSON-RPC 2.0; we answer with
 * a single JSON response (no SSE session needed for a request/response server).
 *
 * ── Auth & safety ────────────────────────────────────────────────────────────
 * Read tools (list/get/quote/burned/leaderboard) are open — public on-chain data.
 * Spending tools (wallet/trade/launch_coin) require BOTH:
 *   • a valid AURN API key in `Authorization: Bearer …` (minted in Settings while
 *     signed in; it maps to the caller's custodial wallet), and
 *   • AURN_MCP_WRITE=on — an operator master switch, OFF by default.
 * A spending tool authenticates via the key, then reuses the app's own tested
 * launch/trade endpoints by minting a short-lived session for that user — so all
 * the existing guards (re-quote, slippage floor, dry-run) still apply.
 */

const NAME = "AURN";
const VERSION = "1.0.0";

function writeEnabled() {
  return String(process.env.AURN_MCP_WRITE || "").trim().toLowerCase() === "on";
}

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

/** Mint a short-lived session cookie for a key's owner, to call the app's own
 *  authenticated endpoints server-to-server. */
function mintCookie(user) {
  const token = sign({ id: user.id, username: user.username, exp: Date.now() + 120_000 });
  return `pons_session=${token}`;
}

function randomSalt() {
  return "0x" + crypto.randomBytes(32).toString("hex");
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
    name: "wallet",
    description: "Your AURN custodial wallet address and balances. Requires your AURN API key.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "trade",
    description: "Buy or sell a coin from your AURN wallet. SPENDS REAL FUNDS. Requires your AURN API key and operator-enabled writes. Re-quoted and dry-run before sending.",
    inputSchema: {
      type: "object",
      properties: {
        token: { type: "string", description: "Token address to trade." },
        side: { type: "string", enum: ["buy", "sell"] },
        amount: { type: "string", description: "Input amount (ETH for buy, tokens for sell), e.g. \"0.05\"." },
        slippage: { type: "number", description: "Max slippage %, default 5." },
      },
      required: ["token", "side", "amount"],
    },
  },
  {
    name: "launch_coin",
    description: "Launch a new coin on aurn.fun. SPENDS REAL FUNDS (launch fee + optional first buy). Requires your AURN API key and operator-enabled writes.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Coin name." },
        symbol: { type: "string", description: "Ticker, e.g. MOON." },
        description: { type: "string", description: "Optional short description." },
        imageUrl: { type: "string", description: "Optional logo image URL." },
        firstBuyEth: { type: "string", description: "Optional ETH amount to buy of your own coin at launch, e.g. \"0.01\"." },
      },
      required: ["name", "symbol"],
    },
  },
];

/* ── Tool dispatch ─────────────────────────────────────────────────────────── */
async function callTool(params, ctx) {
  const name = params?.name;
  const args = params?.arguments || {};
  const origin = ctx.origin;
  const net = "robinhood";

  // Auth gate for spending tools.
  const needsKey = ["wallet", "trade", "launch_coin"].includes(name);
  const needsWrite = ["trade", "launch_coin"].includes(name);
  let user = null;
  if (needsKey) {
    user = ctx.key ? verifyKey(ctx.key) : null;
    if (!user) return asErr("This tool needs your AURN API key. Generate one in Settings → AI access on aurn.fun and send it as `Authorization: Bearer aurn_mcp_…`.");
  }
  if (needsWrite && !writeEnabled()) {
    return asErr("Trading and launching over MCP are disabled by the operator. They stay off until AURN_MCP_WRITE=on is set on the deployment (test with tiny amounts first).");
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
      case "wallet": {
        const cookie = mintCookie(user);
        const w = await getJson(`${origin}/api/wallet?network=${net}`, cookie);
        if (w.error) return asErr(w.error);
        return asText({ address: w.address || null, eth: w?.balance?.formatted ?? null, tokens: w.tokens || w.holdings || [] });
      }
      case "trade": {
        const q = await postJson(`${origin}/api/quote`, { token: args.token, side: args.side, amount: args.amount, network: net });
        if (q.error || !q.amountInRaw) return asErr(`Couldn't quote the trade: ${q.error || "no route"}`);
        const cookie = mintCookie(user);
        const ex = await postJson(`${origin}/api/terminal/execute`, {
          token: args.token, side: args.side, amountInRaw: q.amountInRaw, expectedOutRaw: q.amountOutRaw,
          slippage: Number(args.slippage) || 5, network: net,
        }, cookie);
        if (ex.error) return asErr(`${ex.error}${ex.hint ? " — " + ex.hint : ""}`);
        return asText({ ok: true, side: args.side, token: args.token, spent: q.amountInLabel, received: q.amountOutLabel, hash: ex.hash, explorer: ex.explorer });
      }
      case "launch_coin": {
        if (!args.name || !args.symbol) return asErr("Provide at least `name` and `symbol`.");
        const meta = await getJson(`${origin}/api/factory?network=${net}`);
        if (meta.error || !meta.chosen) return asErr(`Couldn't read the launch factory: ${meta.error || "no launch function found"}`);
        const fields = meta.chosen.fields || [];
        const values = {};
        let feePath = null;
        for (const f of fields) {
          const key = Array.isArray(f.path) ? f.path.join(".") : (f.name || "");
          const n = f.name || "";
          if (/^(name|tokenname)$/i.test(n)) values[key] = args.name;
          else if (/^(symbol|ticker)$/i.test(n)) values[key] = args.symbol;
          else if (/(logo|image|icon|avatar|uri)/i.test(n)) { if (args.imageUrl) values[key] = args.imageUrl; }
          else if (/(description|desc|bio)/i.test(n)) { if (args.description) values[key] = args.description; }
          else if (/(feewallet|feerecipient|feeto|payout|creator)/i.test(n)) { feePath = feePath || key; /* execute forces this to the owner */ }
          else if (/(initialbuy|devbuy|firstbuy|buyamount)/i.test(n)) { values[key] = String(args.firstBuyEth ?? 0); values[`${key}__isEth`] = true; }
          else if (/^salt$/i.test(n)) values[key] = randomSalt();
        }
        const cookie = mintCookie(user);
        const ex = await postJson(`${origin}/api/launch/execute`, {
          fnName: meta.chosen.name, fnInputs: meta.chosen.inputs, values, feePath,
          buyEth: Number(args.firstBuyEth || 0), network: net,
        }, cookie);
        if (ex.error) return asErr(`${ex.error}${ex.hint ? " — " + ex.hint : ""}`);
        return asText({ ok: true, name: args.name, symbol: args.symbol, token: ex.token || ex.address || null, hash: ex.hash, explorer: ex.explorer });
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
      instructions: "AURN MCP — discover, quote, launch and trade coins on aurn.fun (Robinhood Chain). Spending tools need an AURN API key.",
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
