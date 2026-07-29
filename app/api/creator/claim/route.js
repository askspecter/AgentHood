import { NextResponse } from "next/server";
import { Interface, JsonRpcProvider, getAddress, isAddress } from "ethers";
import { deriveSigner, deriveAddress, getChain, listLaunched, fetchFactoryAbi } from "@/lib/engine";
import { getSession } from "@/lib/session";
import { eskaCutEnabled } from "@/lib/fees";

/**
 * POST /api/creator/claim  { token, network }
 *
 * Claims a creator's accrued pool fees from the pons locker, signed by their
 * X wallet. The claim function is discovered from the locker's verified ABI (not
 * guessed) and dry-run before sending, so a wrong signature fails as a message
 * instead of a burnt transaction.
 *
 * Only the token's creator (per the launch registry) may claim. The ESKA fee
 * split routes fees to a collector; that custodial path is not enabled here yet,
 * so this refuses clearly while ESKA_FEE_SPLIT is on rather than paying wrongly.
 */

const CLAIM_NAME = /^(claim|collect)/i;

/** Pick a claim function from the locker ABI that takes just the token (+maybe a recipient). */
function findClaim(abi) {
  const fns = abi.filter(
    (e) =>
      e.type === "function" &&
      e.stateMutability !== "view" &&
      e.stateMutability !== "pure" &&
      CLAIM_NAME.test(e.name || "")
  );
  // Prefer the simplest signature: one address (token), then (address,address).
  const shapes = (inputs) => (inputs || []).map((i) => i.type).join(",");
  return (
    fns.find((f) => shapes(f.inputs) === "address") ||
    fns.find((f) => shapes(f.inputs) === "address,address") ||
    null
  );
}

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Expected a JSON body." }, { status: 400 });
  }
  const network = body?.network || "robinhood";
  let token;
  try {
    token = getAddress(body?.token);
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
  if (!session) return NextResponse.json({ error: "Sign in with X first." }, { status: 401 });

  // Gate: only the recorded creator may claim.
  let entry = null;
  try {
    const reg = await listLaunched({ limit: 1000 });
    const key = token.toLowerCase();
    entry = (reg.entries || []).find((e) => String(e.token).toLowerCase() === key) || null;
  } catch {
    /* fall through — treated as not-creator below */
  }
  let wallet = null;
  try {
    wallet = deriveAddress(session.id);
  } catch {
    return NextResponse.json({ error: "Wallets are not configured on this deployment." }, { status: 500 });
  }
  const isCreator =
    (entry?.deployer && entry.deployer.toLowerCase() === wallet.toLowerCase()) ||
    (entry?.xUsername && entry.xUsername.toLowerCase() === (session.username || "").replace(/^@/, "").toLowerCase());
  if (!isCreator) {
    return NextResponse.json({ error: "Only the coin's creator can claim its fees." }, { status: 403 });
  }

  // The custodial ESKA split isn't wired into claim yet — refuse rather than
  // misroute funds. (While off, fees go straight to the creator's wallet.)
  if (eskaCutEnabled()) {
    return NextResponse.json(
      { error: "Fee claiming via the ESKA split is being finalised. Try again shortly." },
      { status: 503 }
    );
  }

  const locker = chain.pons?.locker;
  if (!locker || !isAddress(locker) || !chain.explorer) {
    return NextResponse.json({ error: "This network has no pons locker configured." }, { status: 400 });
  }

  // Discover the claim function from the verified locker ABI.
  let claimFn;
  try {
    const { abi } = await fetchFactoryAbi(chain.explorer, locker);
    claimFn = findClaim(abi);
  } catch (error) {
    return NextResponse.json({ error: `Could not read the locker contract: ${error.message}` }, { status: 502 });
  }
  if (!claimFn) {
    return NextResponse.json(
      { error: "This pons locker exposes no automatic claim — fees may accrue directly to your wallet, or need the pons app to collect." },
      { status: 501 }
    );
  }

  const iface = new Interface([claimFn]);
  const args = (claimFn.inputs || []).map((i) => (i.type === "address" ? (i === claimFn.inputs[0] ? token : wallet) : 0));
  const data = iface.encodeFunctionData(claimFn.name, args);

  const provider = new JsonRpcProvider(chain.rpc, chain.chainId, { staticNetwork: true });

  // Dry-run first: a revert here is a clean message, not a burnt tx.
  try {
    await provider.call({ to: locker, data, from: wallet });
  } catch (error) {
    const reason = error?.shortMessage || error?.reason || error?.message || "the claim would revert";
    return NextResponse.json(
      {
        error: "No fees to claim yet — creator fees build up as your coin is traded. Check back once there's some volume.",
        detail: reason,
      },
      { status: 400 }
    );
  }

  // Send it, signed by the creator's X wallet.
  try {
    const signer = deriveSigner(session.id, chain);
    const tx = await signer.sendTransaction({ to: locker, data });
    const receipt = await tx.wait();
    return NextResponse.json({ ok: true, hash: tx.hash, block: receipt?.blockNumber ?? null, explorer: chain.explorer });
  } catch (error) {
    return NextResponse.json({ error: error?.shortMessage || error?.message || "The claim failed to send." }, { status: 502 });
  }
}
