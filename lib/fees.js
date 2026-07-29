"use strict";

/**
 * Creator-fee policy for ESKA launches.
 *
 * pons splits pool fees on-chain: a fixed protocol share (30%) to pons, the rest
 * to whatever address is set as the creator-fee recipient at launch. ESKA cannot
 * change pons' 30%. What ESKA *can* do is take a slice of the creator's share —
 * 60% stays with the creator, 10% goes to the ESKA ops wallet.
 *
 * This is OFF until ESKA_FEE_SPLIT=on. While off, fees go straight to the
 * creator's own wallet (pons-native 70/30) and nothing is diverted — so a
 * launched creator can always reach their fees even before the split is live.
 */

function eskaCutEnabled() {
  return String(process.env.ESKA_FEE_SPLIT || "").trim().toLowerCase() === "on";
}

/** The split shown in the UI and used at claim time. */
function feeSplit() {
  if (eskaCutEnabled()) {
    return { creator: 60, protocol: 30, ops: 10, eska: true };
  }
  return { creator: 70, protocol: 30, ops: 0, eska: false };
}

/**
 * Where the 10% ESKA share is sent. Defaults to the ESKA ops wallet; set
 * ESKA_OPS_WALLET to override. (Only used when the split is on.) Burning any of
 * it is done manually from this wallet, not on-chain here.
 */
const DEFAULT_OPS_WALLET = "0x5eBbB80A5E52833dC122d181EBdbD4eBF70Dddb2";
function opsWallet() {
  return process.env.ESKA_OPS_WALLET || DEFAULT_OPS_WALLET;
}

module.exports = { eskaCutEnabled, feeSplit, opsWallet };
