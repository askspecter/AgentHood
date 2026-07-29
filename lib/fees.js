"use strict";

/**
 * Creator-fee policy for ESKA launches.
 *
 * pons splits pool fees on-chain: a fixed protocol share (30%) to pons, the rest
 * to whatever address is set as the creator-fee recipient at launch. ESKA cannot
 * change pons' 30%. What ESKA *can* do is redirect the creator's share to a
 * server-controlled collector and re-split it — 60% to the creator, 5% to a
 * $ESKA buyback-and-burn reserve, 5% to operations.
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
    return { creator: 60, protocol: 30, buyback: 5, ops: 5, eska: true };
  }
  return { creator: 70, protocol: 30, buyback: 0, ops: 0, eska: false };
}

/** Fixed id for the server-controlled fee collector (derived from the master secret). */
const COLLECTOR_ID = "eska:fee-collector:v1";

/** Explicit collector address override, if the operator set one. */
function collectorOverride() {
  return process.env.ESKA_FEE_COLLECTOR || "";
}

/** Where the 5% operations share is sent. Empty = keep it in the collector. */
function opsWallet() {
  return process.env.ESKA_OPS_WALLET || "";
}

module.exports = { eskaCutEnabled, feeSplit, opsWallet, collectorOverride, COLLECTOR_ID };
