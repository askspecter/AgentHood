"use strict";

/**
 * Creator-fee policy for AURN launches.
 *
 * pons splits pool fees on-chain: a fixed protocol share (30%) to pons, the rest
 * to whatever address is set as the creator-fee recipient at launch. AURN cannot
 * change pons' 30%. What AURN *can* do is take a slice of the creator's share —
 * 60% stays with the creator, and 10% goes to AURN: 5% to the $AURN buyback-and-burn
 * collector and 5% to the ops wallet.
 *
 * This is OFF until AURN_FEE_SPLIT=on. While off, fees go straight to the
 * creator's own wallet (pons-native 70/30) and nothing is diverted — so a
 * launched creator can always reach their fees even before the split is live.
 */

function aurnCutEnabled() {
  return String(process.env.AURN_FEE_SPLIT || "").trim().toLowerCase() === "on";
}

/** The split shown in the UI and used at claim time. */
function feeSplit() {
  if (aurnCutEnabled()) {
    return { creator: 60, protocol: 30, buyback: 5, ops: 5, aurn: true };
  }
  return { creator: 70, protocol: 30, buyback: 0, ops: 0, aurn: false };
}

/**
 * Where the 10% AURN share is sent. Defaults to the AURN ops wallet; set
 * AURN_OPS_WALLET to override. (Only used when the split is on.) Burning any of
 * it is done manually from this wallet, not on-chain here.
 */
const DEFAULT_OPS_WALLET = "0x5eBbB80A5E52833dC122d181EBdbD4eBF70Dddb2";
function opsWallet() {
  return process.env.AURN_OPS_WALLET || DEFAULT_OPS_WALLET;
}

module.exports = { aurnCutEnabled, feeSplit, opsWallet };
