import { NextResponse } from "next/server";
import { JsonRpcProvider } from "ethers";
import { getChain, getEthUsd, listLaunches, enrichLaunchesByAddress } from "@/lib/engine";

/** keccak256("TokenLaunched(...)") — the factory's launch event. */
const TOKEN_LAUNCHED_TOPIC =
  "0xdb51ea9ad51ab453a65a4cb7e60c3cb378c9501bb002609f8f97778fb6c4235a";

/**
 * Discover launch token addresses from the block explorer's own index.
 *
 * The RPC times out on the wide eth_getLogs range needed to reach launches made
 * long before the current head, so a plain scan finds nothing. Blockscout has
 * already indexed every log, so its API returns the factory's TokenLaunched
 * events — newest first — with no block-range limit. We read the token addresses
 * from those and price them by direct contract calls, which never time out.
 */
async function discoverViaExplorer(explorer, factories) {
  const found = [];
  for (const factory of factories) {
    if (!factory) continue;
    try {
      const url = `${explorer.replace(/\/+$/, "")}/api/v2/addresses/${factory}/logs`;
      const res = await fetch(url, { headers: { accept: "application/json" }, cache: "no-store" });
      if (!res.ok) continue;
      const json = await res.json();
      for (const log of json.items || []) {
        const topics = log.topics || [];
        if ((topics[0] || "").toLowerCase() !== TOKEN_LAUNCHED_TOPIC) continue;
        const t = topics[1];
        if (t) found.push({ token: "0x" + t.slice(-40), block: Number(log.block_number) || 0 });
      }
    } catch {
      /* one factory or a flaky explorer must not break discovery */
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
 * GET /api/launches?network=robinhood&limit=12
 *
 * The launchpad feed, read straight off the pons factory's TokenLaunched event.
 * No sign-in: this is public on-chain data and the page's front door.
 */

function serialise(value) {
  return JSON.parse(
    JSON.stringify(value, (_key, v) => (typeof v === "bigint" ? v.toString() : v))
  );
}

export async function GET(request) {
  const url = new URL(request.url);
  const network = url.searchParams.get("network") || "robinhood";
  const limit = Math.min(Number(url.searchParams.get("limit") || 12), 24);

  let chain;
  try {
    chain = getChain(network);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  try {
    const provider = new JsonRpcProvider(chain.rpc, chain.chainId);
    // The rate is fetched alongside the feed, not after it: prices and market
    // caps are unreadable in WETH, and a second round trip would show the feed
    // twice — once priced in Ξ, then again in dollars.
    const [feed, rate] = await Promise.all([
      listLaunches(provider, chain, {
        limit,
        // Narrow chunks so the public RPC (which times out on wide eth_getLogs
        // ranges) still works without a dedicated provider. Tunable via env.
        maxBlocks: Number(process.env.LAUNCH_SCAN_BLOCKS || 60_000),
        chunkSize: Number(process.env.LAUNCH_CHUNK || 2_000),
      }),
      getEthUsd(),
    ]);

    // The RPC scan only sees recent blocks. pons launches are older than that,
    // so when the scan comes up empty, discover tokens by address instead:
    // Blockscout's index for the (active + legacy) factories, plus the docs'
    // reference token and any operator-seeded addresses. Direct reads price
    // them without any getLogs window.
    let launches = feed.launches;
    if (!launches.length) {
      const pons = chain.pons || {};
      const factories = [pons.factory, pons.legacyFactory].filter(Boolean);
      let discovered = [];
      try {
        discovered = await discoverViaExplorer(chain.explorer, factories);
      } catch {
        /* explorer optional — the seeds below still surface real tokens */
      }
      const seeds = [
        chain.reference?.token,
        process.env.OFFICIAL_TOKEN,
        ...(process.env.PONS_SEED_TOKENS || "").split(/[\s,]+/),
      ].filter(Boolean);
      const all = [...new Set([...discovered, ...seeds])].slice(0, Math.max(limit, 12));
      if (all.length) {
        try {
          const enriched = await enrichLaunchesByAddress(provider, chain, all);
          enriched.sort((a, b) => (b.marketCapWeth || 0) - (a.marketCapWeth || 0));
          launches = enriched.slice(0, limit);
        } catch {
          /* keep the (empty) scan result rather than failing the whole feed */
        }
      }
    }

    return NextResponse.json(
      serialise({
        ...feed,
        launches,
        network,
        explorer: chain.explorer,
        ethUsd: rate?.usd ?? null,
        ethUsdStale: rate?.stale ?? false,
      })
    );
  } catch (error) {
    console.error("Launch feed failed:", error);
    const unreachable = /fetch|network|ECONN|timeout|ENOTFOUND/i.test(error.message || "");
    return NextResponse.json(
      {
        error: error.message || "Could not load launches.",
        hint: unreachable
          ? "The Robinhood Chain RPC is unreachable from this server. Check ROBINHOOD_RPC."
          : undefined,
      },
      { status: unreachable ? 502 : 500 }
    );
  }
}
