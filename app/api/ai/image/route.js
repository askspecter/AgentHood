import { NextResponse } from "next/server";
import { persistImage } from "@/lib/logostore";
import { fluxImageUrl } from "@/lib/flux";
import { styleImagePrompt } from "@/lib/styles";

/**
 * POST /api/ai/image  { prompt, style }
 *
 * Generates a coin avatar/logo from a text prompt with FLUX.1 [schnell] on
 * fal.ai. The generated image is then stored durably in Vercel KV so the coin's
 * on-chain logo points at a stable URL we host - not fal's temporary one.
 *
 * `style` is the picked style key (e.g. "pixel", "anime"). It DRIVES the prompt
 * via the shared style engine in lib/styles - the same one the preview tiles
 * use, so what you pick is what you get. It used to be buried inside a fixed
 * cinematic-realism template here, which dragged flat styles (pixel, line art,
 * anime, chibi) back toward a 3D digital painting - a picked style that
 * generated as something else. With no/unknown style it falls back to that
 * generic template, so older callers are unchanged.
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
  const style = String(body?.style || "").trim();

  // The style owns the render; the prompt is just the subject slotted into it.
  const full = styleImagePrompt(style, prompt);

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
    /* keep falUrl - display still works, on-chain persistence just needs KV */
  }
  return NextResponse.json({ url, stored });
}
