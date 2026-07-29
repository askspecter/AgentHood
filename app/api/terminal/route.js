import { NextResponse } from "next/server";
import { Contract, JsonRpcProvider, formatEther, formatUnits, getAddress, isAddress } from "ethers";
import {
  buildSendPlan,
  buildTradePlan,
  deriveAddress,
  discoverWalletTokens,
  enrichLaunchesByAddress,
  getChain,
  getEthUsd,
  listLaunched,
  listLaunches,
  loadDirectory,
  looksLikeTicker,
  parseCommand,
  resolveToken,
  spotPrice,
  tokenMeta,
  usdToEth,
  HELP,
} from "@/lib/engine";
import { getSession } from "@/lib/session";

/**
 * POST /api/terminal  { input, network, account?, slippage? }
 *
 * One line of terminal input in, a rendered answer out. Read-only: the worst
 * this endpoint can do is quote a trade. Signing happens in the browser wallet,
 * or — for someone who signed in with X and has no wallet extension, which on a
 * phone is nearly everybody — at `/api/terminal/execute`, which is a separate
 * route precisely so that spending money is a separate decision.
 */

const BALANCE_ABI = ["function balanceOf(address) view returns (uint256)"];
const SUPPLY_ABI = [
  "function totalSupply() view returns (uint256)",
  "function decimals() view returns (uint8)",
];

/** How many launches the resolver may see. Enough to cover the live feed. */
const RESOLVE_LIMIT = 24;

/**
 * Short-lived portfolio cache, keyed by network:address.
 *
 * Building a portfolio is the heaviest read this app does — a wide log scan plus
 * a balanceOf on every token the wallet ever touched — so re-running it on every
 * Profile visit or Refresh tap is what makes holdings feel slow. Caching the
 * result for a short window makes the second read instant; the TTL is short
 * enough that a fresh trade shows up on the next refresh.
 */
const PORTFOLIO_CACHE = new Map();
const PORTFOLIO_TTL_MS = Number(process.env.PORTFOLIO_TTL_MS || 45_000);

/**
 * Run an async mapper over items a few at a time.
 *
 * Firing 160 balanceOf calls at once as one Promise.all makes a public RPC
 * rate-limit and stall them all; a small concurrency window is actually faster
 * because every call stays under the limit and returns instead of retrying.
 */
async function mapBounded(items, concurrency, fn) {
  for (let i = 0; i < items.length; i += concurrency) {
    await Promise.all(items.slice(i, i + concurrency).map(fn));
  }
}

/**
 * The wallet's ERC-20 balances straight from the block explorer's index —
 * address, balance and metadata in one call.
 *
 * The RPC path (a wide `getLogs` transfer scan, then `balanceOf` on every token
 * it finds) is both slow and lossy: it can hang the whole request on a public
 * RPC, and a chunk that rate-limits drops a coin the wallet plainly holds.
 * Blockscout already indexes every balance, so this returns the whole set in one
 * request — fast, and it never misses a coin the wallet just bought. The
 * portfolio uses it as the primary source and keeps the RPC scan as a fallback.
 */
async function explorerBalances(explorer, address, timeoutMs = 8000) {
  if (!explorer || !address) return [];
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const url = `${explorer.replace(/\/+$/, "")}/api/v2/addresses/${address}/token-balances`;
    const res = await fetch(url, { headers: { accept: "application/json" }, cache: "no-store", signal: controller.signal });
    if (!res.ok) return [];
    const json = await res.json();
    const items = Array.isArray(json) ? json : json.items || [];
    const out = [];
    for (const it of items) {
      const tk = it?.token || {};
      const addr = tk.address || tk.address_hash || it?.address;
      const type = tk.type;
      if (!addr || (type && !/ERC-?20/i.test(type))) continue;
      let raw = 0n;
      try { raw = BigInt(it.value ?? "0"); } catch { raw = 0n; }
      if (raw === 0n) continue;
      const er = Number(tk.exchange_rate);
      out.push({
        token: addr,
        decimals: Number(tk.decimals ?? 18) || 18,
        symbol: tk.symbol || null,
        name: tk.name || null,
        raw,
        exchangeRateUsd: Number.isFinite(er) && er > 0 ? er : null,
      });
    }
    return out;
  } catch {
    return [];
  } finally {
    clearTimeout(timer);
  }
}

