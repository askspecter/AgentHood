"use strict";

/**
 * Network + pons contract configuration.
 *
 * Values here come from the official pons documentation (Integration → Network /
 * Contracts / Onchain events). Two earlier guesses are corrected: the public RPC
 * lives on the `rpc.mainnet.` host, and the explorer is Blockscout.
 *
 * pons runs on Robinhood Chain: an Arbitrum Orbit L2, ETH for gas, fully
 * EVM-compatible, permissionless deployment.
 */

const PONS = {
  /** Serves current launches. 70/30 creator/protocol fee split. */
  factory: "0xA5aAb3F0c6EeadF30Ef1D3Eb997108E976351feB",
  factoryStartBlock: 8_991_118,
  locker: "0x736D76699C26D0d966744cAe304C000d471f7F35",

  /** Tokens deployed before the current version. 90/10 split, snapshotted. */
  legacyFactory: "0x0c37a24F5D23A486FA692d1500881d698B1F77a4",
  legacyFactoryStartBlock: 8_600_612,
  legacyLocker: "0x31ca5E101941A93A7DD6d0497928700625CF54B5",

  /** The Uniswap V3 stack every launch trades in. */
  v3Factory: "0x1f7d7550B1b028f7571E69A784071F0205FD2EfA",
  positionManager: "0x73991a25C818Bf1f1128dEAaB1492D45638DE0D3",
  swapRouter: "0xCaf681a66D020601342297493863E78C959E5cb2",
  quoter: "0x33e885eD0Ec9bF04EcfB19341582aADCb4c8A9E7",
  weth: "0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73",

  /**
   * USDG (Global Dollar) — the USD stablecoin that Robinhood Chain's tokenized
   * stocks are paired against. A launch pool is a WETH pair, but a stock pool is
   * almost always a USDG pair, so a stock quoted against WETH finds no pool and
   * looks like a honeypot when it is simply the wrong pair. Launches keep WETH;
   * stocks trade against this. Overridable to pin a verified address.
   */
  usdg: "0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168",

  /**
   * pons v2 — the new stack (bonding curve → Uniswap v4 pool, via a hook).
   * A launch is one call to the launch factory; creator fees accrue to a shared
   * escrow. Addresses are verified on the explorer; per-launch curves and tokens
   * are resolved from the factory, never hardcoded. All overridable by env.
   */
  v2: {
    factory: "0x7E1EAbd52Ae29598e6483F72dCf1a70b14284dB8",
    factoryStartBlock: 23_551_520,
    hook: "0x8e99D2009D60A917e9B1c00C04C077b8c0c3a044",
    locker: "0x28b6F0116c7F234951cf0e67319ed53863Df2197",
    escrow: "0xbc39B6502E1a6Ab36E4A5c5026A35F08342A0A9c",
    migrationFactory: "0x050e5C224466e2d377a7E555E139D51268239b39",
    migrationHook: "0x107251FFCC1fc808643DC8dA345e901f59EC2044",
    migrationLocker: "0x25679946bf7aD099079e50fFb8ae27DcC901F017",
    // Optional Uniswap v4 infra for trading GRADUATED pools — fill via env when
    // available (docs don't list them). Curve (pre-graduation) trading needs none.
    poolManager: null,
    universalRouter: null,
    v4Quoter: null,
    stateView: null,
  },

  /** Every pons pool uses the 1% tier, so there is no need to probe tiers. */
  poolFee: 10_000,
  /** Fixed for every launch: 1,000,000,000 * 1e18. */
  launchSupply: 1_000_000_000n * 10n ** 18n,
  launchFeeEth: "0.0005",
  /** Default graduation threshold in paired WETH; read on-chain to be exact. */
  graduationThresholdEth: "4.2",
};

/** Event topic0 values, for indexing launches and trades. */
const TOPICS = {
  tokenLaunched: "0xdb51ea9ad51ab453a65a4cb7e60c3cb378c9501bb002609f8f97778fb6c4235a",
  swap: "0xc42079f94a6350d7e6235f29174924f928cc2ac818eb64fed8004e115fbcca67",
};

