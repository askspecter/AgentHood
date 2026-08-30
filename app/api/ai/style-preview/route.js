import { NextResponse } from "next/server";
import { kvGet, kvSet, kvConfigured } from "@/lib/logostore";
import { fluxImageUrl } from "@/lib/flux";
import { stylePreviewPrompt } from "@/lib/styles";

/**
 * GET /api/ai/style-preview?style=<key>
 *
 * The thumbnail shown on a style tile in the Launch flow. A representative
 * character portrait is generated once with FLUX, cached in Vercel KV, and
 * served as bytes forever after - so the picker looks like a gallery without
 * shipping any third-party images. Falls back with an error the client hides
 * (showing a gradient tile) when FAL_KEY or KV isn't set.
 *
 * The preview prompt comes from the SAME style engine (lib/styles) the real
 * generator uses, so the tile you pick and the logo you get are the same style.
 * Cache is v2 because the prompts changed with that unification - old v1 tiles
 * lazily regenerate the first time each style is viewed again.
 */

const cacheKey = (k) => `pons:stylepreview:v2:${k}`;
const TTL = 60 * 60 * 24 * 365 * 5;

function imageResponse(type, data) {
  return new NextResponse(data, {
    headers: { "Content-Type": type, "Cache-Control": "public, max-age=31536000, immutable" },
  });
}

async function toWebp(url) {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error("fetch preview failed");
  const raw = Buffer.from(await res.arrayBuffer());
  try {
    const sharp = require("sharp");
    const out = await sharp(raw).resize(256, 256, { fit: "cover" }).webp({ quality: 80 }).toBuffer();
    return { type: "image/webp", data: out };
  } catch {
    return { type: "image/png", data: raw };
  }
}

export async function GET(request) {
  const style = new URL(request.url).searchParams.get("style") || "";
  const prompt = stylePreviewPrompt(style);
  if (!prompt) return NextResponse.json({ error: "Unknown style." }, { status: 400 });
  if (!kvConfigured()) return NextResponse.json({ error: "Storage not configured." }, { status: 501 });

  // Serve the cached preview if we already generated it.
  try {
    const cached = await kvGet(cacheKey(style));
    if (cached?.result) {
      const { type, data } = JSON.parse(cached.result);
      return imageResponse(type, Buffer.from(data, "base64"));
    }
  } catch {
    /* fall through and generate */
  }

  // Generate once, cache, serve.
  try {
    const url = await fluxImageUrl(prompt);
    const img = await toWebp(url);
    await kvSet(cacheKey(style), JSON.stringify({ type: img.type, data: img.data.toString("base64") }), TTL);
    return imageResponse(img.type, img.data);
  } catch (error) {
    return NextResponse.json({ error: "Preview unavailable." }, { status: error.code === "no_fal" ? 503 : 502 });
  }
}
