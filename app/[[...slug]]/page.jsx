import ClientApp from "../ClientApp";

/**
 * Optional catch-all: every non-/api path renders the same SPA shell, so a deep
 * link like /you or /c/kettle serves the app and react-router takes over on the
 * client. The /api/* route handlers are more specific segments, so they win over
 * this page and are never swallowed by it.
 */

/**
 * Per-URL share metadata. A coin page (/c/:token) unfurls on X with that coin's
 * branded card; every other path keeps the site default (the burn card) from the
 * root layout.
 */
export async function generateMetadata({ params }) {
  const slug = (await params)?.slug || [];
  if (slug[0] === "c" && slug[1] && /^0x[a-fA-F0-9]{40}$/.test(slug[1])) {
    const img = `/api/card/coin?token=${encodeURIComponent(slug[1])}`;
    return {
      openGraph: { title: "Trade on ESKA", images: [{ url: img, width: 1200, height: 630 }] },
      twitter: { card: "summary_large_image", title: "Trade on ESKA", images: [img] },
    };
  }
  return {};
}

export default function Page() {
  return <ClientApp />;
}
