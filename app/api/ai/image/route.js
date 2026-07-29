import { NextResponse } from "next/server";
import { persistImage } from "@/lib/logostore";
import { fluxImageUrl } from "@/lib/flux";

/**
 * POST /api/ai/image  { prompt }
 *
 * Generates a coin avatar/logo from a text prompt with FLUX.1 [schnell] on
 * fal.ai. The generated image is then stored durably in Vercel KV so the coin's
 * on-chain logo points at a stable URL we host — not fal's temporary one.
 *
 * If FAL_KEY isn't set, returns 503 and the client keeps its procedural avatar.
 * If KV isn't set, it falls back to returning fal's URL directly.
 */
export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Expected a JSON body." }, { status: 400 });
  }

  const prompt = String(body?.prompt || "").slice(0, 500).trim();
  if (!prompt) return NextResponse.json({ error: "Empty prompt." }, { status: 400 });

  // Frame every prompt as a single expressive CHARACTER portrait (an avatar),
  // not a literal coin — the coin is the token; its logo is a character.
  const full = `Character portrait of ${prompt}. A single expressive character or mascot, centered, facing forward, head and shoulders, vibrant, highly detailed, sharp focus, clean simple background, no text, no watermark, no border, not a coin, not a medal.`;

  let falUrl;
  try {
    falUrl = await fluxImageUrl(full);
  } catch (error) {
    if (error.code === "no_fal") {
      return NextResponse.json({ error: "AI images are not configured.", code: "no_fal" }, { status: 503 });
    }
    return NextResponse.json({ error: "Image generation failed." }, { status: 502 });
  }

  // Persist to KV so the on-chain logo is a permanent, self-hosted URL. If KV
  // isn't configured we fall back to fal's temporary URL rather than failing.
  let url = falUrl, stored = false;
  try {
    const { path } = await persistImage(falUrl);
    const origin = process.env.PUBLIC_ORIGIN || new URL(request.url).origin;
    url = `${origin}${path}`;
    stored = true;
  } catch {
    /* keep falUrl — display still works, on-chain persistence just needs KV */
  }
  return NextResponse.json({ url, stored });
}
