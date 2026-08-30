import { Contract } from "ethers";

/**
 * Shared token-logo resolution for the API routes.
 *
 * A token's image can be an on-chain logo() (often ipfs://…), or missing, in
 * which case the block explorer usually has an icon. `resolveTokenLogo` returns
 * a normalised URL, and `proxifyLogo` routes it through the same-origin image
 * proxy (/api/img) so mobile clients never have to reach a public IPFS gateway.
 */

/** Normalise a stored logo value to something a browser can load. */
export function normLogo(raw) {
  if (!raw || typeof raw !== "string") return null;
  const s = raw.trim();
  if (!s) return null;
  if (s.startsWith("ipfs://")) return `https://ipfs.io/ipfs/${s.replace(/^ipfs:\/\/(ipfs\/)?/, "")}`;
  const m = s.match(/\/api\/logo\?id=[A-Za-z0-9_-]+/);
  if (m) return m[0];
  if (/^https?:\/\//.test(s) || s.startsWith("data:")) return s;
  return null;
}

/**
 * The token's icon from the block explorer (Blockscout), used when the token has
 * no usable on-chain logo(). This is how a Pons/Doppler token's real image shows.
 */
export async function explorerTokenIcon(explorer, token) {
  if (!explorer || !token) return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);
  try {
    const url = `${String(explorer).replace(/\/+$/, "")}/api/v2/tokens/${token}`;
    const res = await fetch(url, { headers: { accept: "application/json" }, cache: "no-store", signal: controller.signal });
    if (!res.ok) return null;
    const j = await res.json();
    return j?.icon_url || j?.image_url || null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Resolve one token's logo: prefer its on-chain logo(), fall back to the block
 * explorer icon. Returns a normalised URL (not yet proxied) or null.
 */
export async function resolveTokenLogo(provider, explorer, token) {
  let onchain = null;
  try {
    const c = new Contract(token, ["function logo() view returns (string)"], provider);
    onchain = await c.logo().catch(() => null);
  } catch { /* token has no logo() - fine */ }
  let resolved = normLogo(onchain);
  if (!resolved) resolved = normLogo(await explorerTokenIcon(explorer, token));
  return resolved;
}

/**
 * Route a resolved logo through the same-origin image proxy so mobile clients
 * only load a small WebP from this origin. Same-origin paths and data URLs pass
 * through unchanged.
 */
export function proxifyLogo(url) {
  if (!url) return null;
  if (url.startsWith("data:") || url.startsWith("/api/")) return url;
  if (/^https?:\/\//.test(url)) return `/api/img?src=${encodeURIComponent(url)}`;
  return url;
}
