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
      logo: hit?.logoURI || null,
    };
  });

  return NextResponse.json({ assets });
}
