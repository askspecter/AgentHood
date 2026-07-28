import { NextResponse } from "next/server";
import { JsonRpcProvider, getAddress } from "ethers";
import { getChain, getEthUsd, enrichLaunch } from "@/lib/engine";

/**
 * Enrich token addresses with bounded concurrency.
 *
 * Reading 48 tokens in one Promise.all fires hundreds of eth_calls at once and
 * a shared RPC (Alchemy's free tier) rate-limits them all — every read fails and
 * nothing gets a name or price. Running a few at a time keeps every read under
 * the limit, so they actually return.
 */
async function enrichBounded(provider, chain, addresses, concurrency = 4) {
  const out = [];
  for (let i = 0; i < addresses.length; i += concurrency) {
    const batch = addresses.slice(i, i + concurrency);
    const results = await Promise.all(
      batch.map((token) => enrichLaunch(provider, chain, { token }).catch(() => null))
    );
    for (const r of results) if (r) out.push(r);
  }
  return out;
}

/** keccak256("TokenLaunched(...)") — the factory's launch event. */
const TOKEN_LAUNCHED_TOPIC =
  "0xdb51ea9ad51ab453a65a4cb7e60c3cb378c9501bb002609f8f97778fb6c4235a";

/**
 * Discover launch token addresses from the block explorer's own index.
 *
 * pons launches happened long before the current head, and the RPC times out on
 * the wide eth_getLogs range needed to reach them. Blockscout has already indexed
 * every log, so we page through the factory's TokenLaunched events (no block
 * limit), collect token addresses, and price them by direct contract reads.
 */
async function fetchJson(url, timeoutMs = 7000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { headers: { accept: "application/json" }, cache: "no-store", signal: controller.signal });
    if (!res.ok) return null;
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

async function discoverViaExplorer(explorer, factories, pages = 2) {
  const found = [];
  for (const factory of factories) {
    if (!factory) continue;
    const base = `${explorer.replace(/\/+$/, "")}/api/v2/addresses/${factory}/logs`;
    let params = null;
    for (let p = 0; p < pages; p++) {
      let json;
      try {
        const url = params ? `${base}?${new URLSearchParams(params)}` : base;
        json = await fetchJson(url);
      } catch {
        break;
      }
      if (!json) break;
      for (const log of json.items || []) {
        const topics = log.topics || [];
        if ((topics[0] || "").toLowerCase() !== TOKEN_LAUNCHED_TOPIC) continue;
        const t = topics[1];
        if (t) found.push({ token: "0x" + t.slice(-40), block: Number(log.block_number) || 0 });
      }
      params = json.next_page_params;
      if (!params) break;
    }
  }
  found.sort((a, b) => b.block - a.block); // newest first
  const seen = new Set();
  const addrs = [];
  for (const f of found) {
    const k = f.token.toLowerCase();
    if (!seen.has(k)) { seen.add(k); addrs.push(f.token); }
  }
  return addrs;
}

/**
 * The explorer's own top-tokens list (sorted by holders / market cap).
 *
 * The factory-log scan only reaches the newest launches, which on a spammy chain
 * are junk. Blockscout already ranks every ERC-20 by popularity, so this is how
 * the big graduated coins (PONS, YOLO, …) surface at all — we take the top
 * tokens, then keep only the ones that turn out to be real pons launches.
 */
async function discoverTopTokens(explorer, pages = 3) {
  const addrs = [];
  const base = `${explorer.replace(/\/+$/, "")}/api/v2/tokens?type=ERC-20`;
  let params = null;
  for (let p = 0; p < pages; p++) {
    let json;
    try {
      const url = params ? `${base}&${new URLSearchParams(params)}` : base;
      json = await fetchJson(url);
    } catch { break; }
    if (!json) break;
    for (const t of json.items || []) {
      const a = typeof t.address === "string" ? t.address : (t.address?.hash || t.address_hash);
      if (a) addrs.push(a);
    }
    params = json.next_page_params;
    if (!params) break;
  }
  return addrs;
}