/**
 * A graduated token with known on-chain state, published by pons specifically so
 * an integration can be validated against it. Handy as a smoke test.
 */
const REFERENCE = {
  token: "0x39dBED3a2bd333467115dE45665cC57F813C4571",
  pool: "0x10CC6BD38112cAc182db90B6a71d8Bb5939526bA",
  note: "PONS — graduated, launched via the legacy factory (90/10 split).",
};

const CHAINS = {
  robinhood: {
    key: "robinhood",
    name: "Robinhood Chain",
    chainId: 4663,
    // Documented public endpoint. Note the `mainnet` label in the host — an
    // earlier version of this file omitted it and could not connect at all.
    rpc: process.env.ROBINHOOD_RPC || "https://rpc.mainnet.chain.robinhood.com",
    explorer: process.env.ROBINHOOD_EXPLORER || "https://robinhoodchain.blockscout.com",
    gasSymbol: "ETH",
    wrappedNative: process.env.ROBINHOOD_WETH || PONS.weth,
    feeTiers: [PONS.poolFee],
    pons: {
      ...PONS,
      factory: process.env.PONS_FACTORY || PONS.factory,
      swapRouter: process.env.PONS_ROUTER || PONS.swapRouter,
      quoter: process.env.PONS_QUOTER || PONS.quoter,
      usdg: process.env.PONS_USDG || process.env.ROBINHOOD_USDG || PONS.usdg,
      v2: {
        ...PONS.v2,
        factory: process.env.PONS_V2_FACTORY || PONS.v2.factory,
        escrow: process.env.PONS_V2_ESCROW || PONS.v2.escrow,
        hook: process.env.PONS_V2_HOOK || PONS.v2.hook,
        locker: process.env.PONS_V2_LOCKER || PONS.v2.locker,
        poolManager: process.env.PONS_V2_POOL_MANAGER || PONS.v2.poolManager,
        universalRouter: process.env.PONS_V2_UNIVERSAL_ROUTER || PONS.v2.universalRouter,
        v4Quoter: process.env.PONS_V2_QUOTER || PONS.v2.v4Quoter,
        stateView: process.env.PONS_V2_STATE_VIEW || PONS.v2.stateView,
      },
    },
    topics: TOPICS,
    reference: REFERENCE,
  },

  /**
   * Testnet details are NOT in the pons docs — pons is mainnet-only. Kept for
   * contract work on Robinhood Chain testnet; there is no pons deployment here,
   * so launchpad reads and the honeypot simulation will report themselves as
   * skipped rather than silently passing.
   */
  robinhoodTestnet: {
    key: "robinhoodTestnet",
    name: "Robinhood Chain Testnet",
    chainId: 46630,
    rpc: process.env.ROBINHOOD_TESTNET_RPC || "https://rpc.testnet.chain.robinhood.com",
    explorer: process.env.ROBINHOOD_TESTNET_EXPLORER || null,
    gasSymbol: "ETH",
    wrappedNative: null,
    feeTiers: [10_000, 3_000, 500],
    pons: {},
    topics: TOPICS,
  },

  /** `npx hardhat node` on your own machine. Used by the test suite. */
  local: {
    key: "local",
    name: "Local EVM",
    chainId: 31337,
    rpc: process.env.LOCAL_RPC || "http://127.0.0.1:8545",
    explorer: null,
    gasSymbol: "ETH",
    wrappedNative: null,
    feeTiers: [10_000, 3_000, 500],
    pons: {},
    topics: TOPICS,
  },
};

function getChain(key) {
  const chain = CHAINS[key];
  if (!chain) {
    throw new Error(
      `Unknown network "${key}". Available: ${Object.keys(CHAINS).join(", ")}`
    );
  }
  return chain;
}

module.exports = { CHAINS, getChain, PONS, TOPICS, REFERENCE };
