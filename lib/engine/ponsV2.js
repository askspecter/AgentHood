"use strict";

/**
 * pons v2 integration — the bonding-curve → Uniswap-v4 stack.
 *
 * Everything here maps 1:1 to the pons v2 docs' verified ABIs. A launch is one
 * call to the launch factory (`launchToken`) with a chosen launch config and an
 * economics pin read immediately before the call; pre-graduation trades go
 * straight to the launch's own bonding curve; creator fees accrue to a shared
 * escrow that recipients withdraw from on their own schedule.
 *
 * v1 (Uniswap v3) is untouched — this is additive, resolved from `chain.pons.v2`.
 */

const { Contract, Interface, ZeroAddress } = require("ethers");

const FACTORY_ABI = [
  "function launchConfigCount() view returns (uint256)",
  "function getLaunchConfig(uint256 id) view returns ((uint256 supply,uint256 curveFeeBps,uint256 phantomQuote,uint256 graduationThreshold,uint24 poolFee,int24 tickSpacing,bool enabled))",
  "function previewLaunchEconomics(uint256 launchConfigId, address pairToken) view returns (bytes32)",
  "function launchFee() view returns (uint256)",
  "function maxCreatorTaxBps() view returns (uint16)",
  "function launchEnabled() view returns (bool)",
  "function whitelistedLaunchers(address) view returns (bool)",
  "function approvedPairTokens(address pairToken) view returns (bool)",
  "function launchToken((string name,string symbol,string logo,string description,(string twitter,string telegram,string discord,string website,string farcaster) socials,address creatorFeeRecipient,uint16 creatorTaxBps,bool buybackEnabled,bytes32 expectedEconomics) params, uint256 launchConfigId, address pairToken) payable returns (address token, address curve)",
  "function getLaunchedToken(address token) view returns ((address token,address curve,address deployer,address creatorFeeRecipient,address pairToken,uint256 graduationThreshold,uint24 poolFee,int24 tickSpacing,uint16 creatorTaxBps,bool buybackEnabled,uint8 phase,uint256 sweptQuote,uint256 sweptTokens,uint256 sweptAt,bool exists))",
  "event TokenLaunched(address indexed token, address indexed curve, address indexed deployer, address pairToken, uint256 launchConfigId, uint256 graduationThreshold)",
];

const CURVE_ABI = [
  "function buy(uint256 quoteIn, uint256 minTokensOut, address recipient) payable returns (uint256 tokensOut)",
  "function sell(uint256 tokensIn, uint256 minQuoteOut, address recipient) returns (uint256 quoteOut)",
  "function isNativeQuote() view returns (bool)",
  "function pairToken() view returns (address)",
  "function getReserves() view returns (uint256 quoteReserve, uint256 tokenReserve)",
  "function realQuoteReserve() view returns (uint256)",
  "function tokenReserve() view returns (uint256)",
  "function sellableTokens() view returns (uint256)",
  "function graduationThreshold() view returns (uint256)",
  "function readyToGraduate() view returns (bool)",
  "function graduated() view returns (bool)",
  "function feeBps() view returns (uint256)",
  "function creatorTaxBps() view returns (uint256)",
];

const ESCROW_ABI = [
  "function balanceOf(address recipient) view returns (uint256)",
  "function balanceOfToken(address recipient, address token) view returns (uint256)",
  "function claim()",
  "function claimToken(address token)",
];

const TOKEN_INFO_ABI = [
  "function getTokenInfo() view returns (address tokenDeployer, string tokenLogo, string tokenDescription, (string twitter,string telegram,string discord,string website,string farcaster) tokenSocials)",
];

/** phase from getLaunchedToken. */
const PHASE = { NOT_GRADUATED: 0, SWEPT: 1, POOL_CREATED: 2, RESCUED: 3 };

const v2Config = (chain) => (chain && chain.pons && chain.pons.v2) || null;
const isConfigured = (chain) => Boolean(v2Config(chain) && v2Config(chain).factory);

function factory(provider, chain) {
  return new Contract(v2Config(chain).factory, FACTORY_ABI, provider);
}
function escrow(provider, chain) {
  return new Contract(v2Config(chain).escrow, ESCROW_ABI, provider);
}
function curveAt(provider, address) {
  return new Contract(address, CURVE_ABI, provider);
}

/** The launch configs currently open for new launches (enabled only). */
async function openLaunchConfigs(provider, chain) {
  const f = factory(provider, chain);
  const count = Number(await f.launchConfigCount());
  const out = [];
  for (let id = 0; id < count; id++) {
    try {
      const c = await f.getLaunchConfig(id);
      if (c.enabled) {
        out.push({
          id,
          supply: c.supply,
          curveFeeBps: Number(c.curveFeeBps),
          phantomQuote: c.phantomQuote,
          graduationThreshold: c.graduationThreshold,
          poolFee: Number(c.poolFee),
          tickSpacing: Number(c.tickSpacing),
        });
      }
    } catch {
      /* a disabled/removed config just isn't offered */
    }
  }
  return out;
}

/**
 * Pick the launch config to use: the caller's preference if it's open, else the
 * first open config. Returns null if none are open.
 */
async function chooseLaunchConfigId(provider, chain, preferredId = null) {
  const open = await openLaunchConfigs(provider, chain);
  if (!open.length) return null;
  if (preferredId != null && open.some((c) => c.id === Number(preferredId))) return Number(preferredId);
  return open[0].id;
}

