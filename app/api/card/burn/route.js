import { ImageResponse } from "next/og";

/**
 * GET /api/card/burn?n=28.38M
 *
 * A branded 1200x630 share card for the $AURN burn total — the "deflationary
 * milestone" image. The client passes the already-formatted number as `n`; if
 * it's absent, we read the live total from /api/aurn/burned so the card is still
 * correct when a link unfurls with no params.
 */

export const runtime = "nodejs";

function fmt(n) {
  if (!Number.isFinite(n)) return null;
  if (Math.abs(n) >= 1e9) return (n / 1e9).toFixed(2) + "B";
  if (Math.abs(n) >= 1e6) return (n / 1e6).toFixed(2) + "M";
  if (Math.abs(n) >= 1e3) return (n / 1e3).toFixed(1) + "K";
  return String(Math.round(n));
}

async function resolveBurn(request) {
  const p = new URL(request.url).searchParams;
  const given = p.get("n");
  if (given) return String(given).slice(0, 16);
  try {
    const origin = new URL(request.url).origin;
    const r = await fetch(`${origin}/api/aurn/burned?network=robinhood`, { cache: "no-store" });
    const j = await r.json();
    // Only a real, positive on-chain total earns the number; otherwise the card
    // reads "live" rather than a hollow zero (e.g. between an old and new token).
    const s = Number(j?.burned) > 0 ? fmt(Number(j.burned)) : null;
    if (s) return s;
  } catch {
    /* fall through to a label */
  }
  return null;
}

export async function GET(request) {
  const n = await resolveBurn(request);
  const ink = "#EEF2FB";
  const soft = "#929bb6";

  return new ImageResponse(
    (
      <div style={{ width: "1200px", height: "630px", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: "72px", background: "#06070d", color: ink, fontFamily: "sans-serif" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "26px", letterSpacing: "4px", color: soft }}>
          <div style={{ display: "flex", color: "#bcd0f4", fontWeight: 700 }}>$AURN</div>
          <div style={{ display: "flex" }}>DEFLATIONARY</div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", flexGrow: 1 }}>
          <div style={{ display: "flex", fontSize: "26px", letterSpacing: "6px", color: soft, marginBottom: "6px" }}>$AURN BURNED</div>
          <div style={{ display: "flex", fontSize: n && n.length > 7 ? "170px" : "210px", fontWeight: 800, lineHeight: 1, color: "#dbe6fb" }}>
            {n || "live"}
          </div>
          <div style={{ display: "flex", fontSize: "30px", color: soft, marginTop: "16px" }}>bought back &amp; burned on-chain &middot; forever</div>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "30px", letterSpacing: "3px", color: soft }}>
          <div style={{ display: "flex" }}>supply only goes down</div>
          <div style={{ display: "flex" }}>aurn.fun</div>
        </div>
      </div>
    ),
    { width: 1200, height: 630 }
  );
}
