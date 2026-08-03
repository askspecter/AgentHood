import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { createKey } from "@/lib/apikey";

/**
 * POST /api/keys — mint an ESKA API key for the signed-in user.
 *
 * The key is a stateless signed token (no server storage), so it can't be listed
 * or revoked individually — generating a new one doesn't invalidate an old one.
 * It carries spend authority over the caller's custodial wallet through the MCP
 * server, so it's only ever returned to the authenticated owner, once, here.
 */
export async function POST() {
  const session = await getSession().catch(() => null);
  if (!session) {
    return NextResponse.json({ error: "Sign in with X first." }, { status: 401 });
  }
  let key;
  try {
    key = createKey({ id: session.id, username: session.username });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ key, username: session.username });
}
