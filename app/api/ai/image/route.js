import { NextResponse } from "next/server";

/**
 * POST /api/ai/image  { prompt }
 *
 * Generates a coin avatar/logo from a text prompt with FLUX.1 [schnell] on
 * fal.ai (fast, few-step model). The FAL_KEY stays on the server. Returns the
 * generated image URL, which the Launch flow uses as the coin's logo.
 *
 * If FAL_KEY isn't set, returns 503 and the client keeps its procedural avatar,
 * so the flow never breaks.
 */

const FAL_URL = "https://fal.run/fal-ai/flux/schnell";

export async function POST(request) {
  const key = process.env.FAL_KEY;
  if (!key) {
    return NextResponse.json({ error: "AI images are not configured.", code: "no_fal" }, { status: 503 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Expected a JSON body." }, { status: 400 });
  }

  const prompt = String(body?.prompt || "").slice(0, 500).trim();
  if (!prompt) return NextResponse.json({ error: "Empty prompt." }, { status: 400 });

  // Frame every prompt as a clean, centred coin/mascot logo so results read as an
  // avatar rather than a full scene.
  const full = `${prompt}. A single centred coin mascot logo, bold, high contrast, crisp, on a simple dark background, no text, no watermark, no border.`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30000);
  try {
    const res = await fetch(FAL_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Key ${key}` },
      cache: "no-store",
      signal: controller.signal,
      body: JSON.stringify({
        prompt: full,
        image_size: "square_hd",
        num_images: 1,
        num_inference_steps: 4,
        enable_safety_checker: true,
      }),
    });
    if (!res.ok) {
      const detail = (await res.text().catch(() => "")).slice(0, 200);
      return NextResponse.json({ error: "Image generation failed.", detail }, { status: 502 });
    }
    const json = await res.json();
    const url = json?.images?.[0]?.url || null;
    if (!url) return NextResponse.json({ error: "No image returned." }, { status: 502 });
    return NextResponse.json({ url });
  } catch {
    return NextResponse.json({ error: "Image generation failed." }, { status: 502 });
  } finally {
    clearTimeout(timer);
  }
}
