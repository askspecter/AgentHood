import {
  Contract,
  Interface,
  JsonRpcProvider,
  MaxUint256,
  formatEther,
  formatUnits,
  getAddress,
  isAddress,
} from "ethers";
import { NextResponse } from "next/server";
import { DEADLINE_SECONDS, getChain, quote, tokenMeta } from "@/lib/engine";
import {
  CURVE_ABI,
  PERMIT2_ABI,
  UNIVERSAL_ROUTER_ABI,
  buildV4Swap,
  phaseBlockedMessage,
  resolveBankrPool,
  resolveLaunch,
  v2Config,
} from "@/lib/engine/ponsV2";

/**
 * POST /api/terminal/build — NON-CUSTODIAL trade builder.
 *
 * The custodial /api/terminal/execute derived a wallet from the X session and
 * signed server-side. This route signs nothing: it resolves the token's venue
 * (WETH wrap · v2 curve · graduated/Bankr Uniswap v4 · v1 Uniswap v3 pool) and
 * returns the ORDERED list of unsigned transactions {to, data, value}. The
 * caller's own wallet (wagmi) signs each step in turn — approvals first, swap
 * last — so the same multi-venue engine now works with RainbowKit.
 *
 * Nothing here spends funds; every address/router/fee is server config, and the
 * recipient is always the caller's own `owner`.
 */

const ERC20_ABI = [
  "function balanceOf(address) view returns (uint256)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
];
const WETH9_ABI = [
  "function deposit() payable",
  "function withdraw(uint256 wad)",
  "function balanceOf(address) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)",
];
const ERC20_IFACE = new Interface(ERC20_ABI);
const WETH9_IFACE = new Interface(WETH9_ABI);
const CURVE_IFACE = new Interface(CURVE_ABI);
const UR_IFACE = new Interface(UNIVERSAL_ROUTER_ABI);
const PERMIT2_IFACE = new Interface(PERMIT2_ABI);

// SwapRouter02 (no deadline) vs the older SwapRouter (deadline in the tuple).
const ROUTER_V2 = new Interface([
  "function exactInputSingle((address tokenIn, address tokenOut, uint24 fee, address recipient, uint256 amountIn, uint256 amountOutMinimum, uint160 sqrtPriceLimitX96) params) payable returns (uint256 amountOut)",
]);
const ROUTER_V1 = new Interface([
  "function exactInputSingle((address tokenIn, address tokenOut, uint24 fee, address recipient, uint256 deadline, uint256 amountIn, uint256 amountOutMinimum, uint160 sqrtPriceLimitX96) params) payable returns (uint256 amountOut)",
]);

const s = (v) => (v == null ? "0" : v.toString());
const step = (to, data, value = 0n, kind = "swap", label = "") => ({ to: getAddress(to), data, value: s(value), kind, label });

function slippageBpsOf(slippage) {
  return BigInt(Math.round(Math.min(50, Math.max(0.1, Number(slippage) || 5)) * 100));
}

