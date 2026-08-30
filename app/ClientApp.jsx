"use client";

import dynamic from "next/dynamic";

/**
 * The whole AURN interface is a client-side SPA (react-router). Next.js provides
 * the server - the real /api/* routes for X sign-in, launch and trade - while the
 * UI itself mounts only in the browser. `ssr: false` keeps BrowserRouter and the
 * localStorage-backed store off the server, where `window` does not exist.
 */
const App = dynamic(() => import("../src/App"), { ssr: false });

export default function ClientApp() {
  return <App />;
}
