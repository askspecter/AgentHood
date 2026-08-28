import { NextResponse } from "next/server";
import { Contract } from "ethers";
import { getChain, readLaunch, rpcProvider, getEthUsd, spotPrice } from "@/lib/engine";
import { getAddress } from "ethers";

/**
 * GET /api/creator/fee-info?token=0x…&network=robinhood
 *
 * Read-only creator-fee metadata a client needs to show + claim fees WITHOUT a
 * server key: the v1 locker address, the payout wallet (deployer or redirect),
 * isToken0, decimals, symbol, the creator share, and a token USD price. The
 * connected wallet reads the accrued amounts (by simulating collectFees) and
 * signs the claim itself — this endpoint never signs anything.
 */
const META_ABI = [
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
];

export async function GET(request) {
  const url = new URL(request.url);
  const network = url.searchParams.get("network") || "robinhood";
  let token;
  try {
    token = getAddress(url.searchParams.get("token"));
  } catch {
    return NextResponse.json({ error: "Bad token address." }, { status: 400 });
  }

  let chain;
  try {
    chain = getChain(network);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  try {
    const provider = rpcProvider(chain);
    const launch = await readLaunch(provider, chain, token);
    if (!launch?.isPonsLaunch || !launch.fees?.locker) {
      // Not a v1 pons launch with a locker (e.g. a v2 curve, or a token with no v1 locker).
      return NextResponse.json({ claimable: false });
    }

    let decimals = 18, symbol = "TOKEN";
    try {
      const c = new Contract(token, META_ABI, provider);
      [symbol, decimals] = await Promise.all([
        c.symbol().catch(() => "TOKEN"),
        c.decimals().then((d) => Number(d)).catch(() => 18),
      ]);
    } catch { /* defaults */ }

    let tokenPriceUsd = null;
    try {
      const rate = (await getEthUsd().catch(() => null))?.usd ?? null;
      if (rate && launch.priceInWeth != null) tokenPriceUsd = launch.priceInWeth * rate;
      else if (rate && launch.pool) {
        const sp = await spotPrice(provider, launch.pool, launch.isToken0).catch(() => null);
        if (sp != null) tokenPriceUsd = sp * rate;
      }
    } catch { /* price is best-effort */ }

    return NextResponse.json({
      claimable: true,
      model: "v1",
      token,
      locker: launch.fees.locker,
      deployer: launch.deployer,
      payoutWallet: launch.fees.creatorPayout,
      redirected: Boolean(launch.fees.redirected),
      isToken0: Boolean(launch.isToken0),
      decimals,
      symbol: (symbol || "TOKEN").replace(/^\$/, ""),
      creatorSharePercent: launch.fees.creatorSharePercent ?? null,
      weth: chain.pons?.weth ?? null,
      tokenPriceUsd,
      ethUsd: (await getEthUsd().catch(() => null))?.usd ?? null,
      explorer: chain.explorer,
    });
  } catch (error) {
    return NextResponse.json({ error: error.message || "Could not read fee info." }, { status: 502 });
  }
}
