import crypto from "node:crypto";

/**
 * AURN API keys — bearer tokens for the MCP server.
 *
 * A key is a signed, stateless token that carries the owner's X user id. The MCP
 * server verifies it and derives that user's custodial wallet, so a key grants
 * spend authority over exactly that wallet (and nothing else). Treat it like a
 * password: anyone holding it can trade and launch as you (when the operator has
 * MCP writes enabled).
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

export function createKey({ id, username }) {
  const payload = { sub: String(id), u: username || null, t: "mcp", iat: Date.now() };
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
    if (p.t !== "mcp" || !p.sub) return null;
    return { id: p.sub, username: p.u || null };
  } catch {
    return null;
  }
}
