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
};
