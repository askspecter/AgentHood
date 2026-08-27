import "@rainbow-me/rainbowkit/styles.css"; // REQUIRED, before app CSS — styles the connect modal
import "../src/index.css";

export const metadata = {
  metadataBase: new URL(process.env.PUBLIC_ORIGIN || "https://eska.fun"),
  title: "ESKA",
  description:
    "ESKA — characters worth owning. Discover living characters, trade their coins, shape their story.",
  icons: { icon: "/eska-logo.png", apple: "/eska-logo.png" },
  // Default share card: the live $ESKA burn total (deflationary story). Coin
  // pages override this with their own card via generateMetadata.
  openGraph: {
    title: "ESKA — deflationary launchpad on Robinhood Chain",
    description: "Launch coins from your X account. Buyback & burn is live. Every coin is an AI agent.",
    images: [{ url: "/api/card/burn", width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "ESKA — deflationary launchpad on Robinhood Chain",
    description: "Launch coins from your X account. Buyback & burn is live. Every coin is an AI agent.",
    images: ["/api/card/burn"],
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#07060c",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <div id="root">{children}</div>
      </body>
    </html>
  );
}
