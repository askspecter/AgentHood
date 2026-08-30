import { NextResponse } from "next/server";
import { Contract, JsonRpcProvider } from "ethers";
import { getChain, loadDirectory } from "@/lib/engine";

/**
 * GET /api/reward-assets?network=robinhood
 *
 * Real logos for the $AURN holder-reward tokens, keyed by symbol. Stock tokens
 * come from Robinhood's own asset directory (matched by address); $PONS is a
 * pons launch token, so its logo is read from its on-chain logo(). Best-effort:
 * any token that can't resolve just returns null and the page draws a tile.
 */
const REWARD_TOKENS = [
  { symbol: "PONS", address: "0x39dBED3a2bd333467115dE45665cC57F813C4571", onchain: true },
  { symbol: "NVDA", address: "0xd0601CE157Db5bdC3162BbaC2a2C8aF5320D9EEC" },
  { symbol: "TSLA", address: "0x322F0929c4625eD5bAd873c95208D54E1c003b2d" },
  { symbol: "AAPL", address: "0xaF3D76f1834A1d425780943C99Ea8A608f8a93f9" },
  { symbol: "SPY", address: "0x117cc2133c37B721F49dE2A7a74833232B3B4C0C" },
  { symbol: "COIN", address: "0x6330D8C3178a418788dF01a47479c0ce7CCF450b" },
];

export async function GET(request) {
  const url = new URL(request.url);
  const network = url.searchParams.get("network") || "robinhood";

  let chain;
  try {
    chain = getChain(network);
  } catch {
    return NextResponse.json({ assets: {} });
  }

  // Robinhood asset directory → logo by token address (covers the stock tokens).
  const byAddr = new Map();
  try {
    const dir = await loadDirectory(chain.chainId).catch(() => null);
    for (const t of dir?.tokens || []) if (t?.token) byAddr.set(t.token.toLowerCase(), t);
  } catch {
    /* directory unavailable — logos fall back to a tile */
  }

  const provider = new JsonRpcProvider(chain.rpc, chain.chainId);
  const logoAbi = ["function logo() view returns (string)"];

  const assets = {};
  await Promise.all(
    REWARD_TOKENS.map(async (r) => {
      let logo = byAddr.get(r.address.toLowerCase())?.logoURI || null;
      // $PONS (a pons launch token) self-describes its logo on-chain.
      if (!logo && r.onchain) {
        try {
          const lg = await new Contract(r.address, logoAbi, provider).logo();
          if (lg && typeof lg === "string" && lg.trim()) logo = lg.trim();
        } catch {
          /* no logo() — leave null */
        }
      }
      assets[r.symbol] = logo || null;
    })
  );

  return NextResponse.json({ assets });
}
