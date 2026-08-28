import { NextResponse } from "next/server";

/**
 * Serve the docs on the docs.* subdomain.
 *
 * docs.aurn.fun points at this same Vercel project, so by default it would show
 * the app. This rewrites any request on a `docs.` host to the static docs page
 * (public/docs.html) — the page is fully self-contained (inline CSS/JS, embedded
 * fonts), so a single rewrite covers every path. The main domain is untouched.
 */
export function middleware(request) {
  const host = (request.headers.get("host") || "").toLowerCase();
  if (host.startsWith("docs.")) {
    const url = request.nextUrl.clone();
    if (!url.pathname.startsWith("/docs")) {
      url.pathname = "/docs.html";
      return NextResponse.rewrite(url);
    }
  }
  return NextResponse.next();
}

export const config = {
  // Run on page requests; skip Next internals and API so the app is unaffected.
  matcher: ["/((?!_next/|api/|favicon.ico).*)"],
};
