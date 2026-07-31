import { NextResponse } from "next/server";
import { JsonRpcProvider, getAddress } from "ethers";
import { listLaunched, enrichLaunchesByAddress, getChain, getEthUsd } from "@/lib/engine";
import { topVolume, topReferral } from "@/lib/leaderboard";

/**
 * GET /api/leaderboard?network=robinhood
 *
 * Three real boards in one call:
 *   • volume   — USD swapped per trader (KV, bumped on every fill)
 *   • referral — friends signed in through a code (KV, de-duped)
 *   • creator  — coins launched ON ESKA, ranked by the market cap created here,
 *                derived live from the launch registry (no store)
 *
 * Each board returns an empty array until there's real activity — nothing is
 * ever invented. Cached briefly so opening the tab is cheap.
 */

const short = (a) => (a ? `${a.slice(0, 6)}…${a.slice(-4)}` : "anon");
const CACHE = new Map();
const TTL_MS = 30_000;

async function creatorBoard(network) {
  const result = await listLaunched({ limit: 100 });
  if (!result.tokens?.length) return [];

  const chain = getChain(network);
  const provider = new JsonRpcProvider(chain.rpc, chain.chainId);
  const [enriched, rate] = await Promise.all([
    enrichLaunchesByAddress(provider, chain, result.tokens).catch(() => []),
    getEthUsd().catch(() => null),
  ]);
  const ethUsd = rate?.usd ?? null;

  const entryByToken = new Map((result.entries || []).map((e) => [e.token.toLowerCase(), e]));

  // Sum the market cap each creator has launched here, and count their coins.
  const byCreator = new Map();
  for (const l of enriched) {
    const entry = entryByToken.get((l.token || "").toLowerCase()) || {};
    const handle = entry.xUsername ? "@" + String(entry.xUsername).replace(/^@/, "") : null;
    const key = (handle || (l.deployer ? getAddress(l.deployer) : "")).toLowerCase();
    if (!key) continue;
    const mcapUsd =
      l.marketCapWeth != null && ethUsd ? l.marketCapWeth * ethUsd : (l.explorerMcapUsd ?? 0);
    const cur = byCreator.get(key) || { display: handle || short(l.deployer), score: 0, coins: 0 };
    cur.score += Number(mcapUsd) || 0;
    cur.coins += 1;
    byCreator.set(key, cur);
  }

  return [...byCreator.values()]
    .sort((a, b) => b.score - a.score)
    .slice(0, 25)
    .map((r, i) => ({ rank: i + 1, display: r.display, score: r.score, coins: r.coins }));
}

export async function GET(request) {
  const url = new URL(request.url);
  const network = url.searchParams.get("network") || "robinhood";

  const cached = CACHE.get(network);
  if (cached && Date.now() - cached.at < TTL_MS) {
    return NextResponse.json(cached.value);
  }

  const [volume, referral, creator] = await Promise.all([
    topVolume(25).catch(() => []),
    topReferral(25).catch(() => []),
    creatorBoard(network).catch(() => []),
  ]);

  const value = { network, volume, referral, creator, at: Date.now() };
  CACHE.set(network, { at: Date.now(), value });
  return NextResponse.json(value);
}
