"use strict";

const { getAddress } = require("ethers");

/**
 * Discover every ERC-20 a wallet actually holds - not just the launches this
 * site knows about.
 *
 * The launch-feed scan only sees tokens deployed through pons inside a bounded
 * block window, so a stock token, an airdrop, or an older position is invisible
 * to it. The chain itself knows better: an ERC-20 credits a wallet with a
 * `Transfer` event whose second indexed topic IS the recipient. So we ask the
 * node for every `Transfer` addressed to (and from) the wallet, collect the
 * contract that emitted each one, and that set is every token the wallet has
 * ever touched. Reading `balanceOf` on each then says which it still holds.
 *
 * This is exactly how a block explorer builds a token list without an indexer,
 * and it needs no third-party API - only the RPC the app already talks to.
 */

/** keccak256("Transfer(address,address,uint256)") - same for every ERC-20. */
const TRANSFER_TOPIC =
  "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";

/** A 20-byte address as a 32-byte, left-padded, lower-case log topic. */
function addressTopic(address) {
  return "0x" + address.slice(2).toLowerCase().padStart(64, "0");
}

/**
 * Scan `Transfer` logs in bounded, newest-first chunks and return the set of
 * token contracts involved.
 *
 * The public RPC times out on wide `eth_getLogs` ranges, so the window is cut
 * into chunks run in small concurrent batches. A chunk that fails (rate limit,
 * range too wide) is skipped rather than aborting the whole scan - a partial
 * token list is still far better than none, and `truncated` reports it.
 */
async function scanTransferContracts(provider, topics, { fromBlock, toBlock, chunkSize, concurrency }) {
  const ranges = [];
  for (let end = toBlock; end >= fromBlock; end -= chunkSize) {
    ranges.push([Math.max(fromBlock, end - chunkSize + 1), end]);
  }

  const contracts = new Set();
  let truncated = false;

  for (let i = 0; i < ranges.length; i += concurrency) {
    const batch = ranges.slice(i, i + concurrency);
    const results = await Promise.all(
      batch.map(async ([start, end]) => {
        try {
          return await provider.getLogs({
            fromBlock: start,
            toBlock: end,
            topics,
          });
        } catch {
          truncated = true;
          return null;
        }
      })
    );
    for (const logs of results) {
      if (!logs) continue;
      for (const log of logs) {
        // An ERC-20 `Transfer` has exactly three topics (sig, from, to); an
        // ERC-721 adds a fourth (the indexed tokenId). Keeping only the
        // three-topic shape drops NFTs, which have no fungible balance to price.
        if (log.topics?.length !== 3) continue;
        try {
          contracts.add(getAddress(log.address));
        } catch {
          /* a malformed log address must not break the scan */
        }
      }
    }
  }

  return { contracts, truncated };
}

/**
 * Every ERC-20 contract the wallet has received or sent, over a recent window.
 *
 * Both directions are scanned: incoming finds tokens acquired, outgoing catches
 * a token bought and partially sent that the wallet still holds a remainder of.
 * The two topic filters are cheap because the wallet address is indexed, so the
 * node only returns logs that already mention it.
 *
 * @returns {Promise<{tokens: string[], truncated: boolean, fromBlock: number, toBlock: number}>}
 */
async function discoverWalletTokens(provider, address, options = {}) {
  const owner = getAddress(address);
  const {
    maxBlocks = Number(process.env.HOLDINGS_MAX_BLOCKS) || 400_000,
    chunkSize = Number(process.env.HOLDINGS_CHUNK) || 10_000,
    concurrency = 6,
    startBlock = 0,
  } = options;

  const head = await provider.getBlockNumber();
  const fromBlock = Math.max(startBlock, head - maxBlocks);
  const topic = addressTopic(owner);

  // Incoming: Transfer(_, owner, _) → topics [sig, any-from, owner].
  // Outgoing: Transfer(owner, _, _) → topics [sig, owner, any-to].
  const [incoming, outgoing] = await Promise.all([
    scanTransferContracts(provider, [TRANSFER_TOPIC, null, topic], {
      fromBlock,
      toBlock: head,
      chunkSize,
      concurrency,
    }),
    scanTransferContracts(provider, [TRANSFER_TOPIC, topic], {
      fromBlock,
      toBlock: head,
      chunkSize,
      concurrency,
    }),
  ]);

  const tokens = new Set([...incoming.contracts, ...outgoing.contracts]);
  return {
    tokens: [...tokens],
    truncated: incoming.truncated || outgoing.truncated,
    fromBlock,
    toBlock: head,
  };
}

module.exports = { discoverWalletTokens, scanTransferContracts, TRANSFER_TOPIC, addressTopic };
