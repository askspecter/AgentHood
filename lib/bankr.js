"use strict";

/**
 * Bankr token-launch integration.
 *
 * ESKA launches now deploy through Bankr (bankr.bot) instead of the pons
 * factory. Bankr deploys to Robinhood Chain by default and seeds a Uniswap V4
 * pool, so the coin is immediately tradeable and the creator earns swap fees.
 *
 * We use a user API key (bk_usr_…): partner keys are Base-only, and we want
 * Robinhood Chain. The deploying wallet is the key owner's Bankr wallet, but the
 * `feeRecipient` is set to the actual creator's ESKA wallet, so creator fees
 * flow to them. Set BANKR_API_KEY in the environment.
 */

const BASE = (process.env.BANKR_API_URL || "https://api.bankr.bot").replace(/\/+$/, "");

function apiKey() {
  return process.env.BANKR_API_KEY || "";
}
function isConfigured() {
  return Boolean(apiKey());
}

/** Pull the launched token address out of a deploy response, whatever it's called. */
function tokenFromResponse(json) {
  if (!json || typeof json !== "object") return null;
  const cand =
    json.tokenAddress ||
    json.token_address ||
    json.address ||
    json.token ||
    json.contractAddress ||
    (json.token && json.token.address) ||
    (json.data && (json.data.tokenAddress || json.data.address)) ||
    null;
  return typeof cand === "string" ? cand : null;
}

/**
 * Deploy a token via Bankr. Returns the raw response plus the resolved token
 * address. Throws with a clean message on failure.
 */
async function deployToken({
  tokenName,
  tokenSymbol,
  feeRecipient, // { type: "wallet"|"x"|"farcaster"|"ens", value }
  image,
  website,
  tweet,
  chain = "robinhood",
  disableVesting,
  quoteOnlyFees,
}) {
  if (!isConfigured()) {
    throw new Error("Bankr is not configured on this deployment (missing BANKR_API_KEY).");
  }
  const body = { tokenName, chain };
  if (tokenSymbol) body.tokenSymbol = String(tokenSymbol).replace(/^\$/, "");
  if (feeRecipient) body.feeRecipient = feeRecipient;
  if (image) body.image = image;
  if (website) body.website = website;
  if (tweet) body.tweet = tweet;
  if (disableVesting) body.disableVesting = true;
  if (quoteOnlyFees) body.quoteOnlyFees = true;

  const res = await fetch(`${BASE}/token-launches/deploy`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey()}`,
      "X-API-Key": apiKey(),
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });

  let json = null;
  try { json = await res.json(); } catch { /* non-JSON error body */ }
  if (!res.ok) {
    const msg = (json && (json.error || json.message)) || `Bankr deploy failed (HTTP ${res.status}).`;
    throw new Error(msg);
  }
  return { raw: json, token: tokenFromResponse(json) };
}

module.exports = { isConfigured, deployToken, tokenFromResponse, BASE };
