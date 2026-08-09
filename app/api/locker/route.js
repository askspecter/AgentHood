import { NextResponse } from "next/server";
import { FunctionFragment } from "ethers";
import { getChain, fetchFactoryAbi } from "@/lib/engine";

/**
 * GET /api/locker?network=robinhood
 *
 * Returns the pons locker's claim/collect fee entrypoint(s), discovered from the
 * locker's verified ABI on the block explorer — the same source /api/creator/claim
 * uses at runtime, and the same shape /api/factory returns for launchToken. Lets a
 * Claim button be wired to the real function signature instead of a guess.
 *
 * Reports both the active locker and the legacy one, since older tokens' fees
 * live in the legacy locker.
 */
const CLAIM_NAME = /^(claim|collect|withdraw)/i;

/** Describe a write function fully: name, human signature, selector, inputs. */
function describe(fn) {
  let signature = null;
  let selector = null;
  try {
    const frag = FunctionFragment.from(fn);
    signature = frag.format("full"); // "function claim(address token) returns (...)"
    selector = frag.selector;
  } catch {
    /* keep nulls if the fragment can't be built */
  }
  return {
    name: fn.name,
    signature,
    selector,
    stateMutability: fn.stateMutability,
    payable: fn.stateMutability === "payable",
    inputs: fn.inputs || [],
    outputs: fn.outputs || [],
  };
}

/** Every non-view function whose name looks like a claim/collect/withdraw. */
function findClaimFns(abi) {
  return (abi || [])
    .filter(
      (e) =>
        e.type === "function" &&
        e.stateMutability !== "view" &&
        e.stateMutability !== "pure" &&
        CLAIM_NAME.test(e.name || "")
    )
    .map(describe);
}

/** The one /api/creator/claim would pick: simplest (address) then (address,address). */
function chooseClaim(fns) {
  const shape = (f) => (f.inputs || []).map((i) => i.type).join(",");
  return (
    fns.find((f) => shape(f) === "address") ||
    fns.find((f) => shape(f) === "address,address") ||
    fns[0] ||
    null
  );
}

async function inspectLocker(explorer, address) {
  if (!address) return null;
  try {
    const { abi, source } = await fetchFactoryAbi(explorer, address);
    const fns = findClaimFns(abi);
    return { address, abiSource: source, abiSize: Array.isArray(abi) ? abi.length : 0, chosen: chooseClaim(fns), candidates: fns };
  } catch (error) {
    return { address, error: error.message };
  }
}

export async function GET(request) {
  const url = new URL(request.url);
  const network = url.searchParams.get("network") || "robinhood";

  let chain;
  try {
    chain = getChain(network);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  if (!chain.explorer) {
    return NextResponse.json({ error: "This network has no explorer configured." }, { status: 400 });
  }

  const [active, legacy] = await Promise.all([
    inspectLocker(chain.explorer, chain.pons?.locker),
    inspectLocker(chain.explorer, chain.pons?.legacyLocker),
  ]);

  return NextResponse.json({
    network,
    explorer: chain.explorer,
    weth: chain.pons?.weth || null,
    activeLocker: active,
    legacyLocker: legacy,
  });
}
