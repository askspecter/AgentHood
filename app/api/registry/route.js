import { NextResponse } from "next/server";
import { JsonRpcProvider, getAddress } from "ethers";
import {
  recordLaunch,
  listLaunched,
  enrichLaunchesByAddress,
  deriveAddress,
  getChain,
  getEthUsd,
} from "@/lib/engine";
import { getSession } from "@/lib/session";
import { resolveLaunch, curvePricing, v4Pricing } from "@/lib/engine/ponsV2";
import { dexscreenerBatch } from "@/lib/dexscreener";

/**
 * GET  /api/registry        → tokens launched through this site, newest first
 * POST /api/registry        → record one after its launch transaction confirms
 *
 * The chain cannot tell us which front end was used for a launch, so this is how
 * "launched here" is known at all.
 *
 * The addresses come from the registry, but the live state (name, price, market
 * cap, graduation) is read straight off the chain here. That is what makes a
 * just-created token appear the instant it exists, rather than waiting for it to
 * bubble into the top of the general feed's bounded block window.
 */

function serialise(value) {
  return JSON.parse(
    JSON.stringify(value, (_key, v) => (typeof v === "bigint" ? v.toString() : v))
  );
}

/**
 * Dexscreener USD price fallback for a token.
 *
 * The official $AURN coin trades on a Uniswap V4 pool the on-chain enricher can't
 * always resolve, so its pool read comes back with no price and the coin shows
 * "—". Dexscreener already aggregates the pool, so this reads the USD price +
 * market cap straight from it. Best-effort and time-boxed; any failure returns
 * null and the coin shows without a price, exactly as before. (Only reachable
 * from the deployment's network, not local dev sandboxes.)
 */
