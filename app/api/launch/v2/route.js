import { NextResponse } from "next/server";
import { Contract, ZeroAddress, formatEther, getAddress } from "ethers";
import { deriveSigner, getChain } from "@/lib/engine";
import {
  FACTORY_ABI,
  isConfigured,
  v2Config,
  chooseLaunchConfigId,
  previewLaunchEconomics,
  launchFee,
  tokenParams,
  parseLaunched,
} from "@/lib/engine/ponsV2";
import { getSession } from "@/lib/session";

/**
 * POST /api/launch/v2 — launch a token on pons v2, signed with the caller's X wallet.
 *
 * The whole v2 launch is done server-side so it's always correct:
 *  • the launch config is chosen from the factory's open list (freshest terms),
 *  • the economics pin is read immediately before the call, so the launch can
 *    never settle on terms the caller didn't see (reverts instead),
 *  • the launch fee is read from `launchFee()` and sent as the exact value,
 *  • the creator-fee recipient defaults to the caller's own wallet (creator 100%),
 *    overridable to an ESKA splitter/wallet via env for a protocol cut later.
 *
 * Nothing the client says is trusted for the parts that move money: the wallet
 * is derived from the SESSION, and the recipient/tax/buyback come from server
 * config, not the request.
 */

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Expected a JSON body." }, { status: 400 });
  }

  const {
    name,
    symbol,
    logo = "",
    description = "",
    socials = {},
    network = "robinhood",
  } = body || {};

  if (!name || !symbol) {
    return NextResponse.json({ error: "A name and symbol are required." }, { status: 400 });
  }

  let session;
  try {
    session = await getSession();
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!session) {
    return NextResponse.json(
      { error: "Sign in with X first — the launch is signed with your X wallet." },
      { status: 401 }
    );
  }

  let chain;
  try {
    chain = getChain(network);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  if (!isConfigured(chain)) {
    return NextResponse.json({ error: "pons v2 is not configured on this network." }, { status: 400 });
  }

  let signer;
  try {
    signer = deriveSigner(session.id, chain);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const owner = await signer.getAddress();
  const provider = signer.provider;
  const cfg = v2Config(chain);
  const factory = new Contract(cfg.factory, FACTORY_ABI, signer);

  // Fee routing (server-controlled). Default: the creator keeps 100% — their own
  // wallet is the recipient. Set PONS_V2_FEE_RECIPIENT (an ESKA splitter/wallet)
  // and PONS_V2_CREATOR_TAX_BPS to route a protocol/buyback cut later.
  let creatorFeeRecipient = owner;
  if (process.env.PONS_V2_FEE_RECIPIENT) {
    try { creatorFeeRecipient = getAddress(process.env.PONS_V2_FEE_RECIPIENT); } catch { /* keep owner */ }
  }
  const creatorTaxBps = Number(process.env.PONS_V2_CREATOR_TAX_BPS || 0) || 0;
  const buybackEnabled = String(process.env.PONS_V2_BUYBACK || "").toLowerCase() === "on";
  const pairToken = ZeroAddress; // native ETH launch

  try {
    // Gate: launching may be whitelist-restricted.
    try {
      const enabled = await factory.launchEnabled();
      if (!enabled) {
        const ok = await factory.whitelistedLaunchers(owner).catch(() => false);
        if (!ok) {
          return NextResponse.json(
            { error: "Launching is currently limited to approved addresses on pons v2." },
            { status: 403 }
          );
        }
      }
    } catch {
      /* if the gate can't be read, let the dry-run below be the source of truth */
    }

    // Choose an open config and pin its economics right before launching.
    const launchConfigId = await chooseLaunchConfigId(provider, chain);
    if (launchConfigId == null) {
      return NextResponse.json({ error: "No open launch configs on pons v2 right now." }, { status: 400 });
    }
    const [expectedEconomics, fee] = await Promise.all([
      previewLaunchEconomics(provider, chain, launchConfigId, pairToken),
      launchFee(provider, chain),
    ]);

    const params = tokenParams({
      name, symbol, logo, description, socials,
      creatorFeeRecipient, creatorTaxBps, buybackEnabled, expectedEconomics,
    });

    // Affordability: the exact launch fee plus gas headroom.
    const balance = await provider.getBalance(owner);
    if (balance <= fee) {
      return NextResponse.json(
        {
          error: `Your X wallet holds ${Number(formatEther(balance)).toFixed(6)} ETH, which doesn't cover the ${Number(formatEther(fee)).toFixed(6)} ETH launch fee plus gas.`,
          hint: "Send ETH to your X wallet address on the Profile tab first.",
        },
        { status: 400 }
      );
    }

    // Dry-run first — a revert here costs nothing and returns a clean message.
    try {
      await factory.launchToken.staticCall(params, launchConfigId, pairToken, { value: fee });
    } catch (error) {
      return NextResponse.json(
        {
          error: `Simulation reverted, so nothing was sent: ${error.shortMessage || error.reason || error.message}`,
          hint: "The factory rejected these terms. This is often the economics pin moving — try again.",
        },
        { status: 400 }
      );
    }

    const tx = await factory.launchToken(params, launchConfigId, pairToken, { value: fee });
    const receipt = await tx.wait();
    if (receipt.status === 0) {
      return NextResponse.json(
        { error: "The launch was mined but reverted. Nothing was created.", hash: tx.hash },
        { status: 400 }
      );
    }

    const { token, curve } = parseLaunched(receipt);
    return NextResponse.json({
      ok: true,
      hash: tx.hash,
      token,
      curve,
      owner,
      launchConfigId,
      version: 2,
      explorer: chain.explorer,
    });
  } catch (error) {
    console.error("pons v2 launch failed:", error);
    const message = error.shortMessage || error.reason || error.message || "The launch failed.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
