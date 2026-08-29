import { NextResponse } from "next/server";
import { Contract, Interface, formatUnits, getAddress, isAddress } from "ethers";
import {
  deriveSigner,
  deriveAddress,
  getChain,
  listLaunched,
  fetchFactoryAbi,
  tokenBalance,
  erc20Iface,
  rpcProvider,
} from "@/lib/engine";
import { getSession } from "@/lib/session";
import { aurnCutEnabled, opsWallet } from "@/lib/fees";
import { BUYBACK_ID } from "@/lib/aurn";
import { resolveLaunch, v2Config, ESCROW_ABI } from "@/lib/engine/ponsV2";

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
 * ── The AURN split (AURN_FEE_SPLIT=on) ──────────────────────────────────────
 * pons' 30% protocol cut is fixed on-chain; the remaining 70% is the creator's
 * share and lands in the creator's OWN wallet here (recipient is forced to that
 * wallet at both launch and claim). When the split is on, AURN re-splits that
 * 70% AFTER it has landed: it skims 10/70 to the AURN ops wallet, leaving the
 * creator 60/70. (Any burn is done manually from the ops wallet, not here.)
 * Skimming after the claim - out of the creator's own wallet, which the server
 * custodially controls - means the creator's 60% never leaves their control, and
 * if the skim fails the creator simply keeps that slice (AURN under-collects;
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
async function transferSlice({ provider, signer, from, asset, to, amount, label, nonce }) {
  if (amount <= 0n) return { label, to, amount: "0", status: "skipped:zero" };
  const data = erc20Iface.encodeFunctionData("transfer", [to, amount]);
  // Dry-run: a revert here (no balance, no gas) is the only real "won't send".
  try {
    await provider.call({ to: asset, data, from });
  } catch (error) {
    return { label, to, amount: amount.toString(), status: "failed", detail: error?.shortMessage || error?.message };
  }
  // Broadcast with an explicit nonce and return the moment it's accepted. The
  // dry-run already proved it succeeds and this L2 confirms in a fraction of a
  // second, so we do NOT block the claim response waiting for the receipt -
  // that receipt wait was the whole delay. A flaky confirmation read can't
  // false-fail it either, because we never read the receipt here.
  try {
    const tx = await signer.sendTransaction({ to: asset, data, nonce });
    return { label, to, amount: amount.toString(), status: "sent", hash: tx.hash };
  } catch (error) {
    return { label, to, amount: amount.toString(), status: "failed", detail: error?.shortMessage || error?.message };
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Read an ERC-20 balance, retrying a flaky RPC rather than throwing on the first blip. */
async function readBalRetry(provider, asset, owner, tries = 4) {
  let last;
  for (let i = 0; i < tries; i++) {
    try {
      return await tokenBalance(provider, asset, owner);
    } catch (error) {
      last = error;
      await sleep(300);
    }
  }
  throw last;
}

/**
 * How much the claim actually credited the creator's wallet (token + WETH),
 * measured against the pre-claim baseline. After tx.wait() a load-balanced RPC
 * can still serve a stale balance from a lagging node, so poll a few times until
 * the credit appears rather than reading once and giving up (which used to make
 * the skim see "nothing received" and quietly skip).
 */
async function waitForCredit(provider, { token, weth, wallet, before }, tries = 5) {
  let received = { token: 0n, weth: 0n };
  for (let i = 0; i < tries; i++) {
    try {
      const [at, aw] = await Promise.all([
        readBalRetry(provider, token, wallet, 2),
        readBalRetry(provider, weth, wallet, 2),
      ]);
      received = {
        token: at > before.token ? at - before.token : 0n,
        weth: aw > before.weth ? aw - before.weth : 0n,
      };
      if (received.token > 0n || received.weth > 0n) return received;
    } catch {
      /* keep polling */
    }
    if (i < tries - 1) await sleep(400);
  }
  return received;
}

/**
 * Skim AURN's 10% out of the ~70% that just landed in the creator's wallet, to
 * the ops wallet. `received` is the measured balance delta (raw units) for the
 * token and WETH. Sequential (one wallet, one nonce line) and best-effort.
 */
async function skimAurnSplit({ chain, xUserId, wallet, token, weth, received }) {
  let opsTo;
  try {
    opsTo = getAddress(opsWallet());
  } catch (error) {
    return { status: "config-error", detail: error?.message };
  }
  // Where the buyback WETH accumulates (server-controlled). Absent if wallets
  // aren't configured - then AURN's whole cut just goes to ops.
  let buybackTo = null;
  try {
    buybackTo = getAddress(deriveAddress(BUYBACK_ID));
  } catch {
    /* no buyback reserve - fall back to ops-only below */
  }

  const signer = deriveSigner(xUserId, chain);
  const provider = signer.provider;

  const assets = [
    { addr: token, key: "token", recv: received.token },
    { addr: weth, key: "weth", recv: received.weth },
  ];

  // Hand out nonces from one line so the two transfers broadcast back-to-back
  // without waiting for each to mine - advance only when a broadcast succeeds so
  // a failed slice never leaves a nonce gap that strands the next one.
  let nonce;
  try {
    nonce = await signer.getNonce("pending");
  } catch (error) {
    return { status: "nonce-error", detail: error?.shortMessage || error?.message, opsWallet: opsTo };
  }

  const transfers = [];
  for (const a of assets) {
    if (a.recv <= 0n) continue;
    // 70% landed → AURN's cut is 10/70; the creator keeps the other 60/70. WETH
    // splits 5/70 to ops + 5/70 to the buyback reserve (later buys & burns
    // $AURN); the launched token has no buyback use, so its whole 10/70 goes to
    // ops. If no buyback reserve is configured, everything goes to ops.
    const slices =
      a.key === "weth" && buybackTo
        ? [
            { to: opsTo, amount: (a.recv * 5n) / 70n, label: "ops:weth" },
            { to: buybackTo, amount: (a.recv * 5n) / 70n, label: "buyback:weth" },
          ]
        : [{ to: opsTo, amount: (a.recv * 10n) / 70n, label: `ops:${a.key}` }];
    for (const s of slices) {
      if (s.amount <= 0n) continue;
      const res = await transferSlice({ provider, signer, from: wallet, asset: a.addr, to: s.to, amount: s.amount, label: s.label, nonce });
      transfers.push(res);
      if (res.status === "sent") nonce++;
    }
  }

  // "sent" only if every non-zero slice actually broadcast.
  const attempted = transfers.filter((t) => t.status !== "skipped:zero");
  const ok = attempted.length > 0 && attempted.every((t) => t.status === "sent");
  return { status: ok ? "sent" : attempted.length ? "partial" : "nothing", opsWallet: opsTo, transfers };
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
    /* fall through - treated as not-creator below */
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

  // pons v2: fees accrue to the shared escrow and are withdrawn with claim()
  // (native) / claimToken(asset) (custom pair). Recipients claim their whole
  // credited balance at once - there's no per-token claim on the escrow.
  try {
    const provider = rpcProvider(chain);
    const launch = await resolveLaunch(provider, chain, token);
    if (launch) {
      const signer = deriveSigner(session.id, chain);
      const owner = await signer.getAddress();
      const esc = new Contract(v2Config(chain).escrow, ESCROW_ABI, signer);
      let hash = null;
      const claimed = [];
      const nativeOwed = await esc.balanceOf(owner).catch(() => 0n);
      if (nativeOwed > 0n) {
        const tx = await esc.claim();
        const r = await tx.wait();
        hash = r?.hash || tx.hash;
        claimed.push("ETH");
      }
      if (!launch.isNativeQuote) {
        const owed = await esc.balanceOfToken(owner, launch.pairToken).catch(() => 0n);
        if (owed > 0n) {
          const tx = await esc.claimToken(launch.pairToken);
          const r = await tx.wait();
          hash = r?.hash || tx.hash;
          claimed.push("token");
        }
      }
      if (!claimed.length) {
        return NextResponse.json({ error: "Nothing to claim right now." }, { status: 400 });
      }
      return NextResponse.json({ ok: true, hash, claimed, v2: true, explorer: chain.explorer });
    }
  } catch (error) {
    return NextResponse.json(
      { error: `Claim failed: ${error.shortMessage || error.reason || error.message}` },
      { status: 400 }
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
      { error: "This locker exposes no automatic claim - fees may accrue directly to your wallet, or need the Pons app to collect." },
      { status: 501 }
    );
  }

  const iface = new Interface([claimFn]);
  // Recipient of the claim is the creator's own wallet (never a client value).
  const args = (claimFn.inputs || []).map((i) => (i.type === "address" ? (i === claimFn.inputs[0] ? token : wallet) : 0));
  const data = iface.encodeFunctionData(claimFn.name, args);

  const provider = rpcProvider(chain);

  // The AURN split skims a slice of what the claim credits the creator's wallet,
  // so read the baseline BEFORE claiming - with retries, so a transient RPC blip
  // can't silently disable the split. If it genuinely can't be read, refuse to
  // claim yet (fail closed) rather than pay the creator their full 70% and leave
  // AURN's slice stranded with no way to recover it.
  const weth = chain.pons?.weth;
  const doSplit = aurnCutEnabled() && weth && isAddress(weth);
  let before = null;
  if (doSplit) {
    try {
      before = {
        token: await readBalRetry(provider, token, wallet),
        weth: await readBalRetry(provider, weth, wallet),
      };
    } catch {
      return NextResponse.json(
        {
          error: "The network is busy, so the AURN split couldn't be prepared. Nothing was claimed - try again in a moment.",
          retryable: true,
        },
        { status: 503 }
      );
    }
  }

  // Dry-run first: a revert here is a clean message, not a burnt tx.
  try {
    await provider.call({ to: locker, data, from: wallet });
  } catch (error) {
    const reason = error?.shortMessage || error?.reason || error?.message || "the claim would revert";
    return NextResponse.json(
      {
        error: "No fees to claim yet - creator fees build up as your coin is traded. Check back once there's some volume.",
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

  // Skim AURN's 10% once the fees have landed (AURN_FEE_SPLIT=on only). Poll for
  // the credited amount first to beat read-after-write lag. Best effort: the
  // claim already paid the creator, so a skim problem never fails it - it's
  // reported as pending so the UI can show it plainly instead of hiding it.
  let distribution = null;
  if (doSplit && before) {
    try {
      const received = await waitForCredit(provider, { token, weth, wallet, before });
      if (received.token > 0n || received.weth > 0n) {
        distribution = await skimAurnSplit({ chain, xUserId: session.id, wallet, token, weth, received });
        distribution.received = { token: received.token.toString(), weth: formatUnits(received.weth, 18) };
      } else {
        distribution = {
          status: "pending",
          note: "Couldn't confirm the claimed amount in time, so AURN's 10% wasn't sent.",
          opsWallet: opsWallet(),
        };
      }
    } catch (error) {
      distribution = {
        status: "pending",
        note: "AURN's 10% couldn't be sent.",
        detail: error?.shortMessage || error?.message,
        opsWallet: opsWallet(),
      };
    }
  }

  return NextResponse.json({
    ok: true,
    hash,
    block: receipt?.blockNumber ?? null,
    explorer: chain.explorer,
    split: doSplit ? { creator: 60, protocol: 30, buyback: 5, ops: 5 } : null,
    distribution,
  });
}
