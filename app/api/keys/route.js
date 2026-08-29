import { NextResponse } from "next/server";
import { isAddress, getAddress } from "ethers";
import { createKey } from "@/lib/apikey";

/**
 * POST /api/keys - mint a read-only AURN API key for a connected wallet.
 *
 * Body: { address }. The key is a stateless signed token that carries only that
 * wallet address, so it grants read access to that wallet's portfolio (all public
 * on-chain data) and nothing more - it can never move funds. AURN is
 * non-custodial, so there is no server-side wallet to spend from.
 *
 * The key is not stored, so it can't be listed or revoked individually; minting a
 * new one doesn't invalidate an old one.
 */
export async function POST(request) {
  let address;
  try {
    const body = await request.json();
    address = body?.address;
  } catch {
    address = null;
  }

  if (!address || !isAddress(address)) {
    return NextResponse.json(
      { error: "Connect your wallet first - a key is tied to your wallet address." },
      { status: 400 }
    );
  }

  let key;
  try {
    key = createKey({ address });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ key, address: getAddress(address) });
}
