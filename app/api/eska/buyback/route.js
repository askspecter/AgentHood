import { NextResponse } from "next/server";
import { Contract, Interface, MaxUint256, formatUnits, parseUnits } from "ethers";
import { getChain, rpcProvider, deriveSigner, deriveAddress, quote as quoteSwap } from "@/lib/engine";
import { eskaToken, DEAD, BUYBACK_ID, buybackEnabled, adminSecret } from "@/lib/eska";

/**
 * $AURN buyback-and-burn.
 *
 * The collector wallet (derived from BUYBACK_ID, server-controlled) holds the
 * WETH earmarked from the AURN fee share. This swaps that WETH for $AURN through
 * the pons/Uniswap pool and sends the $AURN straight to the burn address — a real
 * buy-and-burn in one path.
 *
 * ── SAFETY ──────────────────────────────────────────────────────────────────
 * This spends real funds, so it is locked down:
 *   • OFF unless ESKA_BUYBACK=on.
 *   • POST must carry the ESKA_ADMIN_SECRET, so it can't be triggered by anyone.
 *   • The swap is quoted, slippage-protected, and dry-run before it's sent.
 *   • The collector needs a little ETH for gas — fund the address from GET.
 * GET is safe and open: it reports the collector address, its WETH balance, and
 * whether buyback is enabled, so you can fund it and verify before flipping it on.
 */

const ERC20 = [
  "function balanceOf(address) view returns (uint256)",
  "function allowance(address,address) view returns (uint256)",
  "function approve(address,uint256) returns (bool)",
  "function decimals() view returns (uint8)",
];
const ROUTER_NO_DEADLINE = new Interface([
  "function exactInputSingle((address tokenIn,address tokenOut,uint24 fee,address recipient,uint256 amountIn,uint256 amountOutMinimum,uint160 sqrtPriceLimitX96) params) payable returns (uint256)",
]);
const ROUTER_DEADLINE = new Interface([
  "function exactInputSingle((address tokenIn,address tokenOut,uint24 fee,address recipient,uint256 deadline,uint256 amountIn,uint256 amountOutMinimum,uint160 sqrtPriceLimitX96) params) payable returns (uint256)",
]);

function collectorAddress() {
  return deriveAddress(BUYBACK_ID);
}

export async function GET(request) {
  const network = new URL(request.url).searchParams.get("network") || "robinhood";
  let chain;
  try {
    chain = getChain(network);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  const weth = chain.pons?.weth;
  let address = null, we  = "0", eth = "0";
  try {
    address = collectorAddress();
    const provider = rpcProvider(chain);
    const [w, e] = await Promise.all([
      new Contract(weth, ERC20, provider).balanceOf(address).catch(() => 0n),
      provider.getBalance(address).catch(() => 0n),
    ]);
    we = formatUnits(w, 18);
    eth = formatUnits(e, 18);
  } catch {
    /* not configured */
  }
  return NextResponse.json({
    enabled: buybackEnabled(),
    collector: address,
    wethReserve: we,
    gasEth: eth,
    token: eskaToken(),
    hint: "Send a little ETH to `collector` for gas, then POST with { secret } to buy back and burn its WETH.",
  });
}

export async function POST(request) {
  if (!buybackEnabled()) {
    return NextResponse.json({ error: "Buyback is off. Set ESKA_BUYBACK=on to enable." }, { status: 503 });
  }
  let body;
  try {
    body = await request.json();
  } catch {
    body = {};
  }
  const secret = adminSecret();
  if (!secret || body?.secret !== secret) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const network = body?.network || "robinhood";
  let chain;
  try {
    chain = getChain(network);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  const { weth, quoter, swapRouter, poolFee } = chain.pons || {};
  const token = eskaToken();
  if (!weth || !quoter || !swapRouter) {
    return NextResponse.json({ error: "This network has no pons router configured." }, { status: 400 });
  }

  const provider = rpcProvider(chain);
  let signer, from;
  try {
    signer = deriveSigner(BUYBACK_ID, chain);
    from = await signer.getAddress();
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const wethC = new Contract(weth, ERC20, provider);
  const balance = await wethC.balanceOf(from).catch(() => 0n);

  // Optional cap: buy back at most `maxWeth` this run (else the whole reserve).
  let amountIn = balance;
  if (body?.maxWeth) {
    try {
      const cap = parseUnits(String(body.maxWeth), 18);
      if (cap < amountIn) amountIn = cap;
    } catch {
      /* ignore a bad cap */
    }
  }
  // Dust guard: don't spend gas on a negligible reserve.
  const MIN = parseUnits(String(process.env.ESKA_BUYBACK_MIN_WETH || "0.0005"), 18);
  if (amountIn < MIN) {
    return NextResponse.json({ ok: false, skipped: "reserve below minimum", wethReserve: formatUnits(balance, 18), collector: from });
  }

  // Quote WETH -> $AURN and set a slippage floor.
  const q = await quoteSwap(provider, quoter, { tokenIn: weth, tokenOut: token, amountIn, fee: poolFee });
  if (!q.ok) {
    return NextResponse.json({ error: `Could not quote the buyback: ${q.reason}` }, { status: 400 });
  }
  const slipPct = Math.min(50, Math.max(0.1, Number(body?.slippage) || 8));
  const minOut = (q.amountOut * BigInt(Math.round((100 - slipPct) * 100))) / 10_000n;

  // Approve the router for WETH if needed.
  try {
    const allowance = await wethC.allowance(from, swapRouter).catch(() => 0n);
    if (allowance < amountIn) {
      const data = new Interface(ERC20).encodeFunctionData("approve", [swapRouter, MaxUint256]);
      const tx = await signer.sendTransaction({ to: weth, data });
      await tx.wait();
    }
  } catch (error) {
    return NextResponse.json({ error: `Approval failed: ${error?.shortMessage || error?.message}` }, { status: 502 });
  }

  // Build the swap (send $AURN straight to the burn address), try both router
  // shapes, dry-run, then send whichever the chain accepts.
  const base = { tokenIn: weth, tokenOut: token, fee: poolFee, recipient: DEAD, amountIn, amountOutMinimum: minOut, sqrtPriceLimitX96: 0n };
  const variants = [
    ROUTER_NO_DEADLINE.encodeFunctionData("exactInputSingle", [base]),
    ROUTER_DEADLINE.encodeFunctionData("exactInputSingle", [{ ...base, deadline: BigInt(Math.floor(Date.now() / 1000) + 1200) }]),
  ];
  let data = null;
  for (const v of variants) {
    try {
      await provider.call({ to: swapRouter, data: v, from });
      data = v;
      break;
    } catch {
      /* try the other shape */
    }
  }
  if (!data) {
    return NextResponse.json({ error: "The buyback swap reverted in simulation — check liquidity, gas (collector needs ETH), and the pool." }, { status: 400 });
  }

  try {
    const tx = await signer.sendTransaction({ to: swapRouter, data });
    const receipt = await tx.wait();
    return NextResponse.json({
      ok: true,
      hash: tx.hash,
      block: receipt?.blockNumber ?? null,
      spentWeth: formatUnits(amountIn, 18),
      minEskaBurned: formatUnits(minOut, 18),
      burnAddress: DEAD,
      explorer: chain.explorer,
    });
  } catch (error) {
    return NextResponse.json({ error: error?.shortMessage || error?.message || "Buyback failed to send." }, { status: 502 });
  }
}
