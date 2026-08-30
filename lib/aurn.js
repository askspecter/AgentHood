"use strict";

/**
 * $AURN token + buyback-and-burn configuration.
 *
 * The AURN share of creator fees funds a buyback-and-burn: WETH is collected to
 * a server-controlled wallet, swapped for $AURN, and the $AURN is sent to the
 * burn address - permanently removed from supply. The live burn total is read
 * straight off-chain from the burn address, so the counter on the site is always
 * verifiable, never a number we type in.
 */

/** Standard burn sinks. Anything here is out of circulation for good. */
const DEAD = "0x000000000000000000000000000000000000dEaD";
const ZERO = "0x0000000000000000000000000000000000000000";

/** The official token, from OFFICIAL_TOKEN. Empty until one is set (e.g. after a
 *  relaunch) - no hardcoded address. Drives the burn tracker and buyback. */
function aurnToken() {
  return process.env.OFFICIAL_TOKEN || "";
}

/** Server-controlled wallet that accumulates the WETH earmarked for buyback. */
const BUYBACK_ID = "aurn:buyback:v1";

/** Live buyback swap is OFF unless AURN_BUYBACK=on. (Real money - verify first.) */
function buybackEnabled() {
  return String(process.env.AURN_BUYBACK || "").trim().toLowerCase() === "on";
}

/**
 * Burns done outside the on-chain burn address (e.g. an early manual burn that
 * reduced supply directly) can be added to the on-chain figure via this baseline
 * so the counter reflects the true total. Default 0.
 */
function burnBaseline() {
  const n = Number(process.env.AURN_BURN_BASELINE || 0);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/** Admin secret required to trigger a buyback, so the endpoint isn't open to all. */
function adminSecret() {
  return process.env.AURN_ADMIN_SECRET || "";
}

module.exports = { DEAD, ZERO, aurnToken, BUYBACK_ID, buybackEnabled, burnBaseline, adminSecret };
