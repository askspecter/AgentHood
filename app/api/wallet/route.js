import { NextResponse } from "next/server";
import { JsonRpcProvider, formatUnits, getAddress, isAddress } from "ethers";
import { deriveAddress, getChain, nativeBalance, tokenBalance, tokenMeta } from "@/lib/engine";
import { getSession } from "@/lib/session";

/**
 * Short-lived native-balance cache, keyed by network:address.
 *
 * The balance is the first thing the app reads on every load and every Profile
 * refresh, and a public RPC's getBalance is slow. A few seconds of caching makes
 * the second read instant without ever showing a stale figure for long — the
 * balance only moves when the user trades or sends, both of which take longer
 * than this TTL to confirm anyway.
 */
const BALANCE_CACHE = new Map();
const BALANCE_TTL_MS = Number(process.env.WALLET_BALANCE_TTL_MS || 12_000);

/**
 * GET /api/wallet?network=robinhood[&token=0x…]
 *
 * The signed-in user's X-derived wallet: address and native balance. Pass a
 * `token` to also get that token's balance, which is what the Trade panel shows
 * next to the amount field. The private key is never included here — that
 * requires the explicit export endpoint.
 */
export async function GET(request) {
  const url = new URL(request.url);
  const network = url.searchParams.get("network") || "robinhood";

  let session;
  try {
    session = await getSession();
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!session) {
    return NextResponse.json({ error: "Sign in with X first." }, { status: 401 });
  }

  let chain;
  try {
    chain = getChain(network);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  let address;
  try {
    address = deriveAddress(session.id);
  } catch (error) {
    // Almost always a missing (or too-short) WALLET_DERIVATION_SECRET. The raw
    // message is a developer note with shell commands in it; the client gets a
    // clean one plus a code it can render as a setup hint.
    const missingSecret = /WALLET_DERIVATION_SECRET/.test(error.message || "");
    return NextResponse.json(
      {
        error: missingSecret
          ? "Wallets are not set up on this deployment yet."
          : error.message,
        code: missingSecret ? "wallet_not_configured" : "wallet_error",
        missing: missingSecret ? ["WALLET_DERIVATION_SECRET"] : [],
      },
      { status: 500 }
    );
  }

  let balance = null;
  let balanceError = null;
  const balanceKey = `${network}:${address.toLowerCase()}`;
  const cachedBalance = BALANCE_CACHE.get(balanceKey);
  if (cachedBalance && Date.now() - cachedBalance.at < BALANCE_TTL_MS) {
    balance = cachedBalance.value;
  } else {
    try {
      balance = await nativeBalance(address, chain);
      BALANCE_CACHE.set(balanceKey, { at: Date.now(), value: balance });
    } catch (error) {
      balanceError = `Could not read the balance: ${error.message}`;
    }
  }

  // Optional: the balance of one specific token, for the Trade panel.
  let token = null;
  const tokenParam = url.searchParams.get("token");
  if (tokenParam && isAddress(tokenParam)) {
    try {
      const provider = new JsonRpcProvider(chain.rpc, chain.chainId);
      const [raw, meta] = await Promise.all([
        tokenBalance(provider, tokenParam, address),
        tokenMeta(provider, tokenParam),
      ]);
      token = {
        token: getAddress(tokenParam),
        raw: raw.toString(),
        formatted: formatUnits(raw, meta.decimals),
        symbol: meta.symbol,
        name: meta.name || null,
        decimals: meta.decimals,
      };
    } catch {
      /* a token balance is a nice-to-have; never fail the wallet read over it */
    }
  }

  return NextResponse.json({
    address,
    handle: session.username,
    name: session.name,
    avatar: session.avatar,
    chain: chain.name,
    chainId: chain.chainId,
    explorer: chain.explorer,
    gasSymbol: chain.gasSymbol,
    balance,
    balanceError,
    token,
  });
}
