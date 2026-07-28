import "../src/index.css";

export const metadata = {
  title: "ESKA",
  description:
    "ESKA — characters worth owning. Discover living characters, trade their coins, shape their story.",
  icons: { icon: "/favicon.svg" },
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
