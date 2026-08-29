import { NextResponse } from "next/server";

/**
 * GET /api/img?src=<url>
 *
 * A tiny same-origin image proxy for token logos.
 *
 * Token logos often live on IPFS (ipfs://…) or a slow/large remote host. On
 * mobile networks the public IPFS gateways are frequently blocked or time out,
 * so the browser's <img> errors and the UI falls back to a placeholder. This
 * route fetches the image server-side (where those gateways are reachable),
 * shrinks it to a small WebP, and serves it from this origin with a long
 * immutable cache - so the client only ever loads a light, same-origin image.
 *
 * Only http(s) and ipfs sources are allowed, obvious internal hosts are blocked,
 * and the output is always re-encoded to an image, so it can't be used as an
 * open proxy for arbitrary content.
 */
export const runtime = "nodejs";

const IPFS_GATEWAYS = [
  "https://ipfs.io/ipfs/",
  "https://gateway.pinata.cloud/ipfs/",
  "https://dweb.link/ipfs/",
];
const FETCH_TIMEOUT_MS = 8000;
const MAX_BYTES = 12 * 1024 * 1024; // don't pull anything huge
const OUT_SIZE = 128; // logos never render larger than this in the UI

/** Reject hosts that could point back into our own infrastructure. */
function isBlockedHost(host) {
  const h = String(host || "").toLowerCase();
  if (!h) return true;
  if (h === "localhost" || h.endsWith(".localhost")) return true;
  if (h === "127.0.0.1" || h.startsWith("127.") || h === "0.0.0.0" || h === "::1") return true;
  if (h.startsWith("10.") || h.startsWith("192.168.") || h.startsWith("169.254.")) return true;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(h)) return true;
  if (h.endsWith(".internal") || h === "metadata.google.internal") return true;
  return false;
}

/** Turn a stored logo value into an ordered list of fetchable URLs to try. */
function candidateUrls(src) {
  const s = String(src || "").trim();
  if (!s) return [];
  if (s.startsWith("ipfs://")) {
    const path = s.replace(/^ipfs:\/\/(ipfs\/)?/, "");
    return IPFS_GATEWAYS.map((g) => g + path);
  }
  // A bare CID (v0 Qm… or v1 baf…).
  if (/^(Qm[1-9A-HJ-NP-Za-km-z]{44}|baf[a-z0-9]{20,})$/.test(s)) {
    return IPFS_GATEWAYS.map((g) => g + s);
  }
  if (/^https?:\/\//i.test(s)) {
    try {
      const u = new URL(s);
      if (u.protocol !== "http:" && u.protocol !== "https:") return [];
      if (isBlockedHost(u.hostname)) return [];
      return [s];
    } catch {
      return [];
    }
  }
  return [];
}

async function fetchImage(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      cache: "no-store",
      redirect: "follow",
      signal: controller.signal,
      headers: { accept: "image/*,*/*" },
    });
    if (!res.ok) return null;
    const type = res.headers.get("content-type") || "";
    // Allow empty/generic types from IPFS gateways; sharp validates the bytes.
    if (type && !type.startsWith("image/") && !type.includes("octet-stream")) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (!buf.length || buf.length > MAX_BYTES) return null;
    return buf;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function GET(request) {
  const src = new URL(request.url).searchParams.get("src");
  const urls = candidateUrls(src);
  if (!urls.length) return NextResponse.json({ error: "Bad or unsupported src." }, { status: 400 });

  let raw = null;
  for (const u of urls) {
    raw = await fetchImage(u);
    if (raw) break;
  }
  if (!raw) return NextResponse.json({ error: "Could not load image." }, { status: 502 });

  try {
    const sharp = require("sharp");
    const out = await sharp(raw)
      .resize(OUT_SIZE, OUT_SIZE, { fit: "cover" })
      .webp({ quality: 82 })
      .toBuffer();
    return new NextResponse(out, {
      headers: {
        "Content-Type": "image/webp",
        // Keyed by the immutable source, so the bytes are safe to cache hard.
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return NextResponse.json({ error: "Could not process image." }, { status: 502 });
  }
}
