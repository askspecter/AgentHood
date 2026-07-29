import { NextResponse } from "next/server";
import { Contract, JsonRpcProvider, getAddress } from "ethers";
import { getChain, getEthUsd, enrichLaunch } from "@/lib/engine";

const POOL_SLOT0_ABI = [
  "function slot0() view returns (uint160 sqrtPriceX96, int24 tick, uint16 observationIndex, uint16 observationCardinality, uint16 observationCardinalityNext, uint8 feeProtocol, bool unlocked)",
];

/** Estimate the block number ~24h ago from the recent average block time. */
async function block24hAgo(provider) {
  const head = await provider.getBlockNumber();
  const back = Math.max(1, head - 5000);
  const [b0, b1] = await Promise.all([provider.getBlock(back), provider.getBlock(head)]);
  if (!b0 || !b1 || b1.timestamp <= b0.timestamp) return Math.max(1, head - 40000);
  const secPerBlock = (b1.timestamp - b0.timestamp) / (b1.number - b0.number);
  const blocksPerDay = Math.round(86400 / Math.max(0.05, secPerBlock));
  return Math.max(1, head - blocksPerDay);
}

/**
 * Real 24h price change, read from the pool's price at a block ~24h ago
 * (an archive call) versus now. pons keeps no price history on-chain, so this
 * is the honest way to get a +/- figure. Best-effort per token; if the archive
 * read is unavailable the coin simply has no 24h change rather than a fake 0%.
 */
async function attachChange24(provider, launches, concurrency = 5) {
  let past;
  try { past = await block24hAgo(provider); } catch { return; }
  for (let i = 0; i < launches.length; i += concurrency) {
    const batch = launches.slice(i, i + concurrency);
    await Promise.all(
      batch.map(async (l) => {
        try {
          if (!l.pool || l.isToken0 == null || !Number.isFinite(l.priceInWeth) || l.priceInWeth <= 0) return;
          const pool = new Contract(l.pool, POOL_SLOT0_ABI, provider);
          const s = await pool.slot0({ blockTag: past });
          const sqrt = Number(s.sqrtPriceX96 ?? s[0]);
          if (!sqrt) return;
          const ratio = (sqrt / 2 ** 96) ** 2;
          const price24 = l.isToken0 ? ratio : 1 / ratio;
          if (!Number.isFinite(price24) || price24 <= 0) return;
          l.change24 = (l.priceInWeth / price24 - 1) * 100;
        } catch {
          /* no archive data for this pool — leave change24 unset */
        }
      })
    );
  }
}

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
 * Featured pons coins — a reliable base list so the established coins never
 * drop out of the feed because auto-discovery missed them.
 *
 * These are NOT a fixed leaderboard: every one is re-priced live from the chain
 * on each refresh, and the feed is ranked by that live market cap alongside the
 * auto-discovered coins. So the ORDER updates itself as caps move, new coins
 * that grow big are still picked up by discovery, and this list only guarantees
 * the known coins are always present. Add or remove addresses here (or via the
 * PONS_SEED_TOKENS env) as the roster changes.
 */
