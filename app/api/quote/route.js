import { NextResponse } from "next/server";
import { Contract, formatEther, formatUnits, parseEther, parseUnits } from "ethers";
import { getChain, quote as quoteSwap, rpcProvider } from "@/lib/engine";
import { curveAt, resolveLaunch, resolvePonsPool, phaseBlockedMessage, quoteV4, v2Config } from "@/lib/engine/ponsV2";

/** A neutral recipient for read-only buy simulations on a curve. */
const QUOTE_RECIPIENT = "0x000000000000000000000000000000000000dEaD";

/** Curve reserves + total quote-leg fee (base fee + creator tax), as bigints. */
async function curveReservesAndFee(curve) {
  const [q, t] = await curve.getReserves();
  let feeBps = 0n, taxBps = 0n;
  try { feeBps = BigInt(await curve.feeBps()); } catch { /* default 0 */ }
  try { taxBps = BigInt(await curve.creatorTaxBps()); } catch { /* default 0 */ }
  return { q: BigInt(q), t: BigInt(t), fee: feeBps + taxBps };
}

/**
 * Quote a bonding-curve trade. A buy is priced by a read-only `buy` simulation
 * (exact, including any near-graduation clamp); a sell is estimated from the
 * curve's reserves (its spot price is quoteReserve/tokenReserve, i.e. a constant
 * product with a virtual quote reserve) net of the fee — the on-chain minOut
 * guards the fill either way.
 */
async function quoteCurve(provider, launch, side, amount, slippage) {
  const curve = curveAt(provider, launch.curve);
  const isBuy = side === "buy";
  let decimals = 18;
  let symbol = "TOKEN";
  try {
    const erc = new Contract(launch.token, ["function decimals() view returns (uint8)", "function symbol() view returns (string)"], provider);
    decimals = Number(await erc.decimals());
    symbol = await erc.symbol();
  } catch { /* keep defaults */ }

  const slippageBps = BigInt(Math.round(Math.min(50, Math.max(0.1, Number(slippage) || 5)) * 100));

  let amountIn, amountOut;
  if (isBuy) {
    amountIn = parseEther(String(amount));
    try {
      amountOut = BigInt(await curve.buy.staticCall(amountIn, 0n, QUOTE_RECIPIENT, { value: amountIn }));
    } catch {
      const { q, t, fee } = await curveReservesAndFee(curve);
      const inNet = (amountIn * (10_000n - fee)) / 10_000n;
      amountOut = (t * inNet) / (q + inNet);
    }
  } else {
    amountIn = parseUnits(String(amount), decimals);
    const { q, t, fee } = await curveReservesAndFee(curve);
    const grossOut = (q * amountIn) / (t + amountIn);
    amountOut = (grossOut * (10_000n - fee)) / 10_000n;
  }
  const minOut = (amountOut * (10_000n - slippageBps)) / 10_000n;

  const label = (raw, isEth) =>
    isEth
      ? `${Number(formatEther(raw)).toLocaleString("en-US", { maximumFractionDigits: 6 })} ETH`
      : `${Number(formatUnits(raw, decimals)).toLocaleString("en-US")} ${symbol}`;

  return {
    side,
    symbol,
    decimals,
    amountInRaw: amountIn.toString(),
    amountOutRaw: amountOut.toString(),
    minOutRaw: minOut.toString(),
    amountInLabel: label(amountIn, isBuy),
    amountOutLabel: label(amountOut, !isBuy),
    minOutLabel: label(minOut, !isBuy),
    slippagePercent: Number(slippage) || 5,
    poolFee: 0,
    venue: "curve",
  };
}

