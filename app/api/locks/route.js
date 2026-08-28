import { NextResponse } from "next/server";
import { Contract, JsonRpcProvider, formatUnits, getAddress } from "ethers";
import { getChain } from "@/lib/engine";

/**
 * GET /api/locks?network=robinhood[&owner=0x..]
 *
 * The public token-lock registry, read straight from the AurnLocker contract.
 * No wallet needed — anyone can see the list of locked tokens. Returns the most
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
  "function logo() view returns (string)",
];

function normLogo(raw) {
  if (!raw || typeof raw !== "string") return null;
  const s = raw.trim();
  if (!s) return null;
  if (s.startsWith("ipfs://")) return `https://ipfs.io/ipfs/${s.replace(/^ipfs:\/\/(ipfs\/)?/, "")}`;
  const m = s.match(/\/api\/logo\?id=[A-Za-z0-9_-]+/);
  if (m) return m[0];
  if (/^https?:\/\//.test(s) || s.startsWith("data:")) return s;
  return null;
}

/**
 * Route a resolved logo through the same-origin image proxy so mobile clients
 * never have to reach a public IPFS gateway (often blocked/slow on cellular) and
 * only load a small WebP. Same-origin paths and data URLs are already fine.
 */
function proxify(url) {
  if (!url) return null;
  if (url.startsWith("data:") || url.startsWith("/api/")) return url;
  if (/^https?:\/\//.test(url)) return `/api/img?src=${encodeURIComponent(url)}`;
  return url;
}

/**
 * The token's icon from the block explorer (Blockscout), used when the token has
 * no usable on-chain logo(). This is how a Pons/Doppler token's real image shows
 * up in the feed instead of a placeholder, so the locked list matches it.
 */
async function explorerTokenIcon(explorer, token) {
  if (!explorer || !token) return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);
  try {
    const url = `${String(explorer).replace(/\/+$/, "")}/api/v2/tokens/${token}`;
    const res = await fetch(url, { headers: { accept: "application/json" }, cache: "no-store", signal: controller.signal });
    if (!res.ok) return null;
    const j = await res.json();
    return j?.icon_url || j?.image_url || null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

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
          c.logo().catch(() => null),
        ]);
        // Prefer the token's own on-chain logo(); fall back to the block-explorer
        // icon so tokens without one (Pons/Doppler) still show their real image.
        let resolved = normLogo(logo);
        if (!resolved) resolved = normLogo(await explorerTokenIcon(chain.explorer, getAddress(addr)));
        meta[addr] = { symbol: (symbol || "TOKEN").replace(/^\$/, ""), name, decimals, logo: resolved };
      } catch { meta[addr] = { symbol: "TOKEN", name: null, decimals: 18, logo: null }; }
    }));

    const locks = rows.map((r) => {
      const m = meta[r.token.toLowerCase()] || { symbol: "TOKEN", name: null, decimals: 18, logo: null };
      const amount = (() => { try { return formatUnits(r.amountRaw, m.decimals); } catch { return null; } })();
      return { ...r, symbol: m.symbol, name: m.name || m.symbol, decimals: m.decimals, logo: proxify(m.logo), amount };
    });

    return NextResponse.json({ live: true, address: LOCKER_ADDRESS, count, locks });
  } catch (error) {
    return NextResponse.json({ live: true, address: LOCKER_ADDRESS, locks: [], error: error.message || "Could not read locks." }, { status: 200 });
  }
}
