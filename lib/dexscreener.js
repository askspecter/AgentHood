/**
 * Dexscreener USD pricing for Robinhood-Chain tokens.
 *
 * A launch's on-chain market cap is price × full (1B) supply — a fully-diluted
 * figure that can read high versus the real, traded market cap. Dexscreener
 * aggregates the actual pools and reports the market cap people quote, so we use
 * it as the source of truth for a launched token's price and market cap.
 *
 * `dexscreenerBatch` fetches up to 30 token addresses in a single request and
 * returns a Map(addressLower → { priceUsd, mcapUsd, change24 }). Best-effort and
 * time-boxed: on any failure it returns an empty map and the caller keeps its
 * on-chain figures. Only reachable from the deployment's network, not local dev.
 */
export async function dexscreenerBatch(addresses = []) {
  const out = new Map();
  const uniq = [...new Set((addresses || []).map((a) => String(a || "").toLowerCase()).filter(Boolean))].slice(0, 30);
  if (!uniq.length) return out;

  let j = null;
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 6000);
    try {
      const res = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${uniq.join(",")}`, {
        cache: "no-store",
        signal: ctrl.signal,
        headers: { accept: "application/json" },
      });
      j = res.ok ? await res.json() : null;
    } finally {
      clearTimeout(timer);
    }
  } catch {
    return out;
  }

  const pairs = Array.isArray(j?.pairs) ? j.pairs : [];
  const liq = (p) => Number(p?.liquidity?.usd) || 0;

  // Best pair per base token: prefer Robinhood Chain, then deepest liquidity.
  const best = new Map();
  for (const p of pairs) {
    const addr = String(p?.baseToken?.address || "").toLowerCase();
    if (!addr) continue;
    const isRh = String(p?.chainId || "").toLowerCase().includes("robinhood");
    const score = liq(p) + (isRh ? 1e12 : 0);
    const cur = best.get(addr);
    if (!cur || score > cur.score) best.set(addr, { p, score });
  }

  for (const [addr, { p }] of best) {
    const priceUsd = Number(p.priceUsd);
    const mcapUsd = Number(p.marketCap) || Number(p.fdv) || 0;
    const change24 = Number(p?.priceChange?.h24);
    out.set(addr, {
      priceUsd: Number.isFinite(priceUsd) && priceUsd > 0 ? priceUsd : null,
      mcapUsd: Number.isFinite(mcapUsd) && mcapUsd > 0 ? mcapUsd : null,
      change24: Number.isFinite(change24) ? change24 : null,
    });
  }
  return out;
}