function line(text, tone = "out") {
  return { tone, text };
}

function serialise(value) {
  return JSON.parse(
    JSON.stringify(value, (_k, v) => (typeof v === "bigint" ? v.toString() : v))
  );
}

/** Where the caller's money lives: their connected wallet, else their X wallet. */
async function resolveOwner(account, session) {
  if (account && isAddress(account)) return { address: getAddress(account), source: "wallet" };
  if (session?.id) {
    try {
      return { address: deriveAddress(session.id), source: "x" };
    } catch {
      // WALLET_DERIVATION_SECRET missing — not fatal for a read-only command.
    }
  }
  return { address: null, source: null };
}

/**
 * Resolve a ticker against the launch feed first, then the stock/known-token
 * directory. The feed wins on a clash because those are this site's own tokens;
 * the directory is the reach into Robinhood Chain's tokenized stocks and any
 * other named token the operator has listed. An address never needs either.
 */
async function resolveTicker(query, launches, chain) {
  const found = resolveToken(query, launches);
  if (found.ok || found.reason === "ambiguous") return found;

  // A miss on the feed. Only a plain ticker is worth a directory lookup — a
  // full sentence never is, and an address already resolved above.
  if (isAddress(query) || !looksLikeTicker(query)) return found;

  let dir;
  try {
    dir = await loadDirectory(chain.chainId);
  } catch {
    return found;
  }
  if (!dir.tokens.length) {
    return { ...found, directoryEmpty: true, directoryWarning: dir.warning };
  }
  const hit = resolveToken(query, dir.tokens);
  if (hit.ok) return { ...hit, directory: true };
  if (hit.reason === "ambiguous") return hit;
  return { ...found, directoryWarning: dir.warning };
}

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Expected a JSON body." }, { status: 400 });
  }

  const { input, network = "robinhood", account = null, slippage = 5 } = body || {};

  let chain;
  try {
    chain = getChain(network);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  const command = parseCommand(input);

  // Answered without touching the chain at all.
  if (command.kind === "empty") return NextResponse.json({ kind: "empty", lines: [] });
  if (command.kind === "clear") return NextResponse.json({ kind: "clear", lines: [] });
  if (command.kind === "help") {
    // Sent as pairs rather than space-padded text: padding only lines up while
    // nothing wraps, and on a phone every one of these lines wraps.
    return NextResponse.json({
      kind: "help",
      data: { commands: HELP.map(([cmd, what]) => ({ cmd, what })) },
      lines: [
        line("Tickers resolve against the launch feed and Robinhood stock tokens. A 0x address always works.", "muted"),
        line("↑ / ↓ walks your history. Tab completes a command.", "muted"),
      ],
    });
  }
  if (command.kind === "login") {
    return NextResponse.json({
      kind: "login",
      lines: [line("Opening X sign-in…")],
      navigate: { signIn: true },
    });
  }
  if (command.kind === "connect") {
    return NextResponse.json({
      kind: "connect",
      lines: [line("Asking your browser wallet to connect…")],
      navigate: { connect: true },
    });
  }
  if (command.kind === "create") {
    return NextResponse.json({
      kind: "create",
      lines: [
        line(
          command.symbol
            ? `Opening the create form for $${command.symbol}${
                command.name ? ` — “${command.name}”` : ""
              }.`
            : "Opening the create form."
        ),
      ],
      navigate: { view: "create", prefill: { symbol: command.symbol, name: command.name } },
    });
  }
  if (command.kind === "error") {
    return NextResponse.json({ kind: "error", lines: [line(command.message, "error")] });
  }
  if (command.kind === "unknown") {
    return NextResponse.json({
      kind: "error",
      lines: [
        line(`Unknown command: ${command.raw}`, "error"),
        line("Type `help` for everything this understands.", "muted"),
      ],
    });
  }

  // Everything below reads the chain.
  const provider = new JsonRpcProvider(chain.rpc, chain.chainId);

  let session = null;
  try {
    session = await getSession();
  } catch {
    /* a broken session must not stop a public price lookup */
  }
  const owner = await resolveOwner(account, session);

  // A dead feed and an empty feed produce the same empty array, and telling
  // someone "no launch called pons" when the truth is "the RPC is unreachable"
  // sends them looking for the wrong problem.
  let feedError = null;
  const [rate, feed] = await Promise.all([
    getEthUsd(),
    listLaunches(provider, chain, { limit: RESOLVE_LIMIT }).catch((error) => {
      feedError = error.message || "the launch feed could not be read";
      return { launches: [] };
    }),
  ]);
  const ethUsd = rate?.usd ?? null;
  const launches = feed.launches || [];

  try {
    switch (command.kind) {
      case "fund": {
        if (!owner.address) {
          return NextResponse.json({
            kind: "error",
            lines: [
              line("No wallet to fund yet.", "error"),
              line(
                session === null && !account
                  ? "`login` with X to mint one, or `connect` a browser wallet."
                  : "The server is missing WALLET_DERIVATION_SECRET, so the X wallet cannot be derived. Set it in the deployment env.",
                "muted"
              ),
            ],
          });
        }
        let eth = null;
        try {
          eth = Number(formatEther(await provider.getBalance(owner.address)));
        } catch {
          /* address still shows even if the balance read fails */
        }
        return NextResponse.json(
          serialise({
            kind: "fund",
            ethUsd,
            data: {
              address: owner.address,
              source: owner.source,
              chain: chain.name,
              chainId: chain.chainId,
              gasSymbol: chain.gasSymbol,
              explorer: chain.explorer,
              eth,
              usd: eth != null && ethUsd ? eth * ethUsd : null,
            },
          })
        );
      }

      case "gas": {
        const [fee, blockNumber] = await Promise.all([
          provider.getFeeData(),
          provider.getBlockNumber().catch(() => null),
        ]);
        const gwei = fee.gasPrice != null ? Number(fee.gasPrice) / 1e9 : null;
        // A plain transfer is 21,000 gas — a figure people can anchor a fee to.
        const transferEth = fee.gasPrice != null ? Number(formatEther(fee.gasPrice * 21000n)) : null;
        return NextResponse.json(
          serialise({
            kind: "gas",
            ethUsd,
            data: {
              gwei,
              blockNumber,
              chain: chain.name,
              transferEth,
              transferUsd: transferEth != null && ethUsd ? transferEth * ethUsd : null,
            },
          })
        );
      }

      case "convert": {
        const { unit, value } = command.amount;
        // "convert $100" defaults to ETH; "convert 0.5 eth" defaults to USD.
        const target = command.target || (unit === "usd" ? "eth" : "usd");
        let result = null;
        if (unit === "usd") {
          const eth = usdToEth(value, ethUsd);
          result =
            target === "eth"
              ? { in: `$${value.toLocaleString("en-US")}`, out: eth != null ? `${eth} ETH` : null }
              : { in: `$${value.toLocaleString("en-US")}`, out: `$${value.toLocaleString("en-US")}` };
        } else {
          // Treat a bare number and "eth" alike as an ETH amount to convert.
          const usd = ethUsd ? value * ethUsd : null;
          result = { in: `${value} ETH`, out: usd != null ? `$${usd.toLocaleString("en-US", { maximumFractionDigits: 2 })}` : null };
        }
        if (!result.out) {
          return NextResponse.json({
            kind: "error",
            lines: [line("No ETH/USD rate is available right now, so that cannot be converted.", "error")],
          });
        }
        return NextResponse.json(
          serialise({
            kind: "convert",
            ethUsd,
            data: { ...result, rate: ethUsd },
          })
        );
      }

      case "send": {
        let token = null;
        if (command.asset === "token") {
          const found = await resolveTicker(command.query, launches, chain);
          if (!found.ok && found.reason === "ambiguous") {
            return NextResponse.json(
              serialise({
                kind: "error",
                lines: [
                  line(`“${command.query}” matches ${found.candidates.length} tokens.`, "error"),
                  ...found.candidates
                    .slice(0, 6)
                    .map((c) => line(`  $${c.symbol || "???"}  ${c.token}`)),
                  line("Use the address to be certain which one you mean.", "muted"),
                ],
              })
            );
          }
          if (!found.ok) {
            return NextResponse.json({
              kind: "error",
              lines: [line(`No token called “${command.query}” to send. Paste its address.`, "error")],
            });
          }
          token = found.token;
        }

        if (!owner.address) {
          return NextResponse.json({
            kind: "error",
            lines: [
              line("No wallet to send from.", "error"),
              line("`connect` a browser wallet, or `login` with X.", "muted"),
            ],
          });
        }

        const built = await buildSendPlan(provider, chain, {
          asset: command.asset,
          token,
          amount: command.amount,
          owner: owner.address,
          to: command.to,
        });
        if (!built.ok) {
          return NextResponse.json({ kind: "error", lines: [line(built.error, "error")] });
        }
        return NextResponse.json(
          serialise({
            kind: "sendplan",
            ethUsd,
            plan: {
              ...built.plan,
              owner: owner.address,
              ownerSource: owner.source,
              network,
              explorer: chain.explorer,
            },
          })
        );
      }

      case "list": {
        const ranked = [...launches].sort(
          (a, b) => (b.marketCapWeth || 0) - (a.marketCapWeth || 0)
        );
        return NextResponse.json(
          serialise({
            kind: "list",
            ethUsd,
            data: { launches: ranked.slice(0, 12), explorer: chain.explorer },
            lines: ranked.length
              ? [
                  line(
                    `${ranked.length} launch${ranked.length === 1 ? "" : "es"} in the current window, biggest first.`,
                    "muted"
                  ),
                ]
              : [line("No launches in the scanned block window.", "muted")],
          })
        );
      }

      case "balance": {
        if (!owner.address) {
          return NextResponse.json({
            kind: "error",
            lines: [
              line("No wallet yet.", "error"),
              line("`connect` to use a browser wallet, or `login` to get one from your X account.", "muted"),
            ],
          });
        }
        const native = await provider.getBalance(owner.address);
        const eth = Number(formatUnits(native, 18));
        return NextResponse.json(
          serialise({
            kind: "balance",
            ethUsd,
            data: {
              address: owner.address,
              source: owner.source,
              eth,
              usd: ethUsd ? eth * ethUsd : null,
              explorer: chain.explorer,
            },
          })
        );
      }

      case "portfolio": {
        if (!owner.address) {
          return NextResponse.json({
            kind: "error",
            lines: [
              line("No wallet yet.", "error"),
              line("`connect` to use a browser wallet, or `login` to get one from your X account.", "muted"),
            ],
          });
        }

        // Serve a recent build instantly — the heavy scan below only reruns once
        // the cache has expired.
        const folioKey = `${network}:${owner.address.toLowerCase()}`;
        const cachedFolio = PORTFOLIO_CACHE.get(folioKey);
        if (cachedFolio && Date.now() - cachedFolio.at < PORTFOLIO_TTL_MS) {
          return NextResponse.json(cachedFolio.value);
        }

        // Two independent ways to know what a wallet holds, unioned so neither
        // gap shows through:
        //
        //  1. The launch feed + everything launched through this site, which
        //     comes with live pool prices already attached.
        //  2. A direct chain scan of every ERC-20 that has ever transferred to
        //     or from this wallet — the real answer, covering stocks, airdrops
        //     and positions far older than the feed's block window.
        let scanTargets = launches;
        try {
          const registry = await listLaunched({ limit: 50 });
          const known = new Set(launches.map((l) => l.token.toLowerCase()));
          const extra = registry.tokens.filter((t) => !known.has(t.toLowerCase()));
          if (extra.length) {
            const enriched = await enrichLaunchesByAddress(provider, chain, extra);
            scanTargets = [...launches, ...enriched];
          }
        } catch {
          /* registry is optional — a feed-only scan is still useful */
        }

        // Launches carry price + metadata; keep them keyed so a discovered token
        // that happens to be a launch reuses that instead of re-reading it.
        const launchMap = new Map();
        for (const l of scanTargets) {
          try {
            launchMap.set(getAddress(l.token), l);
          } catch {
            /* skip a malformed launch address */
          }
        }

        // Holdings, resolved the fast way first: the block explorer already
        // indexes every balance, so one call returns the whole set — no wide
        // getLogs scan, no balanceOf on hundreds of tokens. That is what keeps
        // this from hanging on "Reading…" and what makes a coin the wallet just
        // bought show up. The RPC transfer scan stays only as a fallback.
        const balances = await explorerBalances(chain.explorer, owner.address);

        const holdings = [];
        let scanned = 0;
        let discovered = 0;
        let truncated = false;

        if (balances.length) {
          discovered = balances.length;
          scanned = balances.length;
          await mapBounded(balances.slice(0, 120), 8, async (b) => {
            let token;
            try { token = getAddress(b.token); } catch { return; }
            const known = launchMap.get(token);
            let decimals = b.decimals ?? known?.decimals ?? 18;
            let symbol = b.symbol ?? known?.symbol ?? null;
            let name = b.name ?? known?.name ?? null;
            let priceInWeth = Number.isFinite(known?.priceInWeth) ? known.priceInWeth : null;
            let priceUsd = b.exchangeRateUsd ?? null;

            // No live price yet and not one of our launches: one bounded spot read
            // (WETH pair, then the stock/USDG pair). Only the handful of coins the
            // wallet actually holds hit this, so it stays fast.
            if (priceInWeth == null && priceUsd == null && !known) {
              for (const kind of [null, "stock"]) {
                try {
                  const sp = await spotPrice(provider, chain, token, { ethUsd, kind });
                  if (sp.ok) {
                    priceInWeth = sp.priceInWeth ?? priceInWeth;
                    priceUsd = sp.priceUsd ?? priceUsd;
                    symbol = symbol || sp.symbol;
                    name = name || sp.name;
                    if (priceUsd != null || priceInWeth != null) break;
                  }
                } catch { /* leave it unpriced — the balance still shows */ }
              }
            }

            const qty = Number(formatUnits(b.raw, decimals ?? 18));
            const valueWeth = priceInWeth != null ? qty * priceInWeth : null;
            const valueUsd =
              priceUsd != null
                ? qty * priceUsd
                : valueWeth != null && ethUsd
                  ? valueWeth * ethUsd
                  : null;
            holdings.push({ token, symbol, name, qty, priceInWeth, valueWeth, valueUsd, launch: Boolean(known) });
          });
        } else {
          // ---- Fallback: RPC transfer scan + balanceOf (explorer unavailable) ----
          let discovery = { tokens: [], truncated: false };
          try {
            discovery = await discoverWalletTokens(provider, owner.address, {
              startBlock: chain.pons?.factoryStartBlock || 0,
            });
          } catch {
            /* no discovery — fall back to the launch-based list */
          }
          const candidates = new Set(launchMap.keys());
          for (const t of discovery.tokens) {
            try { candidates.add(getAddress(t)); } catch { /* skip malformed */ }
          }
          const MAX_TOKENS = 160;
          const ordered = [
            ...launchMap.keys(),
            ...[...candidates].filter((t) => !launchMap.has(t)),
          ].slice(0, MAX_TOKENS);

          await mapBounded(ordered, 10, async (token) => {
            try {
              const erc20 = new Contract(token, BALANCE_ABI, provider);
              const raw = await erc20.balanceOf(owner.address);
              if (raw === 0n) return;
              const known = launchMap.get(token);
              let decimals = known?.decimals ?? 18;
              let symbol = known?.symbol ?? null;
              let name = known?.name ?? null;
              let priceInWeth = Number.isFinite(known?.priceInWeth) ? known.priceInWeth : null;
              let priceUsd = null;
              if (!known) {
                try {
                  const meta = await tokenMeta(provider, token);
                  decimals = meta.decimals ?? 18;
                  symbol = meta.symbol;
                  name = meta.name;
                } catch { /* an unreadable name is fine */ }
                for (const kind of [null, "stock"]) {
                  try {
                    const sp = await spotPrice(provider, chain, token, { ethUsd, kind });
                    if (sp.ok) {
                      priceInWeth = sp.priceInWeth ?? priceInWeth;
                      priceUsd = sp.priceUsd ?? priceUsd;
                      symbol = symbol || sp.symbol;
                      name = name || sp.name;
                      if (priceUsd != null || priceInWeth != null) break;
                    }
                  } catch { /* try the next pair */ }
                }
              }
              const qty = Number(formatUnits(raw, decimals ?? 18));
              const valueWeth = priceInWeth != null ? qty * priceInWeth : null;
              const valueUsd =
                priceUsd != null
                  ? qty * priceUsd
                  : valueWeth != null && ethUsd
                    ? valueWeth * ethUsd
                    : null;
              holdings.push({ token, symbol, name, qty, priceInWeth, valueWeth, valueUsd, launch: Boolean(known) });
            } catch {
              /* one unreadable token must not blank the portfolio */
            }
          });
          scanned = ordered.length;
          discovered = discovery.tokens.length;
          truncated = discovery.truncated;
        }

        // Priced first (by USD, then WETH), then the rest by quantity so a
        // holding with no pool still has a stable place in the list.
        holdings.sort(
          (a, b) =>
            (b.valueUsd || 0) - (a.valueUsd || 0) ||
            (b.valueWeth || 0) - (a.valueWeth || 0) ||
            b.qty - a.qty
        );
        const native = await provider.getBalance(owner.address);
        const eth = Number(formatUnits(native, 18));

        const folioValue = serialise({
          kind: "portfolio",
          ethUsd,
          data: {
            address: owner.address,
            source: owner.source,
            eth,
            holdings,
            totalWeth:
              eth + holdings.reduce((sum, h) => sum + (h.valueWeth || 0), 0),
            scanned,
            discovered,
            truncated,
          },
        });
        PORTFOLIO_CACHE.set(folioKey, { at: Date.now(), value: folioValue });
        return NextResponse.json(folioValue);
      }

      case "price":
      case "audit":
      case "buy":
      case "sell": {
        const found = await resolveTicker(command.query, launches, chain);

        if (!found.ok && found.reason === "ambiguous") {
          return NextResponse.json(
            serialise({
              kind: "error",
              lines: [
                line(`“${command.query}” matches ${found.candidates.length} launches.`, "error"),
                ...found.candidates
                  .slice(0, 6)
                  .map((c) => line(`  $${c.symbol || "???"}  ${c.token}  ${c.name || ""}`)),
                line("Use the address to be certain which one you mean.", "muted"),
              ],
            })
          );
        }

        if (!found.ok) {
          // A ticker that looks like a stock but resolved nowhere, on a deploy
          // with no directory configured, is not "no such token" — it is "this
          // deploy cannot reach stock tokens yet". Say which.
          if (found.directoryEmpty && looksLikeTicker(command.query)) {
            return NextResponse.json({
              kind: "error",
              lines: [
                line(`“${command.query}” is not a launch here, and the stock-token directory is empty right now.`, "error"),
                line(
                  found.directoryWarning ||
                    "The Robinhood stock-token API could not be reached from the server. A contract address still works.",
                  "muted"
                ),
              ],
            });
          }
          return NextResponse.json({
            kind: "error",
            lines: feedError
              ? [
                  line(`Could not read the launch feed, so “${command.query}” cannot be resolved to an address.`, "error"),
                  line(feedError, "muted"),
                  line("A contract address still works — it needs no feed lookup.", "muted"),
                ]
              : [
                  line(`No launch or listed token called “${command.query}”.`, "error"),
                  line(
                    "Tickers resolve against the launch feed and the token directory. Paste the contract address to reach any token.",
                    "muted"
                  ),
                ],
          });
        }

        if (command.kind === "audit") {
          return NextResponse.json({
            kind: "audit",
            lines: [line(`Running the full audit on ${found.token}…`)],
            navigate: { view: "audit", token: found.token, runAudit: true },
          });
        }

        if (command.kind === "price") {
          const l = found.launch;

          // A feed launch carries full pool state — use it directly.
          if (l && Number.isFinite(l.priceInWeth) && !l.fromDirectory) {
            return NextResponse.json(
              serialise({
                kind: "price",
                ethUsd,
                data: { ...l, explorer: chain.explorer, matchedBy: found.matchedBy },
              })
            );
          }

          // A stock token: the issuer's own bid/ask is the authoritative price,
          // and it needs no pool to exist. Supply is read on-chain for a cap.
          if (l?.kind === "stock" && l.priceUsd != null) {
            let supplyTokens = null;
            try {
              const erc20 = new Contract(l.token, SUPPLY_ABI, provider);
              const [supply, dec] = await Promise.all([
                erc20.totalSupply(),
                erc20.decimals().catch(() => l.decimals ?? 18),
              ]);
              supplyTokens = Number(formatUnits(supply, Number(dec)));
            } catch {
              /* a stock with an unreadable supply still has a price */
            }
            return NextResponse.json(
              serialise({
                kind: "price",
                ethUsd,
                data: {
                  token: found.token,
                  symbol: l.symbol,
                  name: l.name,
                  kind: "stock",
                  priceUsd: l.priceUsd,
                  marketCapUsd: supplyTokens != null ? l.priceUsd * supplyTokens : null,
                  supplyTokens,
                  currency: l.currency || "USD",
                  tradingHalted: l.tradingHalted || false,
                  explorer: chain.explorer,
                },
                lines: [
                  line(
                    `Price is ${l.symbol}'s issuer bid/ask from Robinhood. Buy/sell here needs a pool on the pons router — try \`buy $5 ${l.symbol}\` to check.`,
                    "muted"
                  ),
                ],
              })
            );
          }

          // A pasted address or other off-feed token: quote it live off the pool.
          // A stock is paired against USDG, not WETH, so pass its kind through.
          const spot = await spotPrice(provider, chain, found.token, {
            ethUsd,
            kind: l?.kind || (found.directory ? "token" : null),
          });
          if (spot.ok) {
            return NextResponse.json(
              serialise({
                kind: "price",
                ethUsd,
                data: {
                  token: found.token,
                  symbol: (l && l.symbol) || spot.symbol,
                  name: (l && l.name) || spot.name,
                  kind: l?.kind || (found.directory ? "token" : null),
                  priceInWeth: spot.priceInWeth,
                  marketCapWeth: spot.marketCapWeth,
                  // A USDG-paired stock has a dollar price and cap directly, with
                  // no WETH figure to show.
                  priceUsd: spot.priceUsd,
                  marketCapUsd: spot.marketCapUsd,
                  quoteSymbol: spot.quoteSymbol,
                  supplyTokens: spot.supplyTokens,
                  live: true,
                  explorer: chain.explorer,
                },
              })
            );
          }

          // No WETH pool to quote against — the tokenized-stock-vs-stablecoin
          // case, or simply an untradeable token. Show what we know, honestly.
          const meta = l || (await tokenMeta(provider, found.token));
          return NextResponse.json(
            serialise({
              kind: "price",
              ethUsd,
              data: {
                token: found.token,
                symbol: meta.symbol,
                name: meta.name,
                kind: l?.kind || null,
                offFeed: true,
                explorer: chain.explorer,
              },
              lines: [
                line(
                  `No WETH pool quotes ${meta.symbol || "this token"} right now, so it cannot be priced or traded through the pons router here. \`audit\` still works.`,
                  "muted"
                ),
              ],
            })
          );
        }

        // buy / sell. A stock trades against USDG, not WETH, so its kind decides
        // the pair the plan is built and quoted against.
        const tokenKind = found.launch?.kind || (found.directory ? "token" : "launch");
        const built = await buildTradePlan(provider, chain, {
          side: command.kind,
          token: found.token,
          amount: command.amount,
          owner: owner.address,
          slippagePercent: Number(slippage) || 5,
          ethUsd,
          kind: tokenKind,
        });

        if (!built.ok) {
          return NextResponse.json({
            kind: "error",
            lines: [
              line(built.error, "error"),
              ...(built.hint ? [line(built.hint, "muted")] : []),
            ],
          });
        }

        return NextResponse.json(
          serialise({
            kind: "plan",
            ethUsd,
            plan: {
              ...built.plan,
              tokenKind,
              owner: owner.address,
              ownerSource: owner.source,
              network,
              explorer: chain.explorer,
            },
          })
        );
      }

      default:
        return NextResponse.json({
          kind: "error",
          lines: [line(`Nothing handles \`${command.kind}\` yet.`, "error")],
        });
    }
  } catch (error) {
    console.error("Terminal command failed:", error);
    return NextResponse.json(
      {
        kind: "error",
        lines: [
          line(error.message || "The command failed.", "error"),
          line("The Robinhood Chain RPC may be unreachable from the server.", "muted"),
        ],
      },
      { status: 502 }
    );
  }
}
