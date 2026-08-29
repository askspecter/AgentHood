import { ImageResponse } from "next/og";

/**
 * GET /api/card/coin?symbol=LONG&name=Long&mcap=2100000&change=12.4&official=1
 *
 * A branded 1200x630 share card for a coin - the image that unfurls when a coin
 * link is posted on X. The client passes the coin's real numbers as query params
 * (it already has them), so the card is a fast pure render with no on-chain read.
 * All fields are optional; the card degrades gracefully.
 */

export const runtime = "nodejs";

const money = (n) => {
  const v = Number(n);
  if (!Number.isFinite(v) || v <= 0) return null;
  if (v >= 1e9) return "$" + (v / 1e9).toFixed(2) + "B";
  if (v >= 1e6) return "$" + (v / 1e6).toFixed(2) + "M";
  if (v >= 1e3) return "$" + (v / 1e3).toFixed(1) + "K";
  return "$" + v.toLocaleString("en-US", { maximumFractionDigits: 2 });
};

/**
 * When only a token address is known (a link unfurling on X), fill the card from
 * the block explorer's token index - one fast, time-boxed call, best-effort.
 */
async function resolveFromToken(token) {
  const explorer = (process.env.ROBINHOOD_EXPLORER || "https://robinhoodchain.blockscout.com").replace(/\/+$/, "");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 2500);
  try {
    const r = await fetch(`${explorer}/api/v2/tokens/${token}`, { cache: "no-store", signal: controller.signal });
    if (!r.ok) return {};
    const j = await r.json();
    return {
      symbol: (j.symbol || "").replace(/^\$/, ""),
      name: j.name || "",
      mcap: Number(j.circulating_market_cap ?? j.market_cap) || null,
      holders: Number(j.holders ?? j.holders_count) || null,
    };
  } catch {
    return {};
  } finally {
    clearTimeout(timer);
  }
}

export async function GET(request) {
  const p = new URL(request.url).searchParams;
  const token = (p.get("token") || "").trim();
  // Rich params (from the in-app Share button) win; otherwise resolve from token.
  let base = {
    symbol: p.get("symbol"),
    name: p.get("name"),
    mcap: p.get("mcap"),
    holders: p.get("holders"),
  };
  if (!base.symbol && /^0x[a-fA-F0-9]{40}$/.test(token)) {
    const r = await resolveFromToken(token);
    base = { symbol: r.symbol, name: r.name, mcap: r.mcap, holders: r.holders };
  }

  const symbol = (base.symbol || "TOKEN").replace(/^\$/, "").slice(0, 16);
  const name = (base.name || "").slice(0, 40);
  const mcap = money(base.mcap);
  const changeRaw = p.get("change");
  const change = changeRaw != null && changeRaw !== "" && Number.isFinite(Number(changeRaw)) ? Number(changeRaw) : null;
  const holders = Number(base.holders);
  const official = p.get("official") === "1" || p.get("official") === "true";

  const ink = "#EEF2FB";
  const soft = "#929bb6";
  const holo = "#bcd0f4";

  return new ImageResponse(
    (
      <div style={{ width: "1200px", height: "630px", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: "72px", background: "#06070d", color: ink, fontFamily: "sans-serif" }}>
        {/* top row */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "26px", letterSpacing: "4px", color: soft }}>
          <div style={{ display: "flex", color: holo, fontWeight: 700 }}>AURN</div>
          <div style={{ display: "flex" }}>ROBINHOOD CHAIN</div>
        </div>

        {/* center */}
        <div style={{ display: "flex", flexDirection: "column" }}>
          {official && (
            <div style={{ display: "flex", alignSelf: "flex-start", fontSize: "22px", letterSpacing: "3px", color: "#0a0c15", background: holo, padding: "8px 18px", borderRadius: "999px", marginBottom: "22px", fontWeight: 700 }}>
              OFFICIAL
            </div>
          )}
          <div style={{ display: "flex", fontSize: "148px", fontWeight: 800, lineHeight: 1 }}>${symbol}</div>
          {name ? <div style={{ display: "flex", fontSize: "40px", color: soft, marginTop: "14px" }}>{name}</div> : null}
        </div>

        {/* stat row */}
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "36px" }}>
            {mcap ? (
              <div style={{ display: "flex", flexDirection: "column" }}>
                <div style={{ display: "flex", fontSize: "22px", letterSpacing: "3px", color: soft }}>MARKET CAP</div>
                <div style={{ display: "flex", fontSize: "56px", fontWeight: 700, color: holo }}>{mcap}</div>
              </div>
            ) : (
              <div style={{ display: "flex", fontSize: "40px", color: soft }}>live on aurn.fun</div>
            )}
            {change != null ? (
              <div style={{ display: "flex", fontSize: "44px", fontWeight: 700, color: change >= 0 ? "#5fe3c0" : "#ff8aa0", paddingBottom: "4px" }}>
                {change >= 0 ? "+" : ""}{change.toFixed(1)}%
              </div>
            ) : null}
            {Number.isFinite(holders) && holders > 0 ? (
              <div style={{ display: "flex", flexDirection: "column" }}>
                <div style={{ display: "flex", fontSize: "22px", letterSpacing: "3px", color: soft }}>HOLDERS</div>
                <div style={{ display: "flex", fontSize: "44px", fontWeight: 700 }}>{holders.toLocaleString("en-US")}</div>
              </div>
            ) : null}
          </div>
          <div style={{ display: "flex", fontSize: "30px", letterSpacing: "3px", color: soft }}>aurn.fun</div>
        </div>
      </div>
    ),
    { width: 1200, height: 630 }
  );
}
