"use strict";

/**
 * Chainlink Data Feeds on Robinhood Chain.
 *
 * Robinhood Chain uses Chainlink as its oracle layer: ~57 on-chain USD price
 * feeds for tokenized equities (NVDA, AAPL, SPY, …) and crypto (BTC, ETH, LINK,
 * cbBTC, USDG …). We read them directly with the standard AggregatorV3 interface,
 * so every price AURN shows is verifiable on-chain against the feed contract.
 *
 * The feed addresses are maintained by Chainlink (the source of truth), so we
 * fetch the reference list at runtime and cache it rather than hardcoding it.
 *
 * Read-only. Nothing here signs a transaction or holds a key.
 */

const { JsonRpcProvider, Contract } = require("ethers");
const { getChain } = require("./chains");

const FEEDS_URL =
  process.env.CHAINLINK_FEEDS_URL ||
  "https://reference-data-directory.vercel.app/feeds-robinhood-mainnet.json";

const AGG_ABI = [
  "function latestRoundData() view returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound)",
];

// Feed-map cache: ticker (UPPER) -> { feed, decimals, name }. Refreshed rarely.
const MAP_TTL_MS = 30 * 60 * 1000;
let feedMap = null;
let feedMapAt = 0;

/** Pull the token ticker out of a Chainlink feed name, or null if not a plain
 *  "<TICKER> / USD" (or "-USD") feed we can use as a USD price. */
function tickerFromName(name) {
  let n = String(name || "").replace(/robinhood/i, "").trim();
  if (!/[/-]\s*usd$/i.test(n)) return null; // only straight USD feeds
  n = n.replace(/\s*[/-]\s*usd$/i, "").trim();
  if (!/^[A-Za-z0-9.]{1,8}$/.test(n)) return null; // skip exchange-rate/compound names
  return n.toUpperCase();
}

/** Load + cache the Robinhood Chainlink feed directory. Never throws. */
async function loadChainlinkFeeds() {
  const now = Date.now();
  if (feedMap && now - feedMapAt < MAP_TTL_MS) return feedMap;
  try {
    const res = await fetch(FEEDS_URL, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const rows = await res.json();
    const map = new Map();
    for (const f of Array.isArray(rows) ? rows : []) {
      const addr = f?.proxyAddress || f?.contractAddress;
      const ticker = tickerFromName(f?.name);
      if (!addr || !ticker || map.has(ticker)) continue;
      map.set(ticker, { feed: addr, decimals: Number(f.decimals) || 8, name: f.name });
    }
    if (map.size) { feedMap = map; feedMapAt = now; }
  } catch {
    /* keep any prior map; a cold miss just means no oracle prices this call */
  }
  return feedMap || new Map();
}

/**
 * Read live USD prices for `symbols` from Chainlink on Robinhood Chain.
 * @returns Map<UPPER_SYMBOL, { priceUsd, feed, updatedAt, decimals }>
 */
async function readChainlinkPrices(symbols, network = "robinhood") {
  const out = new Map();
  const wanted = [...new Set((symbols || []).map((s) => String(s).toUpperCase()))];
  if (!wanted.length) return out;

  const map = await loadChainlinkFeeds();
  const jobs = wanted
    .map((sym) => ({ sym, meta: map.get(sym) }))
    .filter((x) => x.meta);
  if (!jobs.length) return out;

  let chain;
  try { chain = getChain(network); } catch { return out; }
  const provider = new JsonRpcProvider(chain.rpc, chain.chainId, { staticNetwork: true });

  await Promise.all(
    jobs.map(async ({ sym, meta }) => {
      try {
        const c = new Contract(meta.feed, AGG_ABI, provider);
        const rd = await c.latestRoundData();
        const answer = rd[1];
        const updatedAt = Number(rd[3]);
        const priceUsd = Number(answer) / 10 ** meta.decimals;
        if (Number.isFinite(priceUsd) && priceUsd > 0) {
          out.set(sym, { priceUsd, feed: meta.feed, updatedAt, decimals: meta.decimals });
        }
      } catch {
        /* one dead feed never fails the batch */
      }
    })
  );
  return out;
}

module.exports = { loadChainlinkFeeds, readChainlinkPrices, tickerFromName };