/** Quote a graduated launch on its Uniswap v4 pool via the V4 Quoter. */
async function quoteV4Payload(provider, chain, launch, side, amount, slippage) {
  const isBuy = side === "buy";
  let decimals = 18;
  let symbol = "TOKEN";
  try {
    const erc = new Contract(launch.token, ["function decimals() view returns (uint8)", "function symbol() view returns (string)"], provider);
    decimals = Number(await erc.decimals());
    symbol = await erc.symbol();
  } catch { /* defaults */ }
  const slippageBps = BigInt(Math.round(Math.min(50, Math.max(0.1, Number(slippage) || 5)) * 100));
  const amountIn = isBuy ? parseEther(String(amount)) : parseUnits(String(amount), decimals);
  const amountOut = await quoteV4(provider, chain, launch, side, amountIn);
  const minOut = (amountOut * (10_000n - slippageBps)) / 10_000n;
  const label = (raw, isEth) =>
    isEth
      ? `${Number(formatEther(raw)).toLocaleString("en-US", { maximumFractionDigits: 6 })} ETH`
      : `${Number(formatUnits(raw, decimals)).toLocaleString("en-US")} ${symbol}`;
  return {
    side,
    symbol,
    decimals,
    amountInRaw: amountIn.toString(),
    amountOutRaw: amountOut.toString(),
    minOutRaw: minOut.toString(),
    amountInLabel: label(amountIn, isBuy),
    amountOutLabel: label(amountOut, !isBuy),
    minOutLabel: label(minOut, !isBuy),
    slippagePercent: Number(slippage) || 5,
    poolFee: 0,
    venue: "v4",
  };
}

/** An RPC hiccup (rate-limit, batch coalesce, timeout) — not a real revert. */
const RPC_NOISE = /coalesce|UNKNOWN_ERROR|rate.?limit|429|503|timeout|ETIMEDOUT|ECONN|fetch failed|server response|SERVER_ERROR/i;

/**
 * Token decimals/symbol never change, so read them once per token — that removes
 * one RPC round-trip from every re-quote. And a full quote is cached for a few
 * seconds so re-opening the panel or toggling slippage is instant instead of
 * spinning on "Pricing…"; the pool barely moves in that window.
 */
const META_CACHE = new Map();
const QUOTE_CACHE = new Map();
const QUOTE_TTL_MS = Number(process.env.QUOTE_TTL_MS || 3500);

/**
 * POST /api/quote  { token, side: "buy"|"sell", amount, network }
 *
 * Quotes a swap through QuoterV2 so the UI can show the expected output before
 * anyone signs. Read-only — this spends nothing and grants no approval.
 */

