import { NextResponse } from "next/server";
import { Contract, formatUnits } from "ethers";
import { getChain, rpcProvider } from "@/lib/engine";
import { eskaToken, DEAD, ZERO, burnBaseline } from "@/lib/eska";

/**
 * GET /api/eska/burned?network=robinhood
 *
 * The live $AURN burn total, read straight off-chain: the balance held at the
 * burn addresses (which can only ever go up), plus an optional baseline for any
 * burn done outside them. CORS-open so docs.aurn.fun can show it too.
 */

const ERC20 = [
  "function balanceOf(address) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)",
];

let cache = null;
const TTL = 30_000;

function cors(res) {
  res.headers.set("Access-Control-Allow-Origin", "*");
  res.headers.set("Cache-Control", "public, max-age=30");
  return res;
}

export function OPTIONS() {
  const r = new NextResponse(null, { status: 204 });
  r.headers.set("Access-Control-Allow-Origin", "*");
  r.headers.set("Access-Control-Allow-Methods", "GET, OPTIONS");
  return r;
}

export async function GET(request) {
  const network = new URL(request.url).searchParams.get("network") || "robinhood";
  if (cache && Date.now() - cache.at < TTL) return cors(NextResponse.json(cache.value));

  let chain;
  try {
    chain = getChain(network);
  } catch (error) {
    return cors(NextResponse.json({ error: error.message }, { status: 400 }));
  }

  const token = eskaToken();
  // No official token set (e.g. between launches) — nothing to read. The UI hides
  // the burn counter when `token` is null rather than showing a hollow zero.
  if (!token) {
    const v = { token: null, symbol: "AURN", decimals: 18, burned: burnBaseline(), onchain: 0, baseline: burnBaseline(), configured: false };
    cache = { at: Date.now(), value: v };
    return cors(NextResponse.json(v));
  }
  const out = { token, symbol: "AURN", decimals: 18, burned: burnBaseline(), onchain: 0, baseline: burnBaseline(), configured: true };
  try {
    const provider = rpcProvider(chain);
    const c = new Contract(token, ERC20, provider);
    const [dead, zero, dec, sym] = await Promise.all([
      c.balanceOf(DEAD).catch(() => 0n),
      c.balanceOf(ZERO).catch(() => 0n),
      c.decimals().catch(() => 18),
      c.symbol().catch(() => "AURN"),
    ]);
    out.decimals = Number(dec) || 18;
    out.symbol = String(sym || "AURN").replace(/^\$/, "");
    out.onchain = Number(formatUnits(dead + zero, out.decimals));
    out.burned = out.onchain + out.baseline;
  } catch {
    /* keep baseline-only total if the node is unreachable */
  }

  cache = { at: Date.now(), value: out };
  return cors(NextResponse.json(out));
}
