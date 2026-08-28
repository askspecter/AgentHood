import { NextResponse } from "next/server";
import { getAddress } from "ethers";
import { deriveAddress, getChain } from "@/lib/engine";
import { getSession } from "@/lib/session";
import { isConfigured, deployToken } from "@/lib/bankr";

/**
 * POST /api/launch/bankr — deploy a token through Bankr on Robinhood Chain.
 *
 * The client sends the coin's identity; the server sets the fee recipient to the
 * caller's own AURN wallet (so creator fees flow to them) and calls Bankr. Bankr
 * seeds a Uniswap V4 pool on Robinhood Chain, so the coin is tradeable at once.
 */
export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Expected a JSON body." }, { status: 400 });
  }

  const {
    name,
    symbol,
    logo = "",
    tweet = "",
    website = "",
    network = "robinhood",
    disableVesting = false,
    quoteOnlyFees = false,
    pairedStock = "",
  } = body || {};
  if (!name) {
    return NextResponse.json({ error: "A token name is required." }, { status: 400 });
  }

  let session;
  try {
    session = await getSession();
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!session) {
    return NextResponse.json({ error: "Sign in with X first." }, { status: 401 });
  }

  if (!isConfigured()) {
    return NextResponse.json(
      { error: "Launching isn't set up yet — the Bankr API key is missing.", code: "bankr_not_configured" },
      { status: 400 }
    );
  }

  // The creator's AURN wallet — creator fees are routed here.
  let wallet;
  try {
    wallet = getAddress(deriveAddress(session.id));
  } catch (error) {
    return NextResponse.json({ error: "Wallets are not configured on this deployment." }, { status: 500 });
  }

  // Keep the chain on Robinhood (Bankr's default), ignoring any client value.
  try {
    getChain(network);
  } catch {
    /* network is cosmetic here — Bankr deploys to Robinhood Chain */
  }

  try {
    const { raw, token } = await deployToken({
      tokenName: name,
      tokenSymbol: symbol,
      feeRecipient: { type: "wallet", value: wallet },
      image: logo || undefined,
      tweet: tweet || undefined,
      website: website || undefined,
      chain: "robinhood",
      disableVesting: Boolean(disableVesting),
      quoteOnlyFees: Boolean(quoteOnlyFees),
      pairedStock: pairedStock ? String(pairedStock).trim() : undefined,
    });

    return NextResponse.json({
      ok: true,
      token,
      owner: wallet,
      pool: raw?.pool || raw?.poolMetadata || raw?.poolKey || null,
      pairedStock: pairedStock ? String(pairedStock).trim().toUpperCase() : null,
      chainId: raw?.chainId ?? null,
      hash: raw?.transactionHash || raw?.txHash || null,
      raw,
    });
  } catch (error) {
    return NextResponse.json({ error: error.message || "The launch failed." }, { status: 502 });
  }
}
