"use strict";

/**
 * FLUX.1 [schnell] on fal.ai — one shared call for logo generation and style
 * previews. The FAL_KEY stays server-side. Returns the temporary fal image URL;
 * callers persist it to KV for anything durable.
 */

const FAL_URL = "https://fal.run/fal-ai/flux/schnell";

async function fluxImageUrl(prompt, { timeoutMs = 30000 } = {}) {
  const key = process.env.FAL_KEY;
  if (!key) {
    const err = new Error("AI images are not configured.");
    err.code = "no_fal";
    throw err;
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(FAL_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Key ${key}` },
      cache: "no-store",
      signal: controller.signal,
      body: JSON.stringify({
        prompt: String(prompt || "").slice(0, 600),
        image_size: "square_hd",
        num_images: 1,
        num_inference_steps: 4,
        enable_safety_checker: true,
      }),
    });
    if (!res.ok) {
      const detail = (await res.text().catch(() => "")).slice(0, 200);
      const err = new Error(`Image generation failed: HTTP ${res.status} ${detail}`);
      err.code = "flux_failed";
      throw err;
    }
    const json = await res.json();
    const url = json?.images?.[0]?.url;
    if (!url) throw new Error("No image returned.");
    return url;
  } finally {
    clearTimeout(timer);
  }
}

module.exports = { fluxImageUrl };