const FEATURED_PONS = [
  "0x39dBED3a2bd333467115dE45665cC57F813C4571", // PONS
  "0x2076CD26D8Cf26f91655d4Ada3dD2fdBFdd8e7a4", // APES
  "0x62C71cd34a52c30d894419CBcc55Db2aFA8032eA", // YOLO
  "0x45F82AC5d507e988f7406935da8eEfe495a360e0", // BRODIE
  "0xA8aD8DAcbb2123458BD628e7De689524905bFcb7", // LONG
  "0xB0Fea401F1ee62F0e7cC3Bdf94b20c25aB5117e2", // MOTION
  "0x69984Ad3322300039f2855f81C44Dbc532EFe744", // TYGR
  "0x9516922a56171AB9834b88864d1010a6D8633296", // Artcoin
  "0x9d98f99b0b6B2b7F99ab8BC187e1C59793eccb2c", // PIPECAT
  "0x1aBf16f660CCbAa22CE8646deB1B63635D582228", // FONZ
  "0x30dB03A051205CcBeb1B6524dDf87fbC6c0127bC", // TA
  "0x8ECEA3d0E648DB646d824AA51EedeB16aC3d6878", // wire
  "0x92D176ccBeEffeCd8089e841D09ea17b6C22D969", // VLAD
  "0x29fbaa3668E688C83fae9b5Dd13cC3CfC097ccBF", // DAHOOD
  "0x7FE995a80075dF3Dc8Ae11A9b82c7FE4202CD87f", // HMM
  "0x859ead0EE2fd39a2804bB27713742577f7bE79c1", // CC
  "0xC9E7C34fa156a235e8B8601171a543bc9c84a1B9", // TAMPONS
];

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
async function discoverTopTokens(explorer, pages = Number(process.env.PONS_TOP_PAGES || 5)) {
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

/** Attach each token's holder count from the explorer's token info. */
async function attachHolders(explorer, launches, concurrency = 5) {
  const base = `${explorer.replace(/\/+$/, "")}/api/v2/tokens/`;
  for (let i = 0; i < launches.length; i += concurrency) {
    const batch = launches.slice(i, i + concurrency);
    await Promise.all(
      batch.map(async (l) => {
        try {
          const j = await fetchJson(base + l.token);
          if (j) {
            l.holders = Number(j.holders ?? j.holders_count ?? j.holder_count) || null;
            // Fallback price + market cap from the explorer's index, used when the
            // on-chain pool read gave none (common for graduated coins whose
            // liquidity has moved) — so the card shows a real figure, not a dash.
            const em = Number(j.circulating_market_cap ?? j.market_cap);
            if (Number.isFinite(em) && em > 0) l.explorerMcapUsd = em;
            const ep = Number(j.exchange_rate);
            if (Number.isFinite(ep) && ep > 0) l.explorerPriceUsd = ep;
          }
        } catch {
          /* holders are a nice-to-have; never fail the feed over them */
        }
      })
    );
  }
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
const CACHE_TTL_MS = Number(process.env.LAUNCH_CACHE_TTL_MS || 300_000);

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
      ...FEATURED_PONS,
      process.env.OFFICIAL_TOKEN,
      ...(process.env.PONS_SEED_TOKENS || "").split(/[\s,]+/),
    ].filter(Boolean);

    // Enrich a bounded candidate set (newest + seeds), price each, and rank by
    // market cap so the feed shows the biggest pons coins — not just the newest.
    const cap = Number(process.env.PONS_ENRICH_CAP || 50);
    const seen = new Set();
    const candidates = [];
    // Seeds and top-tokens first (most likely to be the big coins), then the
    // newest launches.
    for (const a of [...seeds, ...topTokens, ...discovered]) {
      let addr;
      try { addr = getAddress(a); }
      catch { try { addr = getAddress(String(a).toLowerCase()); } catch { continue; } }
      const k = addr.toLowerCase();
      if (!seen.has(k)) { seen.add(k); candidates.push(addr); }
    }
    const picked = candidates.slice(0, cap);

    let launches = [];
    if (picked.length) {
      const enriched = await enrichBounded(provider, chain, picked, Number(process.env.PONS_ENRICH_CONCURRENCY || 5));
      const featuredSet = new Set(FEATURED_PONS.map((a) => a.toLowerCase()));
      const byMcap = (a, b) => (b.marketCapWeth || 0) - (a.marketCapWeth || 0);

      // Featured coins always show (even if a price read failed this cycle), as
      // long as they read as a token at all. Ranked by live market cap.
      const featured = enriched
        .filter((l) => featuredSet.has((l.token || "").toLowerCase()) && (l.symbol || l.name))
        .sort(byMcap);
      // Auto-discovered coins must be real pons launches with a priced pool, so
      // no-liquidity spam and non-pons ERC-20s are dropped.
      const extra = enriched
        .filter((l) => !featuredSet.has((l.token || "").toLowerCase()) && l.isPonsLaunch && Number.isFinite(l.marketCapWeth) && l.marketCapWeth > 0)
        .sort(byMcap);

      // Tag the source so the client can keep established (featured) coins ranked
      // ahead of freshly-discovered ones on the Top tab, and show the discovered
      // ones first on New — without depending on a USD rate that may be missing.
      for (const l of featured) l.featured = true;
      for (const l of extra) l.featured = false;

      launches = [...featured, ...extra];
      const shown = launches.slice(0, 24);
      await Promise.all([
        attachHolders(chain.explorer, shown),
        attachChange24(provider, shown),
      ]);
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
