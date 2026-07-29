import { NextResponse } from "next/server";
import { Contract, Interface, JsonRpcProvider, formatUnits, getAddress, isAddress } from "ethers";
import { deriveAddress, getChain, listLaunched, fetchFactoryAbi, getEthUsd, spotPrice } from "@/lib/engine";
import { getSession } from "@/lib/session";

/**
 * GET /api/creator/fees?token=0x…&network=robinhood
 *
 * The creator's currently-claimable pool fees (the token + WETH amounts), read by
 * static-calling the locker's claim function — collect-style functions return the
 * amounts they would pay, so this reads "accrued" without spending gas. Best
 * effort: if the amounts can't be read, `accrued` is null and the panel just
 * shows the Claim button. Creator-only.
 */

const CLAIM_NAME = /^(claim|collect)/i;
const META_ABI = ["function symbol() view returns (string)", "function decimals() view returns (uint8)"];

function findClaim(abi) {
  const fns = abi.filter(
    (e) => e.type === "function" && e.stateMutability !== "view" && e.stateMutability !== "pure" && CLAIM_NAME.test(e.name || "")
  );
  const shape = (i) => (i || []).map((x) => x.type).join(",");
  return fns.find((f) => shape(f.inputs) === "address") || fns.find((f) => shape(f.inputs) === "address,address") || null;
}

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

  const session = await getSession().catch(() => null);
  if (!session) return NextResponse.json({ accrued: null });

  // Creator-only.
  let wallet = null;
  try {
    wallet = deriveAddress(session.id);
  } catch {
    return NextResponse.json({ accrued: null });
  }
  let entry = null;
  try {
    const reg = await listLaunched({ limit: 1000 });
    const key = token.toLowerCase();
    entry = (reg.entries || []).find((e) => String(e.token).toLowerCase() === key) || null;
  } catch {
    /* no registry */
  }
  const isCreator =
    (entry?.deployer && entry.deployer.toLowerCase() === wallet.toLowerCase()) ||
    (entry?.xUsername && entry.xUsername.toLowerCase() === (session.username || "").replace(/^@/, "").toLowerCase());
  if (!isCreator) return NextResponse.json({ accrued: null });

  const locker = chain.pons?.locker;
  const weth = chain.pons?.weth;
  if (!locker || !isAddress(locker) || !chain.explorer || !weth) {
    return NextResponse.json({ accrued: null });
  }

  try {
    const { abi } = await fetchFactoryAbi(chain.explorer, locker);
    const claimFn = findClaim(abi);
    if (!claimFn) return NextResponse.json({ accrued: null });

    const provider = new JsonRpcProvider(chain.rpc, chain.chainId, { staticNetwork: true });
    const iface = new Interface([claimFn]);
    const args = (claimFn.inputs || []).map((i, idx) => (i.type === "address" ? (idx === 0 ? token : wallet) : 0));
    const data = iface.encodeFunctionData(claimFn.name, args);

    let decoded;
    try {
      const raw = await provider.call({ to: locker, data, from: wallet });
      decoded = iface.decodeFunctionResult(claimFn.name, raw);
    } catch {
      // Reverts when there's nothing to claim — report zero rather than failing.
      return NextResponse.json({ accrued: [], canRead: true });
    }

    // Expect two amounts (token0, token1). Uniswap orders tokens by address.
    const nums = decoded.filter((v) => typeof v === "bigint");
    if (nums.length < 2) return NextResponse.json({ accrued: null });
    const tokenIsToken0 = token.toLowerCase() < weth.toLowerCase();
    const tokenAmtRaw = tokenIsToken0 ? nums[0] : nums[1];
    const wethAmtRaw = tokenIsToken0 ? nums[1] : nums[0];

    const [rate, meta, sp] = await Promise.all([
      getEthUsd(),
      (async () => {
        try {
          const c = new Contract(token, META_ABI, provider);
          const [symbol, decimals] = await Promise.all([c.symbol(), c.decimals()]);
          return { symbol, decimals: Number(decimals) };
        } catch {
          return { symbol: null, decimals: 18 };
        }
      })(),
      spotPrice(provider, chain, token, { ethUsd: null }).catch(() => null),
    ]);
    const ethUsd = rate?.usd ?? null;
    const tokenQty = Number(formatUnits(tokenAmtRaw, meta.decimals));
    const wethQty = Number(formatUnits(wethAmtRaw, 18));
    const tokenPriceUsd = sp?.ok && Number.isFinite(sp.priceInWeth) && ethUsd ? sp.priceInWeth * ethUsd : null;

    const accrued = [
      {
        symbol: (meta.symbol || "TOKEN").replace(/^\$/, ""),
        amount: tokenQty,
        usd: tokenPriceUsd != null ? tokenQty * tokenPriceUsd : null,
      },
      {
        symbol: "WETH",
        amount: wethQty,
        usd: ethUsd != null ? wethQty * ethUsd : null,
      },
    ];
    return NextResponse.json({ accrued, canRead: true });
  } catch {
    return NextResponse.json({ accrued: null });
  }
}
