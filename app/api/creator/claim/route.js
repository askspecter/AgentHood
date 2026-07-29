import { NextResponse } from "next/server";
import { Interface, JsonRpcProvider, formatUnits, getAddress, isAddress } from "ethers";
import {
  deriveSigner,
  deriveAddress,
  getChain,
  listLaunched,
  fetchFactoryAbi,
  tokenBalance,
  erc20Iface,
} from "@/lib/engine";
import { getSession } from "@/lib/session";
import { eskaCutEnabled, opsWallet } from "@/lib/fees";

/**
 * POST /api/creator/claim  { token, network }
 *
 * Claims a creator's accrued pool fees from the pons locker, signed by their
 * X wallet. The claim function is discovered from the locker's verified ABI (not
 * guessed) and dry-run before sending, so a wrong signature fails as a message
 * instead of a burnt transaction.
 *
 * Only the token's creator (per the launch registry) may claim.
 *
 * ── The ESKA split (ESKA_FEE_SPLIT=on) ──────────────────────────────────────
 * pons' 30% protocol cut is fixed on-chain; the remaining 70% is the creator's
 * share and lands in the creator's OWN wallet here (recipient is forced to that
 * wallet at both launch and claim). When the split is on, ESKA re-splits that
 * 70% AFTER it has landed: it skims 10/70 to the ESKA ops wallet, leaving the
 * creator 60/70. (Any burn is done manually from the ops wallet, not here.)
 * Skimming after the claim — out of the creator's own wallet, which the server
 * custodially controls — means the creator's 60% never leaves their control, and
 * if the skim fails the creator simply keeps that slice (ESKA under-collects;
 * nobody is underpaid or stranded). Native ETH is never skimmed: the claim's gas
 * is paid in ETH, so an ETH balance delta is ambiguous. Only the token and WETH
 * (both ERC-20) are.
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

/**
 * Move one ERC-20 slice out of the creator's wallet as part of the split.
 * Dry-run first, then send. Never throws: a failure is reported and the slice
 * stays with the creator. Zero (or negative) amounts are a no-op.
 */
async function transferSlice({ provider, signer, from, asset, to, amount, label }) {
  if (amount <= 0n) return { label, to, amount: "0", status: "skipped:zero" };
  const data = erc20Iface.encodeFunctionData("transfer", [to, amount]);
  try {
    await provider.call({ to: asset, data, from });
  } catch (error) {
    return { label, to, amount: amount.toString(), status: "skipped:dry-run", detail: error?.shortMessage || error?.message };
  }
  try {
    const tx = await signer.sendTransaction({ to: asset, data });
    await tx.wait();
    return { label, to, amount: amount.toString(), status: "sent", hash: tx.hash };
  } catch (error) {
    return { label, to, amount: amount.toString(), status: "failed", detail: error?.shortMessage || error?.message };
  }
}

/**
 * Skim ESKA's 10% out of the ~70% that just landed in the creator's wallet, to
 * the ops wallet. `received` is the measured balance delta (raw units) for the
 * token and WETH. Sequential (one wallet, one nonce line) and best-effort.
 */
async function skimEskaSplit({ chain, xUserId, wallet, token, weth, received }) {
  let opsTo;
  try {
    opsTo = getAddress(opsWallet());
  } catch (error) {
    return { error: "split-config", detail: error?.message };
  }

  const signer = deriveSigner(xUserId, chain);
  const provider = signer.provider;

  const assets = [
    { addr: token, key: "token", recv: received.token },
    { addr: weth, key: "weth", recv: received.weth },
  ];

  const transfers = [];
  for (const a of assets) {
    if (a.recv <= 0n) continue;
    // 70% landed → ESKA's cut is 10/70 of it, the creator keeps the other 60/70.
    const opsShare = (a.recv * 10n) / 70n;
    transfers.push(
      await transferSlice({ provider, signer, from: wallet, asset: a.addr, to: opsTo, amount: opsShare, label: `ops:${a.key}` })
    );
  }

  return { opsWallet: opsTo, transfers };
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
  // Recipient of the claim is the creator's own wallet (never a client value).
  const args = (claimFn.inputs || []).map((i) => (i.type === "address" ? (i === claimFn.inputs[0] ? token : wallet) : 0));
  const data = iface.encodeFunctionData(claimFn.name, args);

  const provider = new JsonRpcProvider(chain.rpc, chain.chainId, { staticNetwork: true });

  // The ESKA split re-splits what the claim pays, so measure the balances before
  // claiming. If we can't read them we don't skim — the creator keeps everything.
  const weth = chain.pons?.weth;
  const doSplit = eskaCutEnabled() && weth && isAddress(weth);
  let before = null;
  if (doSplit) {
    try {
      const [bt, bw] = await Promise.all([
        tokenBalance(provider, token, wallet),
        tokenBalance(provider, weth, wallet),
      ]);
      before = { token: bt, weth: bw };
    } catch {
      before = null;
    }
  }

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
  let receipt, hash;
  try {
    const signer = deriveSigner(session.id, chain);
    const tx = await signer.sendTransaction({ to: locker, data });
    receipt = await tx.wait();
    hash = tx.hash;
  } catch (error) {
    return NextResponse.json({ error: error?.shortMessage || error?.message || "The claim failed to send." }, { status: 502 });
  }

  // Re-split the creator share once it has landed (ESKA_FEE_SPLIT=on only).
  let distribution = null;
  if (doSplit && before) {
    try {
      const [at, aw] = await Promise.all([
        tokenBalance(provider, token, wallet),
        tokenBalance(provider, weth, wallet),
      ]);
      const received = {
        token: at > before.token ? at - before.token : 0n,
        weth: aw > before.weth ? aw - before.weth : 0n,
      };
      if (received.token > 0n || received.weth > 0n) {
        distribution = await skimEskaSplit({ chain, xUserId: session.id, wallet, token, weth, received });
        distribution.received = { token: received.token.toString(), weth: formatUnits(received.weth, 18) };
      }
    } catch (error) {
      // The claim already succeeded and paid the creator — never fail it on skim.
      distribution = { error: "split-skim", detail: error?.shortMessage || error?.message };
    }
  }

  return NextResponse.json({
    ok: true,
    hash,
    block: receipt?.blockNumber ?? null,
    explorer: chain.explorer,
    split: doSplit ? { creator: 60, protocol: 30, ops: 10 } : null,
    distribution,
  });
}