export async function POST(request) {
  let body;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Expected a JSON body." }, { status: 400 }); }

  const {
    token: tokenInput,
    owner: ownerInput,
    side,
    amountInRaw,
    expectedOutRaw = null,
    slippage = 5,
    network = "robinhood",
    quote: quoteId = "weth",
  } = body || {};

  if (side !== "buy" && side !== "sell") return NextResponse.json({ error: '`side` must be "buy" or "sell".' }, { status: 400 });
  if (!tokenInput || !isAddress(tokenInput)) return NextResponse.json({ error: "A valid token address is required." }, { status: 400 });
  if (!ownerInput || !isAddress(ownerInput)) return NextResponse.json({ error: "Connect your wallet first." }, { status: 401 });

  let amountIn;
  try { amountIn = BigInt(amountInRaw); } catch { return NextResponse.json({ error: "`amountInRaw` must be an integer string." }, { status: 400 }); }
  if (amountIn <= 0n) return NextResponse.json({ error: "Amount must be greater than zero." }, { status: 400 });

  let chain;
  try { chain = getChain(network); } catch (e) { return NextResponse.json({ error: e.message }, { status: 400 }); }

  const { weth, usdg, quoter, swapRouter, poolFee } = chain.pons || {};
  if (!weth || !quoter || !swapRouter) return NextResponse.json({ error: "This network has no swap router configured." }, { status: 400 });

  const wantsStable = quoteId === "usdg";
  const quoteAddress = wantsStable ? usdg : weth;
  const quoteIsNative = !wantsStable;
  if (!quoteAddress) return NextResponse.json({ error: "No USDG address configured for stock tokens." }, { status: 400 });

  const provider = new JsonRpcProvider(chain.rpc, undefined, { staticNetwork: true });
  const token = getAddress(tokenInput);
  const owner = getAddress(ownerInput);
  const isBuy = side === "buy";
  const steps = [];

  try {
    // ---- WETH itself: 1:1 wrap / unwrap ----
    if (getAddress(token) === getAddress(weth)) {
      if (isBuy) steps.push(step(weth, WETH9_IFACE.encodeFunctionData("deposit", []), amountIn, "wrap", "Wrap ETH → WETH"));
      else steps.push(step(weth, WETH9_IFACE.encodeFunctionData("withdraw", [amountIn]), 0n, "unwrap", "Unwrap WETH → ETH"));
      return NextResponse.json({ ok: true, venue: "weth", steps, explorer: chain.explorer });
    }

    // ---- pons v2 (curve) / graduated v4 / Bankr v4 ----
    let launch = await resolveLaunch(provider, chain, token);
    if (!launch) launch = await resolveBankrPool(provider, chain, token, chain.explorer);
    if (launch) {
      const slippageBps = slippageBpsOf(slippage);
      let expectedOut = 0n;
      try { expectedOut = BigInt(expectedOutRaw || 0); } catch { /* 0 */ }
      const minOut = expectedOut > 0n ? (expectedOut * (10_000n - slippageBps)) / 10_000n : 0n;

      // ---- Graduated / Bankr Uniswap v4 via the Universal Router ----
      if (launch.phase === 2) {
        const cfg = v2Config(chain);
        if (!cfg?.universalRouter) return NextResponse.json({ error: "This coin graduated to Uniswap v4, and v4 trading isn't configured here yet." }, { status: 400 });
        const plan = buildV4Swap(chain, launch, side, amountIn, minOut);
        if (!isBuy) {
          const erc = new Contract(token, ERC20_ABI, provider);
          if ((await erc.allowance(owner, cfg.permit2)) < amountIn)
            steps.push(step(token, ERC20_IFACE.encodeFunctionData("approve", [cfg.permit2, MaxUint256]), 0n, "approve", "Approve token for Permit2"));
          const p2 = new Contract(cfg.permit2, PERMIT2_ABI, provider);
          let allowed = 0n;
          try { const r = await p2.allowance(owner, token, plan.to); allowed = BigInt(r[0]); } catch { /* 0 */ }
          if (allowed < amountIn) {
            const MAX160 = (1n << 160n) - 1n;
            const exp = Math.floor(Date.now() / 1000) + 3600;
            steps.push(step(cfg.permit2, PERMIT2_IFACE.encodeFunctionData("approve", [token, plan.to, MAX160, exp]), 0n, "permit2", "Permit2 → router"));
          }
        }
        const deadline = Math.floor(Date.now() / 1000) + DEADLINE_SECONDS;
        steps.push(step(plan.to, UR_IFACE.encodeFunctionData("execute", [plan.commands, plan.inputs, deadline]), BigInt(plan.value || 0n), "swap", isBuy ? "Buy (v4)" : "Sell (v4)"));
        return NextResponse.json({ ok: true, venue: "v4", steps, explorer: chain.explorer });
      }

      // ---- Bonding curve (phase 0). Other phases are blocked. ----
      if (launch.phase !== 0) { const msg = phaseBlockedMessage(launch.phase); return NextResponse.json(msg, { status: msg.retryable ? 503 : 400 }); }

      if (isBuy) {
        if (launch.isNativeQuote) {
          steps.push(step(launch.curve, CURVE_IFACE.encodeFunctionData("buy", [amountIn, minOut, owner]), amountIn, "swap", "Buy (curve)"));
        } else {
          const pair = new Contract(launch.pairToken, ERC20_ABI, provider);
          if ((await pair.allowance(owner, launch.curve)) < amountIn)
            steps.push(step(launch.pairToken, ERC20_IFACE.encodeFunctionData("approve", [launch.curve, MaxUint256]), 0n, "approve", "Approve pair token"));
          steps.push(step(launch.curve, CURVE_IFACE.encodeFunctionData("buy", [amountIn, minOut, owner]), 0n, "swap", "Buy (curve)"));
        }
        return NextResponse.json({ ok: true, venue: "curve", steps, explorer: chain.explorer });
      }
      // sell into the curve
      const erc = new Contract(token, ERC20_ABI, provider);
      if ((await erc.allowance(owner, launch.curve)) < amountIn)
        steps.push(step(token, ERC20_IFACE.encodeFunctionData("approve", [launch.curve, MaxUint256]), 0n, "approve", "Approve token"));
      steps.push(step(launch.curve, CURVE_IFACE.encodeFunctionData("sell", [amountIn, minOut, owner]), 0n, "swap", "Sell (curve)"));
      return NextResponse.json({ ok: true, venue: "curve", steps, explorer: chain.explorer });
    }

    // ---- v1: plain Uniswap v3 WETH (or USDG) pool ----
    const meta = await tokenMeta(provider, token).catch(() => ({ decimals: 18, symbol: "TOKEN" }));
    const fresh = await quote(provider, quoter, { tokenIn: isBuy ? quoteAddress : token, tokenOut: isBuy ? token : quoteAddress, amountIn, fee: poolFee });
    if (!fresh.ok) return NextResponse.json({ error: `The pool will not quote this trade: ${fresh.reason}` }, { status: 400 });
    const minOut = (fresh.amountOut * (10_000n - slippageBpsOf(slippage))) / 10_000n;

    if (isBuy && quoteIsNative) {
      const weth9 = new Contract(weth, WETH9_ABI, provider);
      const wethBal = await weth9.balanceOf(owner);
      if (wethBal < amountIn) steps.push(step(weth, WETH9_IFACE.encodeFunctionData("deposit", []), amountIn - wethBal, "wrap", "Wrap ETH → WETH"));
      if ((await weth9.allowance(owner, swapRouter)) < amountIn) steps.push(step(weth, WETH9_IFACE.encodeFunctionData("approve", [swapRouter, MaxUint256]), 0n, "approve", "Approve WETH"));
    } else if (isBuy) {
      const q = new Contract(quoteAddress, ERC20_ABI, provider);
      if ((await q.allowance(owner, swapRouter)) < amountIn) steps.push(step(quoteAddress, ERC20_IFACE.encodeFunctionData("approve", [swapRouter, MaxUint256]), 0n, "approve", "Approve USDG"));
    } else {
      const erc = new Contract(token, ERC20_ABI, provider);
      if ((await erc.allowance(owner, swapRouter)) < amountIn) steps.push(step(token, ERC20_IFACE.encodeFunctionData("approve", [swapRouter, MaxUint256]), 0n, "approve", "Approve token"));
    }

    // Pick the router shape the chain accepts (SwapRouter02 vs SwapRouter).
    const base = { tokenIn: isBuy ? quoteAddress : token, tokenOut: isBuy ? token : quoteAddress, fee: poolFee, recipient: owner, amountIn, amountOutMinimum: minOut, sqrtPriceLimitX96: 0n };
    const variants = [
      ROUTER_V2.encodeFunctionData("exactInputSingle", [base]),
      ROUTER_V1.encodeFunctionData("exactInputSingle", [{ ...base, deadline: Math.floor(Date.now() / 1000) + DEADLINE_SECONDS }]),
    ];
    let data = null;
    for (const v of variants) {
      try { await provider.call({ to: swapRouter, data: v, value: 0n, from: owner }); data = v; break; } catch { /* try next */ }
    }
    // The swap dry-run can only pass once WETH is already held/approved; if the
    // wallet needs the wrap+approve first (steps above), fall back to the
    // SwapRouter02 shape so the calldata is still returned to sign in order.
    if (!data) data = variants[0];
    steps.push(step(swapRouter, data, 0n, "swap", isBuy ? `Buy ${meta.symbol}` : `Sell ${meta.symbol}`));

    return NextResponse.json({ ok: true, venue: "v3", symbol: meta.symbol, quotedOutRaw: fresh.amountOut.toString(), minOutRaw: minOut.toString(), steps, explorer: chain.explorer });
  } catch (error) {
    return NextResponse.json({ error: `Could not build the trade: ${error.shortMessage || error.reason || error.message}` }, { status: 400 });
  }
}
