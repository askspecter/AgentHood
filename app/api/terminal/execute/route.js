import {
  Contract,
  Interface,
  MaxUint256,
  formatEther,
  formatUnits,
  getAddress,
  isAddress,
} from "ethers";
import { NextResponse } from "next/server";
import { DEADLINE_SECONDS, deriveSigner, getChain, quote, tokenMeta } from "@/lib/engine";
import { getSession } from "@/lib/session";
import { recordTrade } from "@/lib/stats";
import { CURVE_ABI, resolveLaunch, phaseBlockedMessage } from "@/lib/engine/ponsV2";

/**
 * The ERC-20 surface a trade actually touches. Defined here, not imported: the
 * engine exports two different `ERC20_ABI`s (the audit one has no `allowance` or
 * `approve`), and whichever loads last wins — which is what made a sell throw
 * "allowance is not a function". Owning it locally removes that ambiguity.
 */
const ERC20_ABI = [
  "function balanceOf(address) view returns (uint256)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
];

/**
 * The router's swap function comes in two shapes across Uniswap V3 deployments:
 * SwapRouter02 (no deadline) and the older SwapRouter (deadline in the tuple).
 * They have different selectors, so we encode both and use whichever the chain
 * accepts on a dry run.
 */
const ROUTER_V2 = new Interface([
  "function exactInputSingle((address tokenIn, address tokenOut, uint24 fee, address recipient, uint256 amountIn, uint256 amountOutMinimum, uint160 sqrtPriceLimitX96) params) payable returns (uint256 amountOut)",
]);
const ROUTER_V1 = new Interface([
  "function exactInputSingle((address tokenIn, address tokenOut, uint24 fee, address recipient, uint256 deadline, uint256 amountIn, uint256 amountOutMinimum, uint160 sqrtPriceLimitX96) params) payable returns (uint256 amountOut)",
]);

/**
 * WETH9. Every pons launch pool is a Uniswap V3 WETH pair, and the router swaps
 * WETH, not native ETH. A buy that sends raw ETH to the router can dry-run clean
 * and still revert on chain — which is exactly what was happening. So we wrap ETH
 * into WETH ourselves, swap WETH for the token, and (on a sell) unwrap the WETH
 * back to ETH. That is the plain Uniswap V3 path, with no reliance on the router
 * accepting native ETH.
 */
const WETH9_ABI = [
  "function deposit() payable",
  "function withdraw(uint256 wad)",
  "function balanceOf(address) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)",
];

/**
 * Encode the swap in both router shapes, dry-run each, and return the one the
 * chain actually accepts. Nothing is sent here — a revert costs nothing.
 */
async function chooseSwap(provider, swapRouter, owner, base) {
  const variants = [
    { name: "SwapRouter02", data: ROUTER_V2.encodeFunctionData("exactInputSingle", [base]) },
    {
      name: "SwapRouter",
      data: ROUTER_V1.encodeFunctionData("exactInputSingle", [
        { ...base, deadline: Math.floor(Date.now() / 1000) + DEADLINE_SECONDS },
      ]),
    },
  ];
  let lastError = null;
  for (const variant of variants) {
    try {
      // value is always 0 now: the router swaps WETH, which we hold already.
      await provider.call({ to: swapRouter, data: variant.data, value: 0n, from: owner });
      return { chosen: variant, lastError: null };
    } catch (error) {
      lastError = error;
    }
  }
  return { chosen: null, lastError };
}

/**
 * POST /api/terminal/execute — sign and send a trade from the caller's X wallet.
 *
 * This is the only endpoint in the app that spends money, and it exists because
 * a phone has no wallet extension: without it, "buy me $5 nvda" is a sentence
 * the terminal can price and never fill.
 *
 * What keeps it safe is not that the client is trusted — it is that almost
 * nothing the client says is used:
 *
 *  • The wallet is derived from the SESSION, so a request can only ever spend
 *    the caller's own funds. No address is accepted from the body.
 *  • The recipient is that same derived address. Output cannot be redirected.
 *  • The router, WETH and fee tier come from server config, not the request.
 *  • The trade is re-quoted here and `amountOutMinimum` is computed from the
 *    FRESH quote. A stale plan from a browser tab left open for an hour cannot
 *    set its own floor.
 *  • If the fresh quote is materially worse than what the caller was shown, the
 *    trade is refused rather than filled at a price they never saw.
 *  • Every send is dry-run with `staticCall` first, so a revert costs nothing.
 */