function serialise(value) {
  return JSON.parse(
    JSON.stringify(value, (_key, v) => (typeof v === "bigint" ? v.toString() : v))
  );
}

/**
 * Cache the enriched feed per network. Enriching dozens of tokens is expensive,
 * so this keeps the front page fast between refreshes; a cold instance pays it
 * once. Lives on the module, so it survives across requests to a warm instance.
 */
const CACHE = new Map();
const CACHE_TTL_MS = Number(process.env.LAUNCH_CACHE_TTL_MS || 180_000);

/**
 * GET /api/launches?network=robinhood&limit=20
 *
 * The top launches by market cap, read straight off the pons contracts. Public
 * on-chain data — no sign-in.
 */
export async function GET(request) {
  const url = new URL(request.url);
  const network = url.searchParams.get("network") || "robinhood";
  const limit = Math.min(Number(url.searchParams.get("limit") || 20), 24);

  let chain;
  try {
    chain = getChain(network);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  const cached = CACHE.get(network);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
    return NextResponse.json({ ...cached.value, launches: cached.value.launches.slice(0, limit) });
  }

  try {
    const provider = new JsonRpcProvider(chain.rpc, chain.chainId);
    const pons = chain.pons || {};
    const factories = [pons.factory, pons.legacyFactory].filter(Boolean);

    const [topTokens, discovered, rate] = await Promise.all([
      discoverTopTokens(chain.explorer).catch(() => []),
      discoverViaExplorer(chain.explorer, factories).catch(() => []),
      getEthUsd(),
    ]);

    const seeds = [
      chain.reference?.token,
      process.env.OFFICIAL_TOKEN,
      ...(process.env.PONS_SEED_TOKENS || "").split(/[\s,]+/),
    ].filter(Boolean);

    // Enrich a bounded candidate set (newest + seeds), price each, and rank by
    // market cap so the feed shows the biggest pons coins — not just the newest.
    const cap = Number(process.env.PONS_ENRICH_CAP || 40);
    const seen = new Set();
    const candidates = [];
    // Seeds and top-tokens first (most likely to be the big coins), then the
    // newest launches.
    for (const a of [...seeds, ...topTokens, ...discovered]) {
      try {
        const addr = getAddress(a);
        const k = addr.toLowerCase();
        if (!seen.has(k)) { seen.add(k); candidates.push(addr); }
      } catch { /* skip a malformed address */ }
    }
    const picked = candidates.slice(0, cap);

    let launches = [];
    if (picked.length) {
      const enriched = await enrichBounded(provider, chain, picked, Number(process.env.PONS_ENRICH_CONCURRENCY || 4));
      launches = enriched
        // Real pons launches with an actual priced pool — this drops the spam
        // launches that have no liquidity (marketCapWeth null) and non-pons ERC-20s.
        .filter((l) => l.isPonsLaunch && Number.isFinite(l.marketCapWeth) && l.marketCapWeth > 0)
        .sort((a, b) => (b.marketCapWeth || 0) - (a.marketCapWeth || 0));
    }

    const value = serialise({
      launches,
      stats: { scanned: candidates.length, enriched: launches.length },
      network,
      explorer: chain.explorer,
      ethUsd: rate?.usd ?? null,
      ethUsdStale: rate?.stale ?? false,
    });

    // Cache the full ranked list; callers slice to their limit.
    if (launches.length) CACHE.set(network, { at: Date.now(), value });

    return NextResponse.json({ ...value, launches: value.launches.slice(0, limit) });
  } catch (error) {
    console.error("Launch feed failed:", error);
    const unreachable = /fetch|network|ECONN|timeout|ENOTFOUND/i.test(error.message || "");
    return NextResponse.json(
      {
        error: error.message || "Could not load launches.",
        hint: unreachable ? "The Robinhood Chain RPC is unreachable from this server. Check ROBINHOOD_RPC." : undefined,
      },
      { status: unreachable ? 502 : 500 }
    );
  }
}
