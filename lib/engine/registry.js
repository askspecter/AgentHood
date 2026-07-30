"use strict";

const { getAddress } = require("ethers");
const { hiddenTokenSet, isHiddenToken } = require("./launches");

/**
 * Registry of tokens launched through THIS site.
 *
 * On-chain there is nothing to distinguish a launch made here from one made on
 * ponsfamily.com — the factory records the visitor's wallet as deployer either
 * way, which is correct but means the chain cannot tell us whose front end was
 * used. So we record it ourselves when a launch succeeds here.
 *
 * Storage is pluggable:
 *   • Upstash / Vercel KV REST if KV_REST_API_URL + KV_REST_API_TOKEN are set —
 *     survives restarts and is shared across serverless instances.
 *   • otherwise an in-memory set, which resets on cold start. Fine for a demo,
 *     not for production: set the KV variables before you expect the list to
 *     persist.
 */

const KEY = "pons:launched";
const memory = new Set();

/**
 * The site's own token, $CABLE.
 *
 * It was launched on ponsfamily.com, so it is not in this registry the way a
 * token made through the Create flow here would be. This is how the canonical
 * $CABLE is always pinned to the top of "launched here", marked official, and
 * never confused with a copycat that reuses the ticker. The socials ride along
 * so the official card can link X / Telegram / site — links that the launch
 * description itself is not allowed to carry.
 *
 * Overridable for a fork; set OFFICIAL_TOKEN="" to drop the pin entirely.
 */
/**
 * The pinned official token — $PONS. Pinned to the top of "launched here" and
 * marked official so the UI can give it the gold verified check. Override any
 * field with OFFICIAL_* env, or set OFFICIAL_TOKEN="" to unpin entirely.
 */
const DEFAULT_OFFICIAL = {
  token: "0x39dBED3a2bd333467115dE45665cC57F813C4571",
  symbol: "PONS",
  name: "PONS",
  x: "",
};
function officialToken() {
  // Unset env → the $ESKA default; OFFICIAL_TOKEN="" → nothing pinned.
  const raw = process.env.OFFICIAL_TOKEN ?? DEFAULT_OFFICIAL.token;
  if (!raw) return null;
  try {
    const xhRaw = process.env.OFFICIAL_X ?? DEFAULT_OFFICIAL.x;
    const xh = (xhRaw || "").replace(/^@/, "");
    const socials = {};
    if (xh) socials.x = `https://x.com/${xh}`;
    if (process.env.OFFICIAL_TELEGRAM) socials.telegram = process.env.OFFICIAL_TELEGRAM;
    if (process.env.OFFICIAL_WEBSITE) socials.website = process.env.OFFICIAL_WEBSITE;
    return {
      token: getAddress(raw),
      official: true,
      // Fallbacks used only if a metadata read hiccups; on-chain name/symbol win.
      symbol: process.env.OFFICIAL_SYMBOL || DEFAULT_OFFICIAL.symbol,
      name: process.env.OFFICIAL_NAME || DEFAULT_OFFICIAL.name,
      logo: process.env.OFFICIAL_LOGO || undefined,
      xUsername: xh || null,
      socials,
    };
  } catch {
    // A malformed override drops the pin rather than crashing the feed.
    return null;
  }
}

function kvConfigured() {
  return Boolean(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);
}

function kvHeaders() {
  return { Authorization: `Bearer ${process.env.KV_REST_API_TOKEN}` };
}

async function kvCommand(command) {
  const url = `${process.env.KV_REST_API_URL.replace(/\/+$/, "")}/${command
    .map((part) => encodeURIComponent(part))
    .join("/")}`;
  const res = await fetch(url, { headers: kvHeaders(), cache: "no-store" });
  if (!res.ok) throw new Error(`KV ${command[0]} failed: HTTP ${res.status}`);
  return res.json();
}

/** Record a token as launched here. Idempotent. */
async function recordLaunch(tokenAddress, meta = {}) {
  const token = getAddress(tokenAddress);
  const entry = JSON.stringify({
    token,
    at: Date.now(),
    txHash: meta.txHash || null,
    deployer: meta.deployer ? getAddress(meta.deployer) : null,
    // The chain only knows the deployer wallet; the X handle is the human behind
    // it, so the feed can credit "@name" instead of a hex address for our launches.
    xUsername: typeof meta.xUsername === "string" ? meta.xUsername.replace(/^@/, "") : null,
  });

  if (kvConfigured()) {
    // A sorted set keyed by timestamp gives newest-first reads for free.
    await kvCommand(["zadd", KEY, String(Date.now()), entry]);
    return { token, persisted: true };
  }

  memory.add(entry);
  return { token, persisted: false };
}

/** Token addresses launched here, newest first. */
async function listLaunched({ limit = 50 } = {}) {
  let raw = [];
  let persisted = false;

  if (kvConfigured()) {
    try {
      const json = await kvCommand(["zrange", KEY, "0", String(limit - 1), "rev"]);
      raw = Array.isArray(json?.result) ? json.result : [];
      persisted = true;
    } catch {
      raw = [];
    }
  } else {
    raw = [...memory].reverse().slice(0, limit);
  }

  // Hidden tokens (test launches, mistakes) stay in storage but never in the
  // list — same HIDDEN_TOKENS filter the feed applies.
  const hidden = hiddenTokenSet();
  let entries = [];
  for (const item of raw) {
    try {
      const entry = typeof item === "string" ? JSON.parse(item) : item;
      if (!isHiddenToken(entry?.token, hidden)) entries.push(entry);
    } catch {
      /* skip a corrupt row rather than failing the whole list */
    }
  }

  // Pin the site's own token to the front, marked official. It lives on pons and
  // not in this registry, so without this it would never show under "launched
  // here" at all. If it was also recorded here, its stored fields are kept and
  // the official flag + socials are merged on top.
  const official = officialToken();
  if (official && !isHiddenToken(official.token, hidden)) {
    const key = official.token.toLowerCase();
    const existing = entries.find((e) => String(e.token).toLowerCase() === key);
    const rest = entries.filter((e) => String(e.token).toLowerCase() !== key);
    entries = [{ ...(existing || {}), ...official }, ...rest];
  }

  // The memory warning is about the durability of user launches, not the pinned
  // official token — so it stays quiet when the only entry is the pin.
  const userEntries = entries.filter((e) => !e.official).length;

  return {
    entries,
    tokens: entries.map((e) => e.token),
    persisted,
    warning:
      persisted || userEntries === 0
        ? null
        : "This list is held in memory and resets when the server restarts. Set KV_REST_API_URL and KV_REST_API_TOKEN to make it durable.",
  };
}

module.exports = { recordLaunch, listLaunched, kvConfigured };