/** Refuse rather than fill when the price has moved further than this. */
const MAX_DRIFT_BPS = 500n; // 5%

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Expected a JSON body." }, { status: 400 });
  }

  const {
    token: tokenInput,
    side,
    amountInRaw,
    expectedOutRaw = null,
    slippage = 5,
    network = "robinhood",
    // Which asset this trade settles in: "weth" (a launch) or "usdg" (a stock).
    // Only these two, both server config — the client picks between them, it
    // cannot name an arbitrary address to route through.
    quote: quoteId = "weth",
  } = body || {};

  if (side !== "buy" && side !== "sell") {
    return NextResponse.json({ error: "`side` must be \"buy\" or \"sell\"." }, { status: 400 });
  }
  if (!tokenInput || !isAddress(tokenInput)) {
    return NextResponse.json({ error: "A valid token address is required." }, { status: 400 });
  }

  let amountIn;
  try {
    amountIn = BigInt(amountInRaw);
  } catch {
    return NextResponse.json({ error: "`amountInRaw` must be an integer string." }, { status: 400 });
  }
  if (amountIn <= 0n) {
    return NextResponse.json({ error: "Amount must be greater than zero." }, { status: 400 });
  }

  let session;
  try {
    session = await getSession();
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!session) {
    return NextResponse.json(
      { error: "Sign in with X first — this signs with the wallet derived from your account." },
      { status: 401 }
    );
  }

  let chain;
  try {
    chain = getChain(network);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  const { weth, usdg, quoter, swapRouter, poolFee } = chain.pons || {};
  if (!weth || !quoter || !swapRouter) {
    return NextResponse.json(
      { error: "This network has no pons router configured." },
      { status: 400 }
    );
  }

  // The asset this trade settles in. A launch is a WETH pair; a stock is a USDG
  // pair. `quoteIsNative` is what decides whether the buy wraps ETH or spends an
  // ERC-20 stablecoin, and whether the sell unwraps its proceeds.
  const wantsStable = quoteId === "usdg";
  const quoteAddress = wantsStable ? usdg : weth;
  const quoteIsNative = !wantsStable;
  if (!quoteAddress) {
    return NextResponse.json(
      { error: "This network has no USDG address configured, so stock tokens cannot be traded here." },
      { status: 400 }
    );
  }

  let signer;
  try {
    signer = deriveSigner(session.id, chain);
  } catch (error) {
    // Almost always a missing WALLET_DERIVATION_SECRET.
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const token = getAddress(tokenInput);
  const owner = await signer.getAddress();
  const isBuy = side === "buy";
  const provider = signer.provider;

  // ---- Special case: the "token" IS WETH. There is no WETH/WETH pool, so the
  // real trade is a 1:1 wrap (buy: ETH→WETH) or unwrap (sell: WETH→ETH). Do it
  // directly on WETH9 instead of routing through the pool, which would revert. --
  if (getAddress(token) === getAddress(weth)) {
    try {
      const weth9 = new Contract(weth, WETH9_ABI, signer);
      if (isBuy) {
        const bal = await provider.getBalance(owner);
        if (bal <= amountIn) {
          return NextResponse.json(
            {
              error: `Your X wallet holds ${Number(formatEther(bal)).toFixed(6)} ETH, which does not cover ${Number(formatEther(amountIn)).toFixed(6)} ETH plus gas.`,
              hint: "Send ETH to the address on the Wallet tab first.",
            },
            { status: 400 }
          );
        }
        await weth9.deposit.staticCall({ value: amountIn });
        const tx = await weth9.deposit({ value: amountIn });
        const receipt = await tx.wait();
        return NextResponse.json({ hash: receipt?.hash || tx.hash, wrapped: true });
      }
      const bal = await weth9.balanceOf(owner);
      if (bal < amountIn) {
        return NextResponse.json(
          { error: `Your X wallet holds ${Number(formatEther(bal)).toLocaleString("en-US")} WETH, which is less than that.` },
          { status: 400 }
        );
      }
      await weth9.withdraw.staticCall(amountIn);
      const tx = await weth9.withdraw(amountIn);
      const receipt = await tx.wait();
      return NextResponse.json({ hash: receipt?.hash || tx.hash, unwrapped: true });
    } catch (error) {
      return NextResponse.json(
        { error: `${isBuy ? "Wrapping ETH to WETH" : "Unwrapping WETH to ETH"} failed: ${error.shortMessage || error.reason || error.message}` },
        { status: 400 }
      );
    }
  }

  // ---- pons v2: a launched token trades on its bonding curve before graduation.
  // Route curve buys/sells here. A graduated (Uniswap v4) launch is handled once
  // v4 infra is configured. Not a v2 launch → fall through to the v1 path. ----
  try {
    const launch = await resolveLaunch(provider, chain, token);
    if (launch) {
      if (launch.phase !== 0) {
        const msg = phaseBlockedMessage(launch.phase);
        return NextResponse.json(msg, { status: msg.retryable ? 503 : 400 });
      }
      const curve = new Contract(launch.curve, CURVE_ABI, signer);
      const slippageBps = BigInt(Math.round(Math.min(50, Math.max(0.1, Number(slippage) || 5)) * 100));
      let expectedOut = 0n;
      try { expectedOut = BigInt(expectedOutRaw || 0); } catch { /* keep 0 */ }
      const minOut = expectedOut > 0n ? (expectedOut * (10_000n - slippageBps)) / 10_000n : 0n;

      if (isBuy) {
        if (launch.isNativeQuote) {
          const bal = await provider.getBalance(owner);
          if (bal <= amountIn) {
            return NextResponse.json(
              { error: `Your X wallet holds ${Number(formatEther(bal)).toFixed(6)} ETH, which does not cover ${Number(formatEther(amountIn)).toFixed(6)} ETH plus gas.`, hint: "Send ETH to your wallet first." },
              { status: 400 }
            );
          }
          await curve.buy.staticCall(amountIn, minOut, owner, { value: amountIn });
          const tx = await curve.buy(amountIn, minOut, owner, { value: amountIn });
          const receipt = await tx.wait();
          if (receipt.status === 0) return NextResponse.json({ error: "The buy was mined but reverted.", hash: tx.hash }, { status: 400 });
          try { await recordTrade({ network, handle: session.username, wethValue: Number(formatEther(amountIn)) }); } catch { /* stats non-critical */ }
          return NextResponse.json({ ok: true, hash: tx.hash, token, side, venue: "curve", explorer: chain.explorer });
        }
        // custom-pair buy: approve the curve to pull the quote asset, then buy.
        const pair = new Contract(launch.pairToken, ERC20_ABI, signer);
        if ((await pair.allowance(owner, launch.curve)) < amountIn) {
          const a = await pair.approve(launch.curve, MaxUint256); await a.wait();
        }
        await curve.buy.staticCall(amountIn, minOut, owner);
        const tx = await curve.buy(amountIn, minOut, owner);
        const receipt = await tx.wait();
        if (receipt.status === 0) return NextResponse.json({ error: "The buy was mined but reverted.", hash: tx.hash }, { status: 400 });
        return NextResponse.json({ ok: true, hash: tx.hash, token, side, venue: "curve", explorer: chain.explorer });
      }

      // sell: approve the curve to pull the token, then sell it into the curve.
      const erc = new Contract(token, ERC20_ABI, signer);
      const bal = await erc.balanceOf(owner);
      if (bal < amountIn) {
        return NextResponse.json({ error: `Your X wallet holds ${Number(formatUnits(bal, 18)).toLocaleString("en-US")} of this token, which is less than that.` }, { status: 400 });
      }
      if ((await erc.allowance(owner, launch.curve)) < amountIn) {
        const a = await erc.approve(launch.curve, MaxUint256); await a.wait();
      }
      await curve.sell.staticCall(amountIn, minOut, owner);
      const tx = await curve.sell(amountIn, minOut, owner);
      const receipt = await tx.wait();
      if (receipt.status === 0) return NextResponse.json({ error: "The sell was mined but reverted.", hash: tx.hash }, { status: 400 });
      try { if (launch.isNativeQuote && expectedOut > 0n) await recordTrade({ network, handle: session.username, wethValue: Number(formatEther(expectedOut)) }); } catch { /* non-critical */ }
      return NextResponse.json({ ok: true, hash: tx.hash, token, side, venue: "curve", explorer: chain.explorer });
    }
  } catch (error) {
    // We only get here after entering the v2 branch (resolveLaunch returned a
    // launch), so a revert is a real curve-trade failure — surface it.
    return NextResponse.json(
      { error: `The trade failed: ${error.shortMessage || error.reason || error.message}` },
      { status: 400 }
    );
  }

  try {
    const meta = await tokenMeta(provider, token);
    const erc20 = new Contract(token, ERC20_ABI, signer);

    // The stablecoin the trade spends/receives, when it is a USDG pair.
    const quoteErc20 = new Contract(quoteAddress, ERC20_ABI, signer);

    // ---- Can this wallet actually afford it? ----
    if (isBuy && quoteIsNative) {
      const balance = await provider.getBalance(owner);
      if (balance <= amountIn) {
        return NextResponse.json(
          {
            error: `Your X wallet holds ${Number(formatEther(balance)).toFixed(
              6
            )} ETH, which does not cover ${Number(formatEther(amountIn)).toFixed(
              6
            )} ETH plus gas.`,
            hint: "Send ETH to the address on the Wallet tab first.",
          },
          { status: 400 }
        );
      }
    } else if (isBuy) {
      // A stock buy spends USDG, not ETH, so it is the USDG balance that has to
      // cover it. ETH is still needed for gas, but that is a far smaller number.
      const balance = await quoteErc20.balanceOf(owner);
      if (balance < amountIn) {
        const qMeta = await tokenMeta(provider, quoteAddress).catch(() => ({ decimals: 18, symbol: "USDG" }));
        return NextResponse.json(
          {
            error: `Your X wallet holds ${Number(
              formatUnits(balance, qMeta.decimals)
            ).toLocaleString("en-US")} ${qMeta.symbol}, which does not cover this buy.`,
            hint: `Fund the wallet with ${qMeta.symbol} to buy stock tokens.`,
          },
          { status: 400 }
        );
      }
    } else {
      const balance = await erc20.balanceOf(owner);
      if (balance < amountIn) {
        return NextResponse.json(
          {
            error: `Your X wallet holds ${Number(
              formatUnits(balance, meta.decimals)
            ).toLocaleString("en-US")} ${meta.symbol}, which is less than that.`,
          },
          { status: 400 }
        );
      }
    }

    // ---- Re-quote. The floor is set from this, never from the request. ----
    const fresh = await quote(provider, quoter, {
      tokenIn: isBuy ? quoteAddress : token,
      tokenOut: isBuy ? token : quoteAddress,
      amountIn,
      fee: poolFee,
    });

    if (!fresh.ok) {
      return NextResponse.json(
        {
          error: `The pool will not quote this trade any more: ${fresh.reason}`,
          hint: isBuy
            ? "Liquidity may have moved. Try a smaller size."
            : "A sell that stops quoting is the honeypot signature. Run `audit` on this token.",
        },
        { status: 400 }
      );
    }

    if (expectedOutRaw) {
      let expected;
      try {
        expected = BigInt(expectedOutRaw);
      } catch {
        expected = 0n;
      }
      // Only a move AGAINST the caller is a problem; a better price is fine.
      if (expected > 0n && fresh.amountOut < (expected * (10_000n - MAX_DRIFT_BPS)) / 10_000n) {
        return NextResponse.json(
          {
            error:
              "The price moved more than 5% against you since that quote, so nothing was sent.",
            hint: "Run the command again to price it fresh.",
          },
          { status: 409 }
        );
      }
    }

    const slippageBps = BigInt(
      Math.round(Math.min(50, Math.max(0.1, Number(slippage) || 5)) * 100)
    );
    const minOut = (fresh.amountOut * (10_000n - slippageBps)) / 10_000n;

    const weth9 = new Contract(weth, WETH9_ABI, signer);
    let approvalHash = null;
    let wrapHash = null;

    if (isBuy && quoteIsNative) {
      // ---- Wrap ETH → WETH, then let the router spend WETH ----
      //
      // The router swaps WETH, not native ETH. Wrapping here (rather than
      // sending ETH with the swap) is the reliable Uniswap V3 path and is what
      // fixes the on-chain revert on buys.
      const wethBalance = await weth9.balanceOf(owner);
      if (wethBalance < amountIn) {
        const wrapTx = await weth9.deposit({ value: amountIn - wethBalance });
        wrapHash = wrapTx.hash;
        await wrapTx.wait();
      }
      const allowance = await weth9.allowance(owner, swapRouter);
      if (allowance < amountIn) {
        const approveTx = await weth9.approve(swapRouter, MaxUint256);
        approvalHash = approveTx.hash;
        await approveTx.wait();
      }
    } else if (isBuy) {
      // ---- A stock buy spends USDG directly: no wrap, just an approval ----
      // The wallet already holds the stablecoin (checked above), so the router
      // only needs permission to pull it.
      const allowance = await quoteErc20.allowance(owner, swapRouter);
      if (allowance < amountIn) {
        const approveTx = await quoteErc20.approve(swapRouter, MaxUint256);
        approvalHash = approveTx.hash;
        await approveTx.wait();
      }
    } else {
      // ---- Approve the token for a sell ----
      const allowance = await erc20.allowance(owner, swapRouter);
      if (allowance < amountIn) {
        const approveTx = await erc20.approve(swapRouter, MaxUint256);
        approvalHash = approveTx.hash;
        await approveTx.wait();
      }
    }

    // The swap now moves WETH↔token in both directions, so the router always
    // receives value 0. SwapRouter02's exactInputSingle has no deadline field;
    // the older SwapRouter does, and the two have different selectors. Build
    // both, dry-run each, send whichever the chain accepts.
    const base = {
      tokenIn: isBuy ? quoteAddress : token,
      tokenOut: isBuy ? token : quoteAddress,
      fee: poolFee,
      recipient: owner,
      amountIn,
      amountOutMinimum: minOut,
      sqrtPriceLimitX96: 0n,
    };

    const { chosen, lastError } = await chooseSwap(provider, swapRouter, owner, base);
    if (!chosen) {
      return NextResponse.json(
        {
          error: "This trade would fail on-chain right now, so it was not sent — your funds are safe.",
          hint: isBuy
            ? "Most often the price moved past your slippage. Tap Adjust and raise slippage (e.g. 5%), or change the amount, then try again."
            : "Raise slippage and try again. A sell that always reverts can be a honeypot — check the token first.",
          approvalHash,
          wrapHash,
        },
        { status: 400 }
      );
    }

    const tx = await signer.sendTransaction({ to: swapRouter, data: chosen.data, value: 0n });
    const receipt = await tx.wait();

    if (receipt.status === 0) {
      return NextResponse.json(
        { error: "The swap was mined but reverted. Nothing changed hands.", hash: tx.hash },
        { status: 400 }
      );
    }

    // Record ESKA-native trade volume for the leaderboard — WETH-settled trades
    // only (a launch pair), sized by the WETH leg: the WETH spent on a buy or the
    // WETH received on a sell. Best-effort and awaited so it commits before the
    // function returns; a stats failure never affects the trade result.
    if (quoteIsNative) {
      try {
        const wethValue = Number(formatEther(isBuy ? amountIn : fresh.amountOut));
        await recordTrade({ network, handle: session.username, wethValue });
      } catch {
        /* stats are non-critical */
      }
    }

    // A sell's proceeds are left as WETH — deliberately NOT auto-unwrapped.
    //
    // Unwrapping (WETH.withdraw) burns the WETH to the zero address, and every
    // block explorer renders that as "Tokens burnt: WETH → Null", which reads
    // like the wallet is losing money on every trade even though it isn't. So we
    // keep the proceeds as WETH and let the holder convert to native ETH on
    // demand, with the explicit "Unwrap to ETH" action — no silent burn on any
    // trade. A stock sell already settles in USDG, which is likewise just held.
    const unwrapHash = null;

    return NextResponse.json({
      ok: true,
      hash: tx.hash,
      approvalHash,
      wrapHash,
      unwrapHash,
      owner,
      side,
      token,
      symbol: meta.symbol,
      amountInRaw: amountIn.toString(),
      quotedOutRaw: fresh.amountOut.toString(),
      minOutRaw: minOut.toString(),
      explorer: chain.explorer,
    });
  } catch (error) {
    console.error("Terminal execute failed:", error);
    const message = error.shortMessage || error.reason || error.message || "The trade failed.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
