import { NextResponse } from "next/server";
import { JsonRpcProvider, getAddress } from "ethers";
import { getChain, getEthUsd, enrichLaunch, listLaunched } from "@/lib/engine";
import { topTraders, topReferrers } from "@/lib/stats";

/**
 * GET /api/leaderboard?network=robinhood&board=creator|volume|referral
 *
 * All three boards are built from real, ESKA-native activity — nothing invented:
 *  • creator  — every coin launched through ESKA is priced live and grouped by
 *               the X account that launched it, ranked by total market cap.
 *  • volume   — cumulative WETH-denominated trade size per trader, recorded at
 *               the trade endpoint as swaps settle.
 *  • referral — sign-ins through a ?ref= link, credited to the referrer once per
 *               new account.
 * A board simply stays empty (the UI shows "warming up") until it has data.
 */

const CACHE = new Map();
const TTL = 120_000;

async function fetchJson(url, timeoutMs = 6000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { headers: { accept: "application/json" }, cache: "no-store", signal: controller.signal });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** The explorer's market cap for a token, used when the on-chain read gave none. */
async function explorerMcap(explorer, token) {
  const j = await fetchJson(`${explorer.replace(/\/+$/, "")}/api/v2/tokens/${token}`);
  if (!j) return 0;
  const em = Number(j.circulating_market_cap ?? j.market_cap);
  return Number.isFinite(em) && em > 0 ? em : 0;
}

async function creatorBoard(chain, network) {
  const registry = await listLaunched({ limit: 200 }).catch(() => ({ entries: [] }));
  const entries = registry.entries || [];
  if (entries.length === 0) return { rows: [], coins: 0, creators: 0 };

  const provider = new JsonRpcProvider(chain.rpc, chain.chainId);
  const rate = await getEthUsd().catch(() => null);

  // Price each launched-here coin (bounded concurrency, time-boxed) and read its
  // USD market cap — on-chain first, explorer as the fallback.
  const start = Date.now();
  const priced = [];
  const CONC = 4;
  for (let i = 0; i < entries.length; i += CONC) {
    if (Date.now() - start > 6000) break;
    const batch = entries.slice(i, i + CONC);
    const rows = await Promise.all(
      batch.map(async (e) => {
        let token;
        try { token = getAddress(e.token); } catch { return null; }
        const l = await enrichLaunch(provider, chain, { token }).catch(() => null);
        let usd = Number.isFinite(l?.marketCapWeth) && rate?.usd ? l.marketCapWeth * rate.usd : 0;
        if (!(usd > 0)) usd = await explorerMcap(chain.explorer, token).catch(() => 0);
        return {
          token,
          symbol: l?.symbol || e.symbol || null,
          name: l?.name || e.name || null,
          mcapUsd: usd > 0 ? usd : 0,
          handle: e.xUsername || e.x || null,
          deployer: e.deployer || l?.deployer || null,
          official: Boolean(e.official),
        };
      })
    );
    for (const r of rows) if (r) priced.push(r);
  }

  // Group by creator: the X handle when we know it, else the deployer wallet.
  const byCreator = new Map();
  for (const c of priced) {
    const key = (c.handle ? `@${c.handle.toLowerCase()}` : (c.deployer || "").toLowerCase()) || c.token.toLowerCase();
    const cur = byCreator.get(key) || {
      handle: c.handle || null,
      deployer: c.deployer || null,
      official: false,
      coins: 0,
      mcapUsd: 0,
      top: null,
    };
    cur.coins += 1;
    cur.mcapUsd += c.mcapUsd;
    cur.official = cur.official || c.official;
    if (!cur.top || c.mcapUsd > cur.top.mcapUsd) cur.top = { symbol: c.symbol, token: c.token, mcapUsd: c.mcapUsd };
    byCreator.set(key, cur);
  }

  const rows = [...byCreator.values()]
    .sort((a, b) => (Number(b.official) - Number(a.official)) || (b.mcapUsd - a.mcapUsd))
    .slice(0, 25)
    .map((r, i) => ({
      rank: i + 1,
      handle: r.handle,
      deployer: r.deployer,
      official: r.official,
      coins: r.coins,
      mcapUsd: Math.round(r.mcapUsd),
      topSymbol: r.top?.symbol || null,
    }));

  return { rows, coins: priced.length, creators: rows.length };
}

export async function GET(request) {
  const url = new URL(request.url);
  const network = url.searchParams.get("network") || "robinhood";
  const board = url.searchParams.get("board") || "creator";

  let chain;
  try {
    chain = getChain(network);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  // Whether durable storage is connected. When false, every board relies on an
  // in-memory fallback that resets on each serverless cold start — so the boards
  // look permanently empty. Surfaced so the UI can say "storage not connected"
  // instead of the misleading "warming up".
  const kv = Boolean(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);

  const key = `${network}:${board}`;
  const cached = CACHE.get(key);
  if (cached && Date.now() - cached.at < TTL && !url.searchParams.has("fresh")) {
    return NextResponse.json(cached.value);
  }

  try {
    let value;
    if (board === "volume") {
      const rate = await getEthUsd().catch(() => null);
      const raw = await topTraders({ network, limit: 25 });
      const rows = raw.map((r, i) => ({
        rank: i + 1,
        handle: r.handle,
        volumeWeth: r.volumeWeth,
        volumeUsd: rate?.usd ? Math.round(r.volumeWeth * rate.usd) : null,
      }));
      value = { board, rows, network, kv };
    } else if (board === "referral") {
      const raw = await topReferrers({ limit: 25 });
      const rows = raw.map((r, i) => ({ rank: i + 1, code: r.code, count: r.count }));
      value = { board, rows, network, kv };
    } else {
      const { rows, coins, creators } = await creatorBoard(chain, network);
      value = { board, rows, coins, creators, network, kv };
    }
    if (value.rows.length) CACHE.set(key, { at: Date.now(), value });
    return NextResponse.json(value);
  } catch (error) {
    return NextResponse.json({ board, rows: [], kv, error: error.message || "Could not build the leaderboard." }, { status: 200 });
  }
}
