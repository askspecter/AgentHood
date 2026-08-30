import { NextResponse } from "next/server";
import { Contract, JsonRpcProvider } from "ethers";
import { getChain } from "@/lib/engine";

/**
 * GET /api/reward-assets?network=robinhood
 *
 * The one logo we can only read on-chain: $PONS is a pons launch token, so its
 * real logo lives in its logo() method. Returned as { PONS: url|null }; the page
 * prepends it to the static per-company logo candidates. The tokenized stocks use
 * their real company logos client-side (Robinhood's directory only carries the
 * generic Robinhood mark, not each company's), so they aren't fetched here.
 */
const PONS = "0x39dBED3a2bd333467115dE45665cC57F813C4571";

export async function GET(request) {
  const url = new URL(request.url);
  const network = url.searchParams.get("network") || "robinhood";

  let chain;
  try {
    chain = getChain(network);
  } catch {
    return NextResponse.json({ assets: {} });
  }

  let pons = null;
  try {
    const provider = new JsonRpcProvider(chain.rpc, chain.chainId);
    const lg = await new Contract(PONS, ["function logo() view returns (string)"], provider).logo();
    if (lg && typeof lg === "string" && lg.trim()) pons = lg.trim();
  } catch {
    /* no logo() — the page falls back to static $PONS candidates */
  }

  return NextResponse.json({ assets: { PONS: pons } });
}
