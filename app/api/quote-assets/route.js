import { NextResponse } from "next/server";
import { getChain, loadDirectory } from "@/lib/engine";
import { V2_QUOTE_TOKENS } from "@/src/lib/pons/registry";

/**
 * GET /api/quote-assets?network=robinhood
 *
 * The v2 paired-asset choices (our curated quote tokens) enriched with the real
 * stock/asset logo + name from Robinhood's own asset directory, matched by
 * contract address. Used by the launch flow's paired-asset picker so each asset
 * shows its actual image, not a placeholder.
 */
export async function GET(request) {
  const url = new URL(request.url);
  const network = url.searchParams.get("network") || "robinhood";

  let chainId = 4663;
  try { chainId = getChain(network).chainId; } catch { /* default */ }

  let byAddr = new Map();
  try {
    const dir = await loadDirectory(chainId).catch(() => null);
    for (const t of dir?.tokens || []) {
      if (t?.token) byAddr.set(t.token.toLowerCase(), t);
    }
  } catch { /* directory unavailable - logos just fall back to a letter tile */ }

  const assets = V2_QUOTE_TOKENS.map((q) => {
    const hit = byAddr.get(q.address.toLowerCase());
    return {
      symbol: q.symbol,
      name: q.name || hit?.name,
      address: q.address,
      logo: logoFor(q.symbol, hit?.logoURI),
    };
  });

  return NextResponse.json({ assets });
}

// Real logos for the paired-asset picker. Robinhood's own CDN only serves a
// generic placeholder for these tokens, so we self-host the crypto/stable marks
// and use each company's real brand logo for the stock tokens.
const LOCAL_LOGO = {
  LINK: "/assets/tokens/link.jpg",
  CBBTC: "/assets/tokens/cbbtc.png",
  USDG: "/assets/tokens/usdg.png",
};
function logoFor(symbol, fallback) {
  const s = String(symbol || "").toUpperCase();
  if (LOCAL_LOGO[s]) return LOCAL_LOGO[s];
  // Stock tickers: real brand logo by symbol.
  if (/^[A-Z]{1,6}$/.test(s)) return `https://financialmodelingprep.com/image-stock/${s}.png`;
  return fallback || null;
}
