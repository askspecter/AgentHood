import { NextResponse } from "next/server";
import { Contract, JsonRpcProvider, formatUnits, getAddress } from "ethers";
import { getChain } from "@/lib/engine";
import { resolveTokenLogo, proxifyLogo } from "@/lib/tokenLogo";

/**
 * GET /api/locks?network=robinhood[&owner=0x..]
 *
 * The public token-lock registry, read straight from the AurnLocker contract.
 * No wallet needed - anyone can see the list of locked tokens. Returns the most
 * recent locks with their token metadata, amount, and unlock time. Pass `owner`
 * to get just that wallet's locks.
 */
const LOCKER_ADDRESS = (process.env.LOCKER_ADDRESS || process.env.NEXT_PUBLIC_LOCKER_ADDRESS || "").trim();

const LOCKER_ABI = [
  "function locksCount() view returns (uint256)",
  "function getLocks(uint256 start, uint256 count) view returns ((address owner,address token,uint256 amount,uint64 lockedAt,uint64 unlockAt,bool withdrawn)[])",
];
const META_ABI = [
  "function symbol() view returns (string)",
  "function name() view returns (string)",
  "function decimals() view returns (uint8)",
];

export async function GET(request) {
  const url = new URL(request.url);
  const network = url.searchParams.get("network") || "robinhood";
  const ownerParam = url.searchParams.get("owner");

  if (!/^0x[a-fA-F0-9]{40}$/.test(LOCKER_ADDRESS)) {
    return NextResponse.json({ live: false, address: null, locks: [] });
  }

  let chain;
  try { chain = getChain(network); } catch (e) { return NextResponse.json({ error: e.message }, { status: 400 }); }

  try {
    const provider = new JsonRpcProvider(chain.rpc, chain.chainId, { staticNetwork: true });
    const locker = new Contract(LOCKER_ADDRESS, LOCKER_ABI, provider);

    const count = Number(await locker.locksCount());
    if (!count) return NextResponse.json({ live: true, address: LOCKER_ADDRESS, locks: [] });

    // Read the most recent locks (newest first), capped for a fast public list.
    const MAX = 120;
    const start = Math.max(0, count - MAX);
    const raw = await locker.getLocks(start, count - start);

    let rows = raw.map((l, i) => ({
      id: start + i,
      owner: l.owner,
      token: l.token,
      amountRaw: l.amount.toString(),
      lockedAt: Number(l.lockedAt) * 1000,
      unlockAt: Number(l.unlockAt) * 1000,
      withdrawn: l.withdrawn,
    }));

    // Only the live (not-withdrawn) locks are "locked tokens".
    rows = rows.filter((r) => !r.withdrawn).reverse(); // newest first
    if (ownerParam && /^0x[a-fA-F0-9]{40}$/.test(ownerParam)) {
      const o = ownerParam.toLowerCase();
      rows = rows.filter((r) => r.owner.toLowerCase() === o);
    }

    // Enrich unique tokens with metadata (symbol/name/decimals/logo), bounded.
    const uniq = [...new Set(rows.map((r) => r.token.toLowerCase()))].slice(0, 60);
    const meta = {};
    await Promise.all(uniq.map(async (addr) => {
      try {
        const c = new Contract(getAddress(addr), META_ABI, provider);
        const [symbol, name, decimals, logo] = await Promise.all([
          c.symbol().catch(() => "TOKEN"),
          c.name().catch(() => null),
          c.decimals().then((d) => Number(d)).catch(() => 18),
          resolveTokenLogo(provider, chain.explorer, getAddress(addr)),
        ]);
        meta[addr] = { symbol: (symbol || "TOKEN").replace(/^\$/, ""), name, decimals, logo };
      } catch { meta[addr] = { symbol: "TOKEN", name: null, decimals: 18, logo: null }; }
    }));

    const locks = rows.map((r) => {
      const m = meta[r.token.toLowerCase()] || { symbol: "TOKEN", name: null, decimals: 18, logo: null };
      const amount = (() => { try { return formatUnits(r.amountRaw, m.decimals); } catch { return null; } })();
      return { ...r, symbol: m.symbol, name: m.name || m.symbol, decimals: m.decimals, logo: proxifyLogo(m.logo), amount };
    });

    return NextResponse.json({ live: true, address: LOCKER_ADDRESS, count, locks });
  } catch (error) {
    return NextResponse.json({ live: true, address: LOCKER_ADDRESS, locks: [], error: error.message || "Could not read locks." }, { status: 200 });
  }
}
