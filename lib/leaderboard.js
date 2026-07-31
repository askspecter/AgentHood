"use strict";

/**
 * Real ESKA leaderboards, backed by Upstash Redis sorted sets.
 *
 * Two boards are event-driven and stored here as scores that only ever grow:
 *   • trade volume  — USD swapped, summed per trader, bumped on every fill
 *   • referrals     — friends who signed in through someone's code, de-duped
 *
 * The third board (top creator) is derived live from the launch registry, so it
 * needs no store and lives in the API route. Everything here is best-effort:
 * recording must never break a trade or a sign-in, so every write is wrapped and
 * a missing KV simply means the boards stay empty rather than erroring.
 */

const VOL_KEY = "eska:lb:volume";
const REF_KEY = "eska:lb:referral";
const REF_SEEN = "eska:lb:ref:seen"; // set of referred user ids, for de-dupe
const NAME_KEY = "eska:lb:names"; // hash: member -> pretty display

function kvUrl() {
  return (process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || "").replace(/\/+$/, "");
}
function kvToken() {
  return process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || "";
}
function configured() {
  return Boolean(kvUrl() && kvToken());
}

/** Run one Redis command (array form) over the Upstash REST API. */
async function redis(command) {
  if (!configured()) return null;
  const res = await fetch(kvUrl(), {
    method: "POST",
    headers: { Authorization: `Bearer ${kvToken()}`, "Content-Type": "application/json" },
    body: JSON.stringify(command),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`KV command failed: HTTP ${res.status}`);
  const json = await res.json();
  return json.result;
}

/** Normalise a member key: a handle wins (stable, human), else the wallet. */
function memberFor({ handle, wallet }) {
  const h = (handle || "").replace(/^@/, "").trim().toLowerCase();
  if (h) return "h:" + h;
  const w = (wallet || "").trim().toLowerCase();
  return w ? "w:" + w : null;
}

/** How a member is shown: @handle, or a shortened address. */
function displayFor(member) {
  if (!member) return "anon";
  if (member.startsWith("h:")) return "@" + member.slice(2);
  const w = member.slice(2);
  return w.length > 10 ? `${w.slice(0, 6)}…${w.slice(-4)}` : w;
}

/** Add USD volume for a trader. Never throws. */
async function bumpVolume({ handle, wallet, usd }) {
  try {
    const member = memberFor({ handle, wallet });
    const amount = Number(usd);
    if (!member || !Number.isFinite(amount) || amount <= 0) return;
    await redis(["ZINCRBY", VOL_KEY, amount.toFixed(6), member]);
    if (handle) await redis(["HSET", NAME_KEY, member, "@" + handle.replace(/^@/, "")]);
  } catch {
    /* recording volume must never break a trade */
  }
}

/**
 * Credit a referrer for a friend's first sign-in. De-duped by the referred
 * user's id so re-signing never inflates the count, and self-referrals ignored.
 * Never throws.
 */
async function bumpReferral({ referrerCode, referredId, referredHandle }) {
  try {
    const ref = (referrerCode || "").replace(/^@/, "").trim().toLowerCase();
    const id = (referredId || "").trim();
    if (!ref || !id) return;
    // No self-referral.
    if (referredHandle && referredHandle.replace(/^@/, "").toLowerCase() === ref) return;
    const isNew = await redis(["SADD", REF_SEEN, id]);
    if (isNew === 1) {
      const member = "h:" + ref;
      await redis(["ZINCRBY", REF_KEY, 1, member]);
      await redis(["HSET", NAME_KEY, member, "@" + ref]);
    }
  } catch {
    /* recording a referral must never break sign-in */
  }
}

/** Top N of a board as [{ member, display, score }], highest first. */
async function top(key, n = 25) {
  try {
    const flat = await redis(["ZRANGE", key, 0, n - 1, "REV", "WITHSCORES"]);
    if (!Array.isArray(flat) || !flat.length) return [];
    const members = [];
    for (let i = 0; i < flat.length; i += 2) members.push([flat[i], Number(flat[i + 1])]);
    // Pretty names, if any were recorded.
    let names = {};
    try {
      const keys = members.map((m) => m[0]);
      const vals = await redis(["HMGET", NAME_KEY, ...keys]);
      if (Array.isArray(vals)) keys.forEach((k, i) => { if (vals[i]) names[k] = vals[i]; });
    } catch { /* names are cosmetic */ }
    return members.map(([member, score], i) => ({
      rank: i + 1,
      member,
      display: names[member] || displayFor(member),
      score,
    }));
  } catch {
    return [];
  }
}

const topVolume = (n) => top(VOL_KEY, n);
const topReferral = (n) => top(REF_KEY, n);

module.exports = { bumpVolume, bumpReferral, topVolume, topReferral, kvConfigured: configured };
