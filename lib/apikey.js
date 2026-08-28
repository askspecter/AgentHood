import crypto from "node:crypto";

/**
 * AURN API keys — read-only bearer tokens for the MCP server.
 *
 * AURN is non-custodial: the app never holds a wallet or a private key, so a key
 * can never move funds. A key is a signed, stateless token that carries only the
 * wallet address it was generated for, so an AI client can read that wallet's
 * portfolio (all public on-chain data). To trade or launch, the owner comes back
 * to AURN and signs in their own wallet — the key cannot.
 *
 * Signed with MCP_KEY_SECRET (falls back to SESSION_SECRET). A distinct purpose
 * tag ("t":"mcp") keeps it from being interchangeable with a session cookie.
 */

const PREFIX = "aurn_mcp_";

function secret() {
  const value = process.env.MCP_KEY_SECRET || process.env.SESSION_SECRET;
  if (!value || value.length < 32) {
    throw new Error("MCP_KEY_SECRET (or SESSION_SECRET) is missing or too short (need 32+ characters).");
  }
  return value;
}

export function createKey({ address }) {
  const addr = String(address || "").toLowerCase();
  if (!/^0x[0-9a-f]{40}$/.test(addr)) {
    throw new Error("A valid wallet address is required to mint a key.");
  }
  const payload = { addr, t: "mcp", iat: Date.now() };
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const mac = crypto.createHmac("sha256", secret()).update(body).digest("base64url");
  return PREFIX + body + "." + mac;
}

export function verifyKey(key) {
  if (typeof key !== "string" || !key.startsWith(PREFIX)) return null;
  const [body, mac] = key.slice(PREFIX.length).split(".");
  if (!body || !mac) return null;
  const expected = crypto.createHmac("sha256", secret()).update(body).digest("base64url");
  const a = Buffer.from(mac);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const p = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    if (p.t !== "mcp" || !p.addr) return null;
    return { address: p.addr };
  } catch {
    return null;
  }
}