const DECIMALS_ABI = ["function decimals() view returns (uint8)", "function symbol() view returns (string)"];

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Expected a JSON body." }, { status: 400 });
  }

  const { token, side = "buy", amount, network = "robinhood", slippage = 5 } = body || {};
  if (!token || !amount) {
    return NextResponse.json({ error: "Provide `token` and `amount`." }, { status: 400 });
  }

  let chain;
  try {
    chain = getChain(network);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  const { weth, quoter, poolFee } = chain.pons || {};
  if (!weth || !quoter) {
    return NextResponse.json(
      { error: "This network has no swap quoter configured." },
      { status: 400 }
    );
  }

  // Serve an identical recent quote straight from cache.
  const cacheKey = `${network}:${String(token).toLowerCase()}:${side}:${amount}:${slippage}`;
  const cachedQuote = QUOTE_CACHE.get(cacheKey);
  if (cachedQuote && Date.now() - cachedQuote.at < QUOTE_TTL_MS) {
    return NextResponse.json(cachedQuote.value);
  }

  // pons v2: a launched token trades on its bonding curve before graduation, and
  // a Uniswap v4 pool after. Route curve quotes here; fall through to the v1
  // Uniswap-v3 path only when this isn't a v2 launch.
  try {
    const v2Provider = rpcProvider(chain);
    const launch = await resolveLaunch(v2Provider, chain, token);
    if (launch) {
      if (launch.phase === 0) {
        const payload = await quoteCurve(v2Provider, launch, side, amount, slippage);
        QUOTE_CACHE.set(cacheKey, { at: Date.now(), value: payload });
        return NextResponse.json(payload);
      }
      if (launch.phase === 2 && v2Config(chain)?.v4Quoter) {
        const payload = await quoteV4Payload(v2Provider, chain, launch, side, amount, slippage);
        QUOTE_CACHE.set(cacheKey, { at: Date.now(), value: payload });
        return NextResponse.json(payload);
      }
      const msg = phaseBlockedMessage(launch.phase);
      return NextResponse.json(msg, { status: msg.retryable ? 503 : 400 });
    }
  } catch {
    /* not a resolvable v2 launch — fall through to the Pons / v1 paths below */
  }

  // Pons launches trade on an ordinary Uniswap v4 pool (with Pons's own hook).
  // Discover it from the pool's Initialize event and quote it via the V4 Quoter,
  // the same code path graduated pons pools use.
  try {
    const v4Provider = rpcProvider(chain);
    const pons = await resolvePonsPool(v4Provider, chain, token, chain.explorer);
    if (pons && v2Config(chain)?.v4Quoter) {
      const payload = await quoteV4Payload(v4Provider, chain, pons, side, amount, slippage);
      QUOTE_CACHE.set(cacheKey, { at: Date.now(), value: payload });
      return NextResponse.json(payload);
    }
  } catch {
    /* no Pons v4 pool (or its quote reverted) — fall through to the v1 path */
  }

  try {
    const provider = rpcProvider(chain);

    let decimals = 18;
    let symbol = "TOKEN";
    const cachedMeta = META_CACHE.get(String(token).toLowerCase());
    if (cachedMeta) {
      decimals = cachedMeta.decimals;
      symbol = cachedMeta.symbol;
    } else {
      try {
        const meta = new Contract(token, DECIMALS_ABI, provider);
        decimals = Number(await meta.decimals());
        symbol = await meta.symbol();
        META_CACHE.set(String(token).toLowerCase(), { decimals, symbol });
      } catch {
        /* keep the 18/TOKEN defaults — a quote is still useful without metadata */
      }
    }

    const isBuy = side === "buy";
    const amountIn = isBuy
      ? parseEther(String(amount))
      : parseUnits(String(amount), decimals);

    const result = await quoteSwap(provider, quoter, {
      tokenIn: isBuy ? weth : token,
      tokenOut: isBuy ? token : weth,
      amountIn,
      fee: poolFee,
    });

    if (!result.ok) {
      // Tell an RPC hiccup apart from a real "the pool refuses this trade". The
      // public node rate-limits, and ethers reports that as "could not coalesce
      // error" — which is retryable, not a honeypot. Don't cry wolf on a sell.
      if (RPC_NOISE.test(result.reason || "")) {
        return NextResponse.json(
          {
            error: "The network node is busy right now — try again in a moment.",
            hint: "This is a temporary RPC hiccup, not a problem with the token.",
            retryable: true,
          },
          { status: 503 }
        );
      }
      return NextResponse.json(
        {
          error: `The pool could not quote this trade: ${result.reason}`,
          hint: isBuy
            ? "Liquidity may be too thin for this size."
            : "A sell that cannot even be quoted is the classic honeypot signature — run the audit.",
        },
        { status: 400 }
      );
    }

    const amountOut = result.amountOut;

    // The floor the UI shows. It used to be absent from this response entirely,
    // so the "minimum out" tile read "—" on every quote — the one figure that
    // says how bad the fill is allowed to get.
    const slippageBps = BigInt(
      Math.round(Math.min(50, Math.max(0.1, Number(slippage) || 5)) * 100)
    );
    const minOut = (amountOut * (10_000n - slippageBps)) / 10_000n;

    const label = (raw, isEth) =>
      isEth
        ? `${Number(formatEther(raw)).toLocaleString("en-US", { maximumFractionDigits: 6 })} ETH`
        : `${Number(formatUnits(raw, decimals)).toLocaleString("en-US")} ${symbol}`;

    const payload = {
      side,
      symbol,
      decimals,
      amountInRaw: amountIn.toString(),
      amountOutRaw: amountOut.toString(),
      minOutRaw: minOut.toString(),
      amountInLabel: label(amountIn, isBuy),
      amountOutLabel: label(amountOut, !isBuy),
      minOutLabel: label(minOut, !isBuy),
      slippagePercent: Number(slippage) || 5,
      poolFee,
    };
    QUOTE_CACHE.set(cacheKey, { at: Date.now(), value: payload });
    return NextResponse.json(payload);
  } catch (error) {
    console.error("Quote failed:", error);
    return NextResponse.json({ error: error.message || "Quote failed." }, { status: 502 });
  }
}
