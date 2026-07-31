"use strict";

/**
 * ESKA activity stats — trade volume and referrals, for the leaderboards.
 *
 * Same storage model as the launch registry: Upstash / Vercel KV REST when
 * KV_REST_API_URL + KV_REST_API_TOKEN are set (durable and shared across
 * serverless instances), otherwise an in-memory fallback that resets on cold
 * start (fine for a demo, not for production). Both boards rank real, ESKA-native
 * activity recorded as it happens — nothing here is invented.
 */

function kvConfigured() {
  return Boolean(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);
}
function kvHeaders() {
  return { Authorization: `Bearer ${process.env.KV_REST_API_TOKEN}` };
}
/** One Upstash REST command, path-style (same shape the registry uses). */
async function kv(command) {
  const url = `${process.env.KV_REST_API_URL.replace(/\/+$/, "")}/${command
    .map((p) => encodeURIComponent(String(p)))
    .join("/")}`;
  const res = await fetch(url, { headers: kvHeaders(), cache: "no-store" });
  if (!res.ok) throw new Error(`KV ${command[0]} failed: HTTP ${res.status}`);
  return res.json();
}

/** Upstash returns hashes as a flat [field, value, field, value] array. */
function pairsToMap(result) {
  const map = {};
  const arr = Array.isArray(result) ? result : [];
  for (let i = 0; i < arr.length; i += 2) map[arr[i]] = arr[i + 1];
  return map;
}

const normHandle = (h) => String(h || "").replace(/^@/, "").trim();
const normCode = (c) => String(c || "").replace(/^@/, "").replace(/[^a-zA-Z0-9_]/g, "").trim();

/* ─── Trade volume (per network) ──────────────────────────────────────────── */

const VOL_KEY = (network) => `eska:vol:${network}`;
const memVol = new Map(); // network -> Map(handleLower -> { handle, vol })

/**
 * Add one trade's WETH-denominated size to a trader's cumulative volume. Keyed by
 * X handle (lowercased) so a trader's volume aggregates across sessions; the
 * original-case handle is kept in a names hash for display.
 */
async function recordTrade({ network = "robinhood", handle, wethValue }) {
  const h = normHandle(handle);
  const v = Number(wethValue);
  if (!h || !Number.isFinite(v) || v <= 0) return { counted: false };
  const key = h.toLowerCase();
  if (kvConfigured()) {
    await kv(["zincrby", VOL_KEY(network), String(v), key]);
    await kv(["hset", `${VOL_KEY(network)}:names`, key, h]).catch(() => {});
    return { counted: true, persisted: true };
  }
  const m = memVol.get(network) || new Map();
  const cur = m.get(key) || { handle: h, vol: 0 };
  cur.vol += v;
  cur.handle = h;
  m.set(key, cur);
  memVol.set(network, m);
  return { counted: true, persisted: false };
}

async function topTraders({ network = "robinhood", limit = 25 } = {}) {
  if (kvConfigured()) {
    try {
      const json = await kv(["zrange", VOL_KEY(network), "0", String(limit - 1), "rev", "withscores"]);
      const arr = Array.isArray(json?.result) ? json.result : [];
      const names = await kv(["hgetall", `${VOL_KEY(network)}:names`]).catch(() => ({ result: [] }));
      const nameMap = pairsToMap(names?.result);
      const rows = [];
      for (let i = 0; i < arr.length; i += 2) rows.push({ handle: nameMap[arr[i]] || arr[i], volumeWeth: Number(arr[i + 1]) || 0 });
      return rows;
    } catch {
      return [];
    }
  }
  const m = memVol.get(network) || new Map();
  return [...m.values()]
    .map((r) => ({ handle: r.handle, volumeWeth: r.vol }))
    .sort((a, b) => b.volumeWeth - a.volumeWeth)
    .slice(0, limit);
}

/* ─── Referrals ───────────────────────────────────────────────────────────── */

const REF_BOARD = "eska:ref:board";
const REF_SEEN = "eska:ref:seen";
const memRefSeen = new Set();
const memRefBoard = new Map(); // codeLower -> { code, count }

/**
 * Credit a referrer for a new sign-in through their code. Each referee is
 * credited to exactly the FIRST referrer that brought them (a global seen-set),
 * so re-using a different link later can't inflate a second referrer, and
 * self-referral is filtered by the caller.
 */
async function recordReferral({ referrerCode, refereeId }) {
  const code = normCode(referrerCode);
  const referee = String(refereeId || "").trim();
  if (!code || !referee) return { counted: false };
  const key = code.toLowerCase();
  if (kvConfigured()) {
    const added = await kv(["sadd", REF_SEEN, referee]);
    if (Number(added?.result) !== 1) return { counted: false, reason: "already-referred" };
    await kv(["zincrby", REF_BOARD, "1", key]);
    await kv(["hset", `${REF_BOARD}:names`, key, code]).catch(() => {});
    return { counted: true, persisted: true };
  }
  if (memRefSeen.has(referee)) return { counted: false, reason: "already-referred" };
  memRefSeen.add(referee);
  const cur = memRefBoard.get(key) || { code, count: 0 };
  cur.count += 1;
  memRefBoard.set(key, cur);
  return { counted: true, persisted: false };
}

async function topReferrers({ limit = 25 } = {}) {
  if (kvConfigured()) {
    try {
      const json = await kv(["zrange", REF_BOARD, "0", String(limit - 1), "rev", "withscores"]);
      const arr = Array.isArray(json?.result) ? json.result : [];
      const names = await kv(["hgetall", `${REF_BOARD}:names`]).catch(() => ({ result: [] }));
      const nameMap = pairsToMap(names?.result);
      const rows = [];
      for (let i = 0; i < arr.length; i += 2) rows.push({ code: nameMap[arr[i]] || arr[i], count: Number(arr[i + 1]) || 0 });
      return rows;
    } catch {
      return [];
    }
  }
  return [...memRefBoard.values()]
    .map((r) => ({ code: r.code, count: r.count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

module.exports = { recordTrade, topTraders, recordReferral, topReferrers };
