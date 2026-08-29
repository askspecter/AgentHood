import { NextResponse } from "next/server";
import { getAddress } from "ethers";
import { deriveAddress, getChain, listLaunched } from "@/lib/engine";
import { getSession } from "@/lib/session";
import { feeSplit } from "@/lib/fees";

/**
 * GET /api/creator/status?token=0x…&network=robinhood
 *
 * Is the signed-in user the creator who launched this token here? Drives the
 * creator-only "Creator fees" panel and its Claim button. Creator = the deployer
 * wallet (their X wallet) or the X handle recorded in the registry at launch.
 */
export async function GET(request) {
  const url = new URL(request.url);
  const network = url.searchParams.get("network") || "robinhood";
  const tokenParam = url.searchParams.get("token");

  let token;
  try {
    token = getAddress(tokenParam);
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
  const split = feeSplit();
  const explorer = chain.explorer;
  if (!session) return NextResponse.json({ signedIn: false, isCreator: false, split, explorer });

  // Find the registry entry for this token.
  let entry = null;
  try {
    const reg = await listLaunched({ limit: 1000 });
    const key = token.toLowerCase();
    entry = (reg.entries || []).find((e) => String(e.token).toLowerCase() === key) || null;
  } catch {
    /* registry unavailable - treat as not-creator rather than erroring */
  }

  let payoutWallet = null;
  try {
    payoutWallet = deriveAddress(session.id);
  } catch {
    /* no wallet secret - can't derive; still answer the gate */
  }

  const byWallet =
    entry?.deployer && payoutWallet && entry.deployer.toLowerCase() === payoutWallet.toLowerCase();
  const byHandle =
    entry?.xUsername &&
    session.username &&
    entry.xUsername.toLowerCase() === session.username.replace(/^@/, "").toLowerCase();

  return NextResponse.json({
    signedIn: true,
    isCreator: Boolean(byWallet || byHandle),
    token,
    payoutWallet,
    creatorHandle: entry?.xUsername || null,
    split,
    explorer,
  });
}
