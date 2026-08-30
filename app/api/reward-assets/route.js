import { NextResponse } from "next/server";
import { JsonRpcProvider, getAddress } from "ethers";
import { getChain } from "@/lib/engine";
import { resolveTokenLogo } from "@/lib/tokenLogo";
import { REWARD_POOL } from "@/src/lib/rewards";

/**
 * GET /api/reward-assets?network=robinhood
 *
 * Real logos for the reward tokens, resolved the same way the Locked feature
 * does — each token's on-chain logo(), falling back to its Blockscout explorer
 * icon. That's how $PONS (whose logo() is empty) still gets its real image.
 * Returned as { [symbol]: url|null }; the page prefers it for $PONS and uses it
 * as a fallback behind the per-company logos for the stock tokens.
 */
export async function GET(request) {
  const url = new URL(request.url);
  const network = url.searchParams.get("network") || "robinhood";

  let chain;
  try {
    chain = getChain(network);
  } catch {
    return NextResponse.json({ assets: {} });
  }

  const provider = new JsonRpcProvider(chain.rpc, chain.chainId, { staticNetwork: true });

  const assets = {};
  await Promise.all(
    REWARD_POOL.filter((r) => r.address).map(async (r) => {
      try {
        assets[r.key] = await resolveTokenLogo(provider, chain.explorer, getAddress(r.address));
      } catch {
        assets[r.key] = null;
      }
    })
  );

  return NextResponse.json({ assets });
}
