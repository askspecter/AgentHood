import { NextResponse } from "next/server";
import { Contract, formatUnits, Interface } from "ethers";
import { getChain, rpcProvider } from "@/lib/engine";
import { readLaunch } from "@/lib/engine/pons";
import { resolveBankrPool, v4Pricing, v2Config } from "@/lib/engine/ponsV2";

/**
 * GET /api/debug/token?token=0x…&network=robinhood
 *
 * Read-only diagnostics for one token: what the feed enrichment can (and can't)
 * read for it — real supply, pons-launch status, and whether its Uniswap V4 pool
 * can be discovered from the explorer's Initialize logs. No secrets, no writes.
 * Used to see why a Bankr token (e.g. $ESKA) shows a wrong supply / no price /
 * no quote, from the server's own vantage point.
 */
const META_ABI = [
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function totalSupply() view returns (uint256)",
  "function decimals() view returns (uint8)",
];

const INITIALIZE_ABI = [
  "event Initialize(bytes32 indexed id, address indexed currency0, address indexed currency1, uint24 fee, int24 tickSpacing, address hooks, uint160 sqrtPriceX96, int24 tick)",
];

function padTopic(addr) {
  return "0x" + "0".repeat(24) + String(addr).toLowerCase().replace(/^0x/, "");
}

export async function GET(request) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token");
  const network = url.searchParams.get("network") || "robinhood";
  if (!token) return NextResponse.json({ error: "Pass ?token=0x…" }, { status: 400 });

  const out = { token, network, steps: {} };

  let chain, provider;
  try {
    chain = getChain(network);
    provider = rpcProvider(chain);
    out.explorer = chain.explorer;
    out.poolManager = v2Config(chain)?.poolManager || null;
    out.weth = chain.pons?.weth || null;
  } catch (e) {
    return NextResponse.json({ ...out, fatal: e.message }, { status: 500 });
  }

  // 1) Basic ERC-20 reads (supply is the simplest, hook-free RPC read).
  try {
    const meta = new Contract(token, META_ABI, provider);
    const [name, symbol, rawSupply, dec] = await Promise.all([
      meta.name().catch((e) => `ERR:${e.shortMessage || e.message}`),
      meta.symbol().catch((e) => `ERR:${e.shortMessage || e.message}`),
      meta.totalSupply().catch((e) => `ERR:${e.shortMessage || e.message}`),
      meta.decimals().catch((e) => `ERR:${e.shortMessage || e.message}`),
    ]);
    out.steps.erc20 = {
      name, symbol,
      decimals: typeof dec === "bigint" ? Number(dec) : dec,
      totalSupplyRaw: typeof rawSupply === "bigint" ? rawSupply.toString() : rawSupply,
      totalSupplyTokens:
        typeof rawSupply === "bigint" && typeof dec === "bigint"
          ? Number(formatUnits(rawSupply, Number(dec)))
          : null,
    };
  } catch (e) {
    out.steps.erc20 = { error: e.message };
  }

  // 2) Is it a pons launch? (If true, that would wrongly route it.)
  try {
    const l = await readLaunch(provider, chain, token);
    out.steps.readLaunch = { isPonsLaunch: l?.isPonsLaunch ?? null, skipReason: l?.skipReason ?? null };
  } catch (e) {
    out.steps.readLaunch = { threw: e.shortMessage || e.message };
  }

  // 3) Raw explorer getLogs for the pool's Initialize event (both currency slots).
  try {
    const iface = new Interface(INITIALIZE_ABI);
    const topicHash = iface.getEvent("Initialize").topicHash;
    out.steps.initTopic = topicHash;
    const pm = v2Config(chain)?.poolManager;
    const probes = {};
    for (const pos of [2, 3]) {
      const qs = new URLSearchParams({
        module: "logs", action: "getLogs", fromBlock: "0", toBlock: "latest",
        address: pm, topic0: topicHash,
      });
      qs.set(`topic${pos}`, padTopic(token));
      qs.set(`topic0_${pos}_opr`, "and");
      const u = `${String(chain.explorer).replace(/\/+$/, "")}/api?${qs.toString()}`;
      try {
        const res = await fetch(u, { headers: { accept: "application/json" }, cache: "no-store" });
        const j = await res.json().catch(() => null);
        const items = Array.isArray(j?.result) ? j.result : [];
        let decoded = null;
        if (items[0]) {
          try {
            const p = iface.parseLog({ topics: items[0].topics, data: items[0].data });
            decoded = {
              currency0: p.args.currency0, currency1: p.args.currency1,
              fee: Number(p.args.fee), tickSpacing: Number(p.args.tickSpacing), hooks: p.args.hooks,
            };
          } catch (e) { decoded = { parseError: e.message }; }
        }
        probes[`currency${pos - 2}`] = { url: u, httpStatus: res.status, apiStatus: j?.status, apiMessage: j?.message, count: items.length, decoded };
      } catch (e) {
        probes[`currency${pos - 2}`] = { url: u, fetchError: e.message };
      }
    }
    out.steps.explorerInitLogs = probes;
  } catch (e) {
    out.steps.explorerInitLogs = { error: e.message };
  }

  // 4) What resolveBankrPool + v4Pricing actually return.
  try {
    const pool = await resolveBankrPool(provider, chain, token, chain.explorer);
    out.steps.resolveBankrPool = pool || null;
    if (pool) {
      try { out.steps.v4Pricing = await v4Pricing(provider, chain, pool); }
      catch (e) { out.steps.v4Pricing = { error: e.shortMessage || e.message }; }
    }
  } catch (e) {
    out.steps.resolveBankrPool = { threw: e.shortMessage || e.message };
  }

  return NextResponse.json(out, { status: 200 });
}
