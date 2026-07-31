import { NextResponse } from "next/server";
import { Contract, formatEther, formatUnits, parseEther, parseUnits } from "ethers";
import { getChain, quote as quoteSwap, rpcProvider } from "@/lib/engine";

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
      { error: "This network has no pons quoter configured." },
      { status: 400 }
    );
  }

  // Serve an identical recent quote straight from cache.
  const cacheKey = `${network}:${String(token).toLowerCase()}:${side}:${amount}:${slippage}`;
  const cachedQuote = QUOTE_CACHE.get(cacheKey);
  if (cachedQuote && Date.now() - cachedQuote.at < QUOTE_TTL_MS) {
    return NextResponse.json(cachedQuote.value);
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