async function previewLaunchEconomics(provider, chain, launchConfigId, pairToken = ZeroAddress) {
  return factory(provider, chain).previewLaunchEconomics(launchConfigId, pairToken);
}

async function launchFee(provider, chain) {
  return factory(provider, chain).launchFee();
}

/** Shape a TokenParams tuple for launchToken from plain creator inputs. */
function tokenParams({
  name,
  symbol,
  logo = "",
  description = "",
  socials = {},
  creatorFeeRecipient,
  creatorTaxBps = 0,
  buybackEnabled = false,
  expectedEconomics,
}) {
  return {
    name: String(name || ""),
    symbol: String(symbol || "").replace(/^\$/, ""),
    logo: String(logo || ""),
    description: String(description || ""),
    socials: {
      twitter: String(socials.twitter || ""),
      telegram: String(socials.telegram || ""),
      discord: String(socials.discord || ""),
      website: String(socials.website || ""),
      farcaster: String(socials.farcaster || ""),
    },
    creatorFeeRecipient: creatorFeeRecipient || ZeroAddress,
    creatorTaxBps: Number(creatorTaxBps) || 0,
    buybackEnabled: Boolean(buybackEnabled),
    expectedEconomics,
  };
}

/** Pull the launched token + curve address out of a launch receipt's logs. */
function parseLaunched(receipt) {
  const iface = new Interface(FACTORY_ABI);
  for (const log of receipt.logs || []) {
    try {
      const parsed = iface.parseLog(log);
      if (parsed && parsed.name === "TokenLaunched") {
        return { token: parsed.args.token, curve: parsed.args.curve };
      }
    } catch {
      /* not our event */
    }
  }
  return { token: null, curve: null };
}

async function getLaunchedToken(provider, chain, token) {
  return factory(provider, chain).getLaunchedToken(token);
}

/**
 * Is this token a pons v2 launch, and where does it trade right now?
 * Returns null when it isn't a v2 launch (so callers fall through to the v1
 * Uniswap-v3 path). `phase` decides routing: 0 curve, 1 swept (transient),
 * 2 Uniswap v4 pool, 3 rescued.
 */
async function resolveLaunch(provider, chain, token) {
  if (!isConfigured(chain)) return null;
  try {
    const l = await factory(provider, chain).getLaunchedToken(token);
    if (!l || !l.exists) return null;
    return {
      token: l.token,
      curve: l.curve,
      deployer: l.deployer,
      creatorFeeRecipient: l.creatorFeeRecipient,
      pairToken: l.pairToken,
      isNativeQuote: l.pairToken === ZeroAddress,
      poolFee: Number(l.poolFee),
      tickSpacing: Number(l.tickSpacing),
      creatorTaxBps: Number(l.creatorTaxBps),
      buybackEnabled: l.buybackEnabled,
      phase: Number(l.phase),
      graduationThreshold: l.graduationThreshold,
    };
  } catch {
    return null;
  }
}

/**
 * Live pricing for a pre-graduation launch, read from its curve. The curve's
 * spot price is quoteReserve/tokenReserve (both 1e18-scaled, so the ratio is ETH
 * per whole token); market cap is that price × total supply; graduation progress
 * is the real quote raised against the threshold.
 */
async function curvePricing(provider, chain, launch) {
  const c = curveAt(provider, launch.curve);
  let q = 0, t = 0, real = 0, threshold = 0, supply = 0;
  try { const r = await c.getReserves(); q = Number(r[0]); t = Number(r[1]); } catch { /* keep 0 */ }
  try { real = Number(await c.realQuoteReserve()); } catch { /* keep 0 */ }
  try { threshold = Number(await c.graduationThreshold()); } catch { /* keep 0 */ }
  try {
    const erc = new Contract(launch.token, ["function totalSupply() view returns (uint256)", "function decimals() view returns (uint8)"], provider);
    const [ts, d] = await Promise.all([erc.totalSupply(), erc.decimals().catch(() => 18)]);
    supply = Number(ts) / 10 ** Number(d);
  } catch { /* keep 0 */ }
  const priceInWeth = t > 0 ? q / t : null;
  const marketCapWeth = priceInWeth != null && supply > 0 ? priceInWeth * supply : null;
  const graduationProgress = threshold > 0 ? Math.max(0, Math.min(1, real / threshold)) : null;
  return { priceInWeth, marketCapWeth, graduationProgress };
}

/** A human message for a launch phase that can't trade on the curve. */
function phaseBlockedMessage(phase) {
  if (phase === PHASE.SWEPT) return { error: "This coin is graduating right now — try again in a moment.", retryable: true };
  if (phase === PHASE.POOL_CREATED) return { error: "This coin graduated to a Uniswap v4 pool. v4 trading is landing next — for now trade it on the pons app or explorer.", graduated: true };
  if (phase === PHASE.RESCUED) return { error: "This coin is on a recovery path, so trading is paused here." };
  return { error: "This coin can't be traded on the curve right now." };
}

module.exports = {
  FACTORY_ABI,
  CURVE_ABI,
  ESCROW_ABI,
  TOKEN_INFO_ABI,
  PHASE,
  v2Config,
  isConfigured,
  factory,
  escrow,
  curveAt,
  openLaunchConfigs,
  chooseLaunchConfigId,
  previewLaunchEconomics,
  launchFee,
  tokenParams,
  parseLaunched,
  getLaunchedToken,
  resolveLaunch,
  phaseBlockedMessage,
  curvePricing,
};
