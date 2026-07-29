import { NextResponse } from "next/server";
import { kvGet, kvSet, kvConfigured } from "@/lib/logostore";
import { fluxImageUrl } from "@/lib/flux";

/**
 * GET /api/ai/style-preview?style=<key>
 *
 * The thumbnail shown on a style tile in the Launch flow. A representative
 * character portrait is generated once with FLUX, cached in Vercel KV, and
 * served as bytes forever after — so the picker looks like a gallery without
 * shipping any third-party images. Falls back with an error the client hides
 * (showing a gradient tile) when FAL_KEY or KV isn't set.
 */

const cacheKey = (k) => `pons:stylepreview:v1:${k}`;
const TTL = 60 * 60 * 24 * 365 * 5;

const STYLE_PROMPTS = {
  realistic: "photorealistic studio portrait of a person, natural soft lighting, ultra detailed",
  anime: "anime style portrait, vibrant colors, clean cel shading, expressive eyes",
  pixel: "16-bit pixel art portrait of a hero character, retro game sprite",
  ps2: "early-2000s PS2-era 3D game render portrait, low poly, nostalgic",
  lineart: "black and white line art portrait, minimal clean ink, white background",
  cyberpunk: "cyberpunk portrait, neon lights, futuristic city, moody",
  mascot: "cute glossy 3D mascot character, big friendly eyes, soft studio light",
  film: "cinematic film still portrait, dramatic lighting, shallow depth of field",
  comic: "comic book style portrait, bold ink outlines, halftone shading, dynamic",
  ethereal: "ethereal dreamy portrait, soft glow, translucent light, heavenly",
  fantasy: "epic fantasy portrait, glowing magic runes, ornate, cinematic",
  dark: "dark moody portrait, low-key dramatic lighting, deep shadows",
  cartoon: "3D animated cartoon portrait, Pixar-like, expressive, colorful",
  manhwa: "korean manhwa webtoon style portrait, clean soft shading, handsome",
  vaporwave: "vaporwave portrait, pastel neon, retro 80s aesthetic, gradient glow",
  chibi: "chibi style character, super deformed, big head, tiny cute body",
  ghibli: "studio ghibli inspired portrait, soft watercolor, whimsical, warm",
};

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
  const prompt = STYLE_PROMPTS[style];
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
    const url = await fluxImageUrl(`${prompt}. Centered headshot, simple background.`);
    const img = await toWebp(url);
    await kvSet(cacheKey(style), JSON.stringify({ type: img.type, data: img.data.toString("base64") }), TTL);
    return imageResponse(img.type, img.data);
  } catch (error) {
    return NextResponse.json({ error: "Preview unavailable." }, { status: error.code === "no_fal" ? 503 : 502 });
  }
}
