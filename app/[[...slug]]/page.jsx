import ClientApp from "../ClientApp";

/**
 * Optional catch-all: every non-/api path renders the same SPA shell, so a deep
 * link like /you or /c/kettle serves the app and react-router takes over on the
 * client. The /api/* route handlers are more specific segments, so they win over
 * this page and are never swallowed by it.
 */
export default function Page() {
  return <ClientApp />;
}