async function dexscreenerUsd(token) {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 6000);
    let j = null;
    try {
      const res = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${token}`, {
        cache: "no-store",
        signal: ctrl.signal,
        headers: { accept: "application/json" },
      });
      j = res.ok ? await res.json() : null;
    } finally {
      clearTimeout(timer);
    }
    const pairs = Array.isArray(j?.pairs) ? j.pairs : [];
    if (!pairs.length) return null;
    const liq = (p) => Number(p?.liquidity?.usd) || 0;
    // Prefer Robinhood Chain pairs (tolerate slug variants); else any. Deepest first.
    const rh = pairs.filter((p) => String(p?.chainId || "").toLowerCase().includes("robinhood"));
    const best = (rh.length ? rh : pairs).sort((a, b) => liq(b) - liq(a))[0];
    if (!best) return null;
    const priceUsd = Number(best.priceUsd);
    const mcapUsd = Number(best.marketCap) || Number(best.fdv) || 0;
    const change24 = Number(best?.priceChange?.h24);
    return {
      priceUsd: Number.isFinite(priceUsd) && priceUsd > 0 ? priceUsd : null,
      mcapUsd: Number.isFinite(mcapUsd) && mcapUsd > 0 ? mcapUsd : null,
      change24: Number.isFinite(change24) ? change24 : null,
    };
  } catch {
    return null;
  }
}

export async function GET(request) {
  const url = new URL(request.url);
  const network = url.searchParams.get("network") || "robinhood";

  // The viewer's own X handle + wallet, so a launch they made is credited to
  // them even when its registry entry predates handle-recording (or the
  // in-memory registry was reset). getSession may throw with no SESSION_SECRET;
  // that just means "no viewer", not an error worth failing the feed over.
  let me = null;
  try {
    const session = await getSession();
    if (session?.username && session?.id) {
      me = { handle: session.username.replace(/^@/, ""), wallet: getAddress(deriveAddress(session.id)) };
    }
  } catch {
    /* no viewer identity available */
  }

  try {
    const result = await listLaunched({ limit: 50 });

    let launches = [];
    let ethUsd = null;
    if (result.tokens.length) {
      const chain = getChain(network);
      const provider = new JsonRpcProvider(chain.rpc, chain.chainId);
      const [enriched, rate] = await Promise.all([
        enrichLaunchesByAddress(provider, chain, result.tokens),
        getEthUsd(),
      ]);

      // The stored entry per token carries the X handle that launched it, plus
      // (for the official pin) its official flag and socials.
      const entryByToken = new Map(
        (result.entries || []).map((e) => [e.token.toLowerCase(), e])
      );
      launches = enriched.map((l) => {
        const entry = entryByToken.get(l.token.toLowerCase()) || {};
        // Fall back to the viewer's handle when they are the launch's deployer.
        const mine = me && l.deployer && getAddress(l.deployer) === me.wallet ? me.handle : null;
        return {
          ...l,
          // Live on-chain name/symbol win; the official entry carries fallbacks
          // so its card never shows "$???" on a transient metadata miss.
          symbol: l.symbol || entry.symbol || null,
          name: l.name || entry.name || null,
          // The official pin uses the bundled brand mark; everything else keeps
          // whatever logo the token set on-chain.
          logo: entry.logo || l.logo || null,
          xUsername: entry.xUsername || mine || null,
          // The wallet that deployed the coin - shown as the creator when there's
          // no X handle, so the card credits the deploying address, not "anon".
          deployer: l.deployer || entry.deployer || null,
          official: entry.official || false,
          // Prefer the coin's own on-chain socials; the official pin's entry
          // socials only fill in when the token has none.
          socials: l.socials || entry.socials || null,
        };
      });
      ethUsd = rate?.usd ?? null;

      // Overlay pons v2 curve pricing so a v2 launch shows a real price, market
      // cap and graduation progress instead of the empty v3-pool read.
      await Promise.all(
        launches.map(async (l) => {
          try {
            const lc = await resolveLaunch(provider, chain, l.token);
            if (!lc) return;
            if (lc.phase === 0) {
              const p = await curvePricing(provider, chain, lc);
              if (p.priceInWeth != null) l.priceInWeth = p.priceInWeth;
              if (p.marketCapWeth != null) l.marketCapWeth = p.marketCapWeth;
              if (p.graduationProgress != null) l.graduationProgress = p.graduationProgress;
              l.graduated = false;
            } else if (lc.phase === 2) {
              l.graduated = true;
              const p = await v4Pricing(provider, chain, lc);
              if (p.priceInWeth != null) l.priceInWeth = p.priceInWeth;
              if (p.marketCapWeth != null) l.marketCapWeth = p.marketCapWeth;
              l.graduationProgress = 1;
            }
          } catch {
            /* leave the v1-derived values as-is */
          }
        })
      );

      // Real market caps from Dexscreener. The on-chain figure is fully-diluted
      // (price × the full 1B supply), which reads high versus the traded market
      // cap Dexscreener reports. Where Dexscreener has a token, use its USD price
      // + market cap and drop the on-chain USD figures so the coin page (and the
      // store, which dedupes registry entries ahead of the feed) shows the real
      // numbers. One batched request.
      try {
        const dx = await dexscreenerBatch(launches.map((l) => l.token));
        for (const l of launches) {
          const d = dx.get((l.token || "").toLowerCase());
          if (!d) continue;
          if (d.priceUsd != null) { l.explorerPriceUsd = d.priceUsd; l.priceInWeth = null; }
          if (d.mcapUsd != null) { l.explorerMcapUsd = d.mcapUsd; l.marketCapWeth = null; }
          if (d.change24 != null) l.change24 = d.change24;
        }
      } catch { /* best-effort — keep on-chain figures on failure */ }
    }

    // Never emit a coin we couldn't label - it renders as the "$TOKEN"
    // placeholder. The official pin is always kept; everything else needs a real
    // symbol or name (it returns once its on-chain read succeeds).
    launches = launches.filter((l) => l.official || l.symbol || l.name);

    return NextResponse.json(serialise({ ...result, launches, ethUsd, network }));
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Expected a JSON body." }, { status: 400 });
  }

  const { token, txHash, deployer, xUsername, logo } = body || {};
  if (!token) {
    return NextResponse.json({ error: "Provide a `token` address." }, { status: 400 });
  }

  try {
    const result = await recordLaunch(token, { txHash, deployer, xUsername, logo });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
