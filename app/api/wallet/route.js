import { NextResponse } from "next/server";
import { formatUnits, getAddress, isAddress } from "ethers";
import { deriveAddress, getChain, nativeBalance, tokenBalance, tokenMeta, rpcProvider } from "@/lib/engine";
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
 * Hard cap on any single RPC read. The public Robinhood RPC rate-limits and can
 * hang; without a cap the whole function waits until Vercel's timeout and
 * returns a 5xx (the "/api/wallet function timeouts" anomaly). With it, a slow
 * RPC becomes a fast, graceful response — the last known balance, or a clean
 * note — never a crash.
 */
const RPC_TIMEOUT_MS = Number(process.env.WALLET_RPC_TIMEOUT_MS || 6000);

function raceTimeout(promise, ms) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error("the RPC did not respond in time")), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

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

  const balanceKey = `${network}:${address.toLowerCase()}`;
  const tokenParam = url.searchParams.get("token");
  const wantToken = tokenParam && isAddress(tokenParam);

  // Read the native balance and (optionally) the token balance IN PARALLEL, each
  // time-boxed. A slow RPC then costs one ~6s wait, not two, and never a 5xx.
  const balanceJob = (async () => {
    const cached = BALANCE_CACHE.get(balanceKey);
    if (cached && Date.now() - cached.at < BALANCE_TTL_MS) return { value: cached.value };
    try {
      const value = await raceTimeout(nativeBalance(address, chain), RPC_TIMEOUT_MS);
      BALANCE_CACHE.set(balanceKey, { at: Date.now(), value });
      return { value };
    } catch (error) {
      // Serve the last known balance if we have one, rather than nothing.
      return {
        value: cached ? cached.value : null,
        error: `Could not read the balance right now — the network node is busy. ${error.message}`,
      };
    }
  })();

  const tokenJob = wantToken
    ? (async () => {
        try {
          const provider = rpcProvider(chain);
          const [raw, meta] = await raceTimeout(
            Promise.all([tokenBalance(provider, tokenParam, address), tokenMeta(provider, tokenParam)]),
            RPC_TIMEOUT_MS
          );
          return {
            token: getAddress(tokenParam),
            raw: raw.toString(),
            formatted: formatUnits(raw, meta.decimals),
            symbol: meta.symbol,
            name: meta.name || null,
            decimals: meta.decimals,
          };
        } catch {
          /* a token balance is a nice-to-have; never fail the wallet read over it */
          return null;
        }
      })()
    : Promise.resolve(null);

  const [balanceResult, token] = await Promise.all([balanceJob, tokenJob]);

  return NextResponse.json({
    address,
    handle: session.username,
    name: session.name,
    avatar: session.avatar,
    chain: chain.name,
    chainId: chain.chainId,
    explorer: chain.explorer,
    gasSymbol: chain.gasSymbol,
    balance: balanceResult.value,
    balanceError: balanceResult.error || null,
    token,
  });
}
