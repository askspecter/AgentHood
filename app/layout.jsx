import "@rainbow-me/rainbowkit/styles.css"; // REQUIRED, before app CSS - styles the connect modal
import "../src/index.css";

export const metadata = {
  metadataBase: new URL(process.env.PUBLIC_ORIGIN || "https://aurn.fun"),
  title: "AURN",
  description:
    "AURN - characters worth owning. Discover living characters, trade their coins, shape their story.",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/favicon-32x32.png", type: "image/png", sizes: "32x32" },
      { url: "/favicon-16x16.png", type: "image/png", sizes: "16x16" },
    ],
    apple: "/apple-touch-icon.png",
  },
  manifest: "/site.webmanifest",
  // Default share card: the brand mark. Coin pages override this with their own
  // card via generateMetadata.
  openGraph: {
    title: "AURN - launchpad on Robinhood Chain",
    description: "Launch coins from your own wallet. Every coin is an AI agent.",
    images: [{ url: "/aurn-logo.png", width: 512, height: 512 }],
  },
  twitter: {
    card: "summary",
    title: "AURN - launchpad on Robinhood Chain",
    description: "Launch coins from your own wallet. Every coin is an AI agent.",
    images: ["/aurn-logo.png"],
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#06070d",
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
