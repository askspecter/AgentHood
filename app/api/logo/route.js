import { NextResponse } from "next/server";
import { persistImage, kvGet, kvConfigured, PREFIX } from "@/lib/logostore";

/**
 * Durable logo storage for on-chain metadata.
 *
 * POST /api/logo   multipart file  → { id, url }
 * POST /api/logo   { source }       → { id, url }   (data URL or http URL)
 * GET  /api/logo?id=…               → the image bytes (immutable)
 *
 * A launched token stores its logo as a URL, so the image must never vanish.
 * Everything is normalised to a small WebP and kept in Vercel KV; the id is
 * content-addressed, so the same image stores once and the URL is stable.
 */

const NOT_CONFIGURED = {
  error: "Logo storage needs Vercel KV. Set KV_REST_API_URL and KV_REST_API_TOKEN.",
  code: "kv_not_configured",
};

export async function POST(request) {
  if (!kvConfigured()) return NextResponse.json(NOT_CONFIGURED, { status: 501 });

  let source;
  const ct = request.headers.get("content-type") || "";
  try {
    if (ct.includes("application/json")) {
      const body = await request.json();
      source = body?.source;
      if (!source) return NextResponse.json({ error: "No image source." }, { status: 400 });
    } else {
      const form = await request.formData();
      const file = form.get("file");
      if (!file || typeof file === "string") {
        return NextResponse.json({ error: "No file received." }, { status: 400 });
      }
      source = Buffer.from(await file.arrayBuffer());
    }
  } catch {
    return NextResponse.json({ error: "Could not read the image." }, { status: 400 });
  }

  try {
    const { id, path, bytes } = await persistImage(source);
    const origin = process.env.PUBLIC_ORIGIN || new URL(request.url).origin;
    return NextResponse.json({ id, url: `${origin}${path}`, bytes });
  } catch (error) {
    if (error.code === "kv_not_configured") return NextResponse.json(NOT_CONFIGURED, { status: 501 });
    return NextResponse.json({ error: `Could not store the image: ${error.message}` }, { status: 502 });
  }
}

export async function GET(request) {
  const id = new URL(request.url).searchParams.get("id");
  if (!id || !/^[a-f0-9]{32}$/.test(id)) {
    return NextResponse.json({ error: "Bad id." }, { status: 400 });
  }
  if (!kvConfigured()) return NextResponse.json(NOT_CONFIGURED, { status: 501 });

  try {
    const json = await kvGet(PREFIX + id);
    if (!json?.result) return NextResponse.json({ error: "Not found." }, { status: 404 });
    const { type, data } = JSON.parse(json.result);
    return new NextResponse(Buffer.from(data, "base64"), {
      headers: {
        "Content-Type": type,
        // Content-addressed id → the bytes never change.
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 502 });
  }
}
