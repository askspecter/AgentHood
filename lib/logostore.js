"use strict";

/**
 * Durable logo storage for on-chain metadata.
 *
 * A launched token stores its logo as a URL, so the image behind it must never
 * disappear. AI-generated images (fal.ai) live on a temporary URL, and uploads
 * arrive as data URLs — neither is safe to put on-chain. This module takes any
 * such source, normalises it to a small square WebP, and stores the bytes in
 * Vercel KV (Upstash Redis REST) under a content-addressed key, returning a
 * stable path (/api/logo?id=…) this app serves forever.
 */

const crypto = require("node:crypto");

const PREFIX = "pons:logo:";
const TTL_SECONDS = 60 * 60 * 24 * 365 * 5; // 5 years
const MAX_INPUT_BYTES = 12 * 1024 * 1024; // sanity cap on a source image

function kvUrl() {
  return (process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || "").replace(/\/+$/, "");
}
function kvToken() {
  return process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || "";
}
function kvConfigured() {
  return Boolean(kvUrl() && kvToken());
}

async function kvGet(key) {
  const res = await fetch(`${kvUrl()}/get/${encodeURIComponent(key)}`, {
    headers: { Authorization: `Bearer ${kvToken()}` },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`KV get failed: HTTP ${res.status}`);
  return res.json(); // { result }
}

/** SET with the value in the POST body so large images don't blow the URL length. */
async function kvSet(key, value, ttlSeconds) {
  const url = `${kvUrl()}/set/${encodeURIComponent(key)}${ttlSeconds ? `?EX=${ttlSeconds}` : ""}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${kvToken()}`, "Content-Type": "text/plain" },
    body: value,
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`KV set failed: HTTP ${res.status}`);
  return res.json();
}

/** Any supported source → raw image bytes. */
async function toBytes(source) {
  if (Buffer.isBuffer(source)) return source;
  if (typeof source !== "string" || !source) throw new Error("No image source.");
  if (source.startsWith("data:")) {
    const comma = source.indexOf(",");
    if (comma === -1) throw new Error("Bad data URL.");
    return Buffer.from(source.slice(comma + 1), "base64");
  }
  if (/^https?:\/\//.test(source)) {
    const res = await fetch(source, { cache: "no-store" });
    if (!res.ok) throw new Error(`Fetch image failed: HTTP ${res.status}`);
    return Buffer.from(await res.arrayBuffer());
  }
  throw new Error("Unsupported image source.");
}

/**
 * Persist an image (Buffer, data URL, or http URL) to KV and return its stable
 * id + path. Content-addressed, so the same image stores once.
 */
async function persistImage(source) {
  if (!kvConfigured()) {
    const err = new Error("Storage (Vercel KV) is not configured.");
    err.code = "kv_not_configured";
    throw err;
  }
  const raw = await toBytes(source);
  if (!raw.length) throw new Error("Empty image.");
  if (raw.length > MAX_INPUT_BYTES) throw new Error("Image is too large.");

  // Normalise to a compact square WebP: keeps KV small and logos crisp/fast.
  let out, type;
  try {
    const sharp = require("sharp");
    out = await sharp(raw).resize(512, 512, { fit: "cover" }).webp({ quality: 82 }).toBuffer();
    type = "image/webp";
  } catch {
    out = raw;
    type = "image/png";
  }

  const id = crypto.createHash("sha256").update(out).digest("hex").slice(0, 32);
  await kvSet(PREFIX + id, JSON.stringify({ type, data: out.toString("base64") }), TTL_SECONDS);
  return { id, path: `/api/logo?id=${id}`, bytes: out.length };
}

module.exports = { persistImage, kvGet, kvConfigured, PREFIX };
