"use strict";

/**
 * The visual styles offered on the Launch "look" step.
 *
 * ONE source of truth, shared by the style-preview thumbnails
 * (app/api/ai/style-preview) and the real logo generator (app/api/ai/image).
 * They must live in one place: when the preview used one prompt and the
 * generator used another, picking a style showed one look and produced a
 * different one - the exact mismatch this fixes.
 *
 * Each style LEADS with its medium - what the image is drawn or rendered as -
 * so FLUX commits to the style instead of defaulting to a cinematic digital
 * painting. `rendered` marks styles that want depth, atmosphere and a rich
 * background; the flat/illustrated ones (`rendered: false`) deliberately drop
 * the "cinematic / depth of field / ultra detailed / sharp focus" language,
 * because those terms drag a pixel/line/anime look back toward 3D photorealism.
 * `avoid` names what to steer away from so the style stays clean.
 */

const STYLES = {
  realistic: {
    label: "Realistic",
    medium: "photorealistic studio character portrait",
    detail: "natural soft lighting, lifelike skin and texture, shallow depth of field, ultra detailed, sharp focus",
    avoid: "cartoon, anime, illustration, painting",
    rendered: true,
  },
  anime: {
    label: "Anime",
    medium: "anime illustration character portrait with clean cel shading",
    detail: "vibrant flat colors, crisp linework, expressive large eyes, subtle cel shadows",
    avoid: "photorealism, 3D render, western cartoon",
    rendered: false,
  },
  pixel: {
    label: "Pixel Art",
    medium: "16-bit pixel-art character sprite portrait",
    detail: "chunky visible pixels, limited retro palette, dithering, crisp hard edges",
    avoid: "photorealism, smooth gradients, anti-aliasing, 3D render, blur",
    rendered: false,
  },
  ps2: {
    label: "PS2",
    medium: "early-2000s PS2-era low-poly 3D game render character portrait",
    detail: "low polygon count, simple baked textures, slightly stiff, nostalgic game render",
    avoid: "photorealism, modern high-poly, ray tracing",
    rendered: true,
  },
  lineart: {
    label: "Line Art",
    medium: "clean black-and-white line-art character portrait",
    detail: "minimal confident ink lines, no shading, flat white background",
    avoid: "color, gradients, photorealism, painting, shading",
    rendered: false,
  },
  cyberpunk: {
    label: "Cyberpunk",
    medium: "cyberpunk character portrait",
    detail: "neon rim lighting, glowing signage, rainy futuristic city bokeh, moody teal and magenta",
    avoid: "flat, plain background, bright daylight",
    rendered: true,
  },
  mascot: {
    label: "Mascot",
    medium: "cute glossy 3D mascot character portrait",
    detail: "big friendly eyes, smooth rounded shapes, soft studio lighting, toy-like",
    avoid: "photorealism, gritty, dark",
    rendered: true,
  },
  film: {
    label: "Film",
    medium: "cinematic film-still character portrait",
    detail: "dramatic key lighting, filmic color grade, shallow depth of field, subtle grain",
    avoid: "cartoon, anime, flat illustration",
    rendered: true,
  },
  comic: {
    label: "Comic Book",
    medium: "comic-book character portrait",
    detail: "bold black ink outlines, halftone dot shading, flat punchy colors, dynamic",
    avoid: "photorealism, 3D render, soft gradients",
    rendered: false,
  },
  ethereal: {
    label: "Ethereal",
    medium: "ethereal dreamy character portrait",
    detail: "soft glow, translucent light, pastel haze, heavenly bloom",
    avoid: "harsh shadows, gritty, dark",
    rendered: true,
  },
  fantasy: {
    label: "Fantasy",
    medium: "epic fantasy character portrait",
    detail: "glowing magic runes, ornate armor or robes, atmospheric, painterly",
    avoid: "modern, mundane, flat",
    rendered: true,
  },
  dark: {
    label: "Dark",
    medium: "dark moody character portrait",
    detail: "low-key dramatic lighting, deep shadows, high contrast, brooding",
    avoid: "bright, cheerful, flat lighting",
    rendered: true,
  },
  cartoon: {
    label: "Cartoon",
    medium: "3D animated cartoon character portrait, Pixar-like",
    detail: "smooth stylized shapes, expressive, colorful, soft global illumination",
    avoid: "photorealism, gritty, flat 2D",
    rendered: true,
  },
  manhwa: {
    label: "Manhwa",
    medium: "korean manhwa webtoon character portrait",
    detail: "clean soft cel shading, delicate linework, polished, pretty",
    avoid: "photorealism, western cartoon, rough sketch",
    rendered: false,
  },
  vaporwave: {
    label: "Vaporwave",
    medium: "vaporwave character portrait",
    detail: "pastel neon, retro-80s aesthetic, gradient glow, chrome and grid",
    avoid: "photorealism, muted colors, daylight",
    rendered: true,
  },
  chibi: {
    label: "Chibi",
    medium: "chibi super-deformed character portrait",
    detail: "big head, tiny cute body, soft rounded shapes, adorable",
    avoid: "photorealism, realistic proportions, gritty",
    rendered: false,
  },
  ghibli: {
    label: "Ghibli",
    medium: "studio-ghibli-inspired character portrait",
    detail: "soft watercolor, whimsical, warm gentle light, hand-painted",
    avoid: "photorealism, 3D render, harsh neon",
    rendered: false,
  },
};

/** Framing that fits the medium: rendered styles get depth and atmosphere; flat ones stay clean. */
function framingFor(style) {
  return style && style.rendered
    ? "head and shoulders, centered, facing forward, expressive, rich thematic background, depth of field"
    : "head and shoulders, centered, facing forward, expressive, simple clean background";
}

/** A short prompt for the style-preview thumbnails (a generic subject). */
function stylePreviewPrompt(key) {
  const s = STYLES[key];
  if (!s) return null;
  return `${s.medium} of a character. ${s.detail}. Centered headshot, simple background. Avoid ${s.avoid}.`;
}

/**
 * The full generation prompt for a chosen style and a subject description.
 * With an unknown/empty style it returns the original generic cinematic
 * character template, so callers that pass no style behave exactly as before.
 */
function styleImagePrompt(key, subject) {
  const s = STYLES[key];
  const who = String(subject || "").trim() || "a striking original character";
  if (!s) {
    return `Character portrait of ${who}. A single striking character or mascot, head and shoulders, centered, facing forward, expressive, cinematic dramatic lighting, rich atmospheric thematic background, depth of field, ultra detailed, sharp focus, high quality digital art. No text, no watermark, not a coin, not a medal.`;
  }
  return `${s.medium} of ${who}. ${s.detail}. A single striking character, ${framingFor(s)}. No text, no watermark, not a coin, not a medal. Avoid ${s.avoid}.`;
}

module.exports = { STYLES, stylePreviewPrompt, styleImagePrompt };
