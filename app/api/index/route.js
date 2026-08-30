import { NextResponse } from "next/server";
import { getChain, loadDirectory } from "@/lib/engine";
import { V2_QUOTE_TOKENS } from "@/src/lib/pons/registry";
import { BASKETS, getBasket } from "@/src/lib/indexes";

/**
 * GET /api/index?network=robinhood[&basket=mag7]
 *
 * Live reference NAV for the AURN index baskets, computed from the issuer's
 * on-chain stock quotes (the same directory the terminal prices stocks from).
 * No pool required - each constituent is priced from its live bid/ask mid.
 *
 * With ?basket= it returns one basket in full; without it, every basket with a
 * lightweight summary. The NAV is a weighted USD price of the basket ("one unit
 * of this theme costs $X") built only from constituents we can price live, so a
 * temporarily missing quote never distorts the number - it just lowers coverage.
 *
 * These are reference numbers for thematic tracking coins. Nothing here is
 * collateralized by or redeemable for the underlying stocks.
 */
export async function GET(request) {
  const url = new URL(request.url);
  const network = url.searchParams.get("network") || "robinhood";
  const one = url.searchParams.get("basket");

  let chainId = 4663;
  try { chainId = getChain(network).chainId; } catch { /* default */ }

  // Price + logo by token address, from the live issuer directory (bid/ask mid).
  const priceByAddr = new Map();
  try {
    const dir = await loadDirectory(chainId).catch(() => null);
    for (const t of dir?.tokens || []) {
      if (t?.token) priceByAddr.set(t.token.toLowerCase(), t);
    }
  } catch { /* directory unavailable - fall back to the DEX below */ }

  // symbol -> { address, name } from our validated quote-token registry.
  const bySymbol = new Map();
  for (const q of V2_QUOTE_TOKENS) bySymbol.set(q.symbol.toUpperCase(), q);

  // Fallback pricing from the on-chain DEX (DexScreener), so a basket still
  // prices when the issuer quote is empty (after-hours / halted). Highest-
  // liquidity pool on this chain wins; also carries the 24h move.
  const dexByAddr = new Map();
  try {
    const needed = [];
    const which = one ? [getBasket(one)].filter(Boolean) : BASKETS;
    for (const b of which) {
      for (const c of b.constituents) {
        const meta = bySymbol.get(c.symbol.toUpperCase());
        if (!meta) continue;
        const key = meta.address.toLowerCase();
        const dir = priceByAddr.get(key);
        if (dir?.priceUsd == null && !needed.includes(meta.address)) needed.push(meta.address);
      }
    }
    if (needed.length) {
      const res = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${needed.join(",")}`, {
        signal: AbortSignal.timeout(8000),
      });
      const j = await res.json().catch(() => null);
      for (const p of j?.pairs || []) {
        const addr = p?.baseToken?.address?.toLowerCase();
        const usd = Number(p?.priceUsd);
        if (!addr || !Number.isFinite(usd)) continue;
        const liq = Number(p?.liquidity?.usd) || 0;
        const prev = dexByAddr.get(addr);
        if (!prev || liq > prev.liq) {
          dexByAddr.set(addr, { priceUsd: usd, change24: Number(p?.priceChange?.h24) || null, liq });
        }
      }
    }
  } catch { /* DEX unavailable - NAV falls back to whatever the directory had */ }

  const priceOf = (addr) => {
    if (!addr) return { priceUsd: null, change24: null };
    const k = addr.toLowerCase();
    const dir = priceByAddr.get(k);
    if (dir?.priceUsd != null && Number.isFinite(dir.priceUsd)) return { priceUsd: dir.priceUsd, change24: null };
    const dex = dexByAddr.get(k);
    if (dex) return { priceUsd: dex.priceUsd, change24: dex.change24 };
    return { priceUsd: null, change24: null };
  };

  const compute = (basket) => {
    const rows = basket.constituents.map((c) => {
      const meta = bySymbol.get(c.symbol.toUpperCase());
      const dir = meta ? priceByAddr.get(meta.address.toLowerCase()) : null;
      const { priceUsd, change24 } = priceOf(meta?.address);
      return {
        symbol: c.symbol,
        name: meta?.name || dir?.symbol || c.symbol,
        address: meta?.address || null,
        weight: c.weight,
        priceUsd,
        change24,
        logo: dir?.logoURI || null,
      };
    });

    const priced = rows.filter((r) => r.priceUsd != null);
    const wSum = priced.reduce((s, r) => s + r.weight, 0);
    // NAV = weighted USD price over the priced constituents (weights renormalized).
    const navUsd = wSum > 0 ? priced.reduce((s, r) => s + (r.weight / wSum) * r.priceUsd, 0) : null;
    // Weighted 24h change over constituents that report one.
    const chRows = priced.filter((r) => r.change24 != null);
    const chSum = chRows.reduce((s, r) => s + r.weight, 0);
    const change24 = chSum > 0 ? chRows.reduce((s, r) => s + (r.weight / chSum) * r.change24, 0) : null;

    return {
      key: basket.key,
      name: basket.name,
      emoji: basket.emoji,
      tint: basket.tint,
      blurb: basket.blurb,
      navUsd,
      change24,
      coverage: { priced: priced.length, total: rows.length },
      constituents: rows.map((r) => ({
        ...r,
        // Normalized weight (%) over the priced set, and its USD contribution.
        weightPct: r.priceUsd != null && wSum > 0 ? (r.weight / wSum) * 100 : null,
        contributionUsd: r.priceUsd != null && wSum > 0 ? (r.weight / wSum) * r.priceUsd : null,
      })),
    };
  };

  if (one) {
    const basket = getBasket(one);
    if (!basket) return NextResponse.json({ error: "Unknown basket." }, { status: 404 });
    return NextResponse.json({ network, basket: compute(basket) });
  }

  return NextResponse.json({ network, baskets: BASKETS.map(compute) });
}
